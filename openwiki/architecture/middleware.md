# Middleware & Security

This document describes the middleware stack, authentication, and rate limiting enforcement.

---

## Middleware Stack

Defined in `src/index.ts`, applied globally in this order:

```typescript
app.use(express.json());              // Parse request bodies
app.use(authMiddleware);               // Validate x-api-key
app.use(rateLimit);                    // Enforce per-plan request limits
app.use("/v2/tasks", tasksRouter);     // Route handlers
app.use("/v2/projects", projectsRouter);
app.use("/v1/tickets", tasksRouter);   // Legacy alias
```

Each request passes through all middleware before reaching a route handler.

---

## Authentication Middleware

**Source:** `src/middleware/auth.ts`

Validates the `x-api-key` header to ensure the client is authorized.

### Behavior

```typescript
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-api-key");
  if (process.env.NODE_ENV === "production" && key !== process.env.MERIDIAN_API_KEY) {
    return res.status(401).json({ error: "invalid api key" });
  }
  if (process.env.NODE_ENV !== "production" && key && key !== DEV_KEY) {
    return res.status(401).json({ error: "invalid dev key" });
  }
  next();
}
```

**Development:**
- If `x-api-key` header is present and does not equal `meridian-dev-key`, return 401
- If no header is provided, continue (unauthenticated request allowed in dev)

**Production:**
- Require `x-api-key` header to match `MERIDIAN_API_KEY` environment variable
- If missing or invalid, return 401

### Configuration

| Environment | Expected Header Value | Environment Variable |
|-------------|----------------------|----------------------|
| Development | `meridian-dev-key` | (hardcoded) |
| Production | Any valid key | `MERIDIAN_API_KEY` |

### Usage

```bash
# Development
curl -H "x-api-key: meridian-dev-key" http://localhost:4000/v2/tasks

# Production (set MERIDIAN_API_KEY env var first)
curl -H "x-api-key: <value-of-MERIDIAN_API_KEY>" https://api.meridianlabs.internal/v2/tasks
```

### Important Notes

- API keys are **workspace-scoped** in production (one key per workspace/customer)
- The dev key is rotated in staging/production (hard-coded value is for local dev only)
- In production, ensure `NODE_ENV=production` is set to enforce strict key validation

---

## Rate Limiting Middleware

**Source:** `src/middleware/rateLimit.ts`

Enforces per-plan-tier request rate limits using a sliding 60-second window, keyed by client IP and plan tier.

### Configuration

```typescript
const LIMITS: Record<string, number> = {
  free: 60,
  pro: 600,
  enterprise: 3000
};
```

| Plan | Requests per 60 Seconds | Notes |
|------|-------------------------|-------|
| free | 60 | Default tier |
| pro | 600 | 10x increase |
| enterprise | 3000 | 50x increase; **contractual** |

### Behavior

```typescript
export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const plan = String(req.header("x-plan-tier") || "free");
  const limit = LIMITS[plan] ?? LIMITS.free;  // Unknown plans default to free
  const key = `${req.ip}:${plan}`;
  const now = Date.now();
  const entry = counters.get(key) || { count: 0, windowStart: now };
  
  // Reset window if > 60 seconds have elapsed
  if (now - entry.windowStart > 60_000) {
    entry.count = 0;
    entry.windowStart = now;
  }
  
  entry.count += 1;
  counters.set(key, entry);
  
  // Reject if over limit
  if (entry.count > limit) {
    return res.status(429).json({ error: "rate limit exceeded", limit, plan });
  }
  next();
}
```

### Sliding Window Mechanism

1. Each IP+plan combination has a counter with a window start timestamp
2. On each request, increment the counter
3. If the counter's window has aged past 60 seconds, reset it
4. If the counter exceeds the plan's limit, return 429

Example timeline for `free` plan (limit 60):
```
T=0s:  Request 1  → count=1, window=[0s, 60s)
T=1s:  Request 2  → count=2, window=[0s, 60s)
...
T=30s: Request 30 → count=30, window=[0s, 60s)
T=61s: Request 31 → window expired, reset count=1, window=[61s, 121s)
```

### Usage

Clients specify their plan tier via the `x-plan-tier` header:

```bash
curl -H "x-api-key: meridian-dev-key" \
     -H "x-plan-tier: pro" \
     http://localhost:4000/v2/tasks
```

If the header is missing, defaults to `free` (60 req/min).

### Response on Rate Limit Exceeded

```json
{
  "error": "rate limit exceeded",
  "limit": 60,
  "plan": "free"
}
```

HTTP Status: **429 Too Many Requests**

### Important Notes

- **Enterprise limits are contractual**: Do not change without coordination with the platform team. This is a contractual commitment to customers on enterprise plans.
- **In-memory counters**: Current implementation stores counters in a Map that is lost on restart. Production should use Redis or similar for distributed rate limiting across multiple instances.
- **Per-IP keying**: Rate limits are per-client IP. Behind a proxy, all traffic may appear from one IP; consider adding a header-based override for internal services.
- **No token bucket**: This is a simple "requests per minute" counter, not a token bucket. Clients cannot smooth out bursts.

---

## Middleware Ordering & Implications

The stack is applied top-to-bottom, so:

1. **JSON parsing** happens first: requests with invalid JSON fail before auth/rate limiting
2. **Auth** happens before rate limiting: unauthenticated requests are rejected without consuming rate limit quota
3. **Rate limiting** happens before route handlers: over-limit requests don't trigger business logic

This order is correct. Do not reorder without careful consideration of security implications.

---

## Future Improvements

1. **Input validation middleware** — Validate request body schema before routes
2. **Distributed rate limiting** — Use Redis or DynamoDB for rate limit state across instances
3. **API key management** — Add key rotation, expiration, scope/permission levels
4. **CORS** — Add if this becomes a public-facing API
5. **Logging** — Add request/response logging for debugging and audit trails
