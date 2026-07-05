# Deployment & Configuration

This document covers building, configuring, and deploying meridian-tasks-api to different environments.

---

## Build

### Development Build

```bash
npm install
npm run dev
```

Runs TypeScript directly via `ts-node`. Watches for changes and auto-reloads (when using a tool like `ts-node-dev` or similar).

### Production Build

```bash
npm install
npm run build
npm start
```

1. **`npm install`** — Install dependencies (both `dependencies` and `devDependencies`)
2. **`npm run build`** — Compile TypeScript to JavaScript (output: `dist/index.js`)
3. **`npm start`** — Run the compiled JavaScript

**Build output:**
- Input: `src/**/*.ts`
- Output: `dist/**/*.js`
- Build config: `tsconfig.json` (target ES2022, CommonJS module)

---

## Environment Variables

### Required (Production)

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_ENV` | Runtime mode; affects auth strictness | `production` |
| `MERIDIAN_API_KEY` | API key for request authentication | (secret) |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | HTTP server port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string (future) | (none; in-memory if omitted) |
| `APAC_FAILOVER` | Enable APAC → NA fallback if set to `"1"` | (off) |

### Example .env (Development)

```bash
# .env file (never commit this)
PORT=4000
NODE_ENV=development
MERIDIAN_API_KEY=local-test-key
```

Load with `dotenv` package (not built in; must be added if needed):

```bash
npm install dotenv
```

Then in `src/index.ts`:

```typescript
import dotenv from "dotenv";
dotenv.config();
```

### Example .env (Production)

```bash
NODE_ENV=production
MERIDIAN_API_KEY=<secret-from-vault>
PORT=4000
DATABASE_URL=postgresql://user:password@db.production.internal:5432/meridian_tasks
```

**Security**: Store `MERIDIAN_API_KEY` in a secrets manager (Vault, AWS Secrets Manager, etc.), not in version control.

---

## Running Locally

```bash
npm install
npm run dev
```

Server listens on `http://localhost:4000` (or custom `$PORT`).

Test an endpoint:

```bash
curl -X GET "http://localhost:4000/v2/tasks" \
  -H "x-api-key: meridian-dev-key"
```

---

## Regional Database Endpoints

The API routes reads to the closest regional database replica. Endpoints are defined in `src/services/regionRouter.ts`:

```typescript
const REGION_ENDPOINTS: Record<string, string> = {
  NA: "https://db-na.meridianlabs.internal",
  EU: "https://db-eu.meridianlabs.internal",
  APAC: "https://db-apac.meridianlabs.internal",
  LATAM: "https://db-latam.meridianlabs.internal"
};
```

When you filter tasks by region (e.g., `GET /v2/tasks?region=APAC`), the response includes the endpoint that would be queried:

```json
{
  "endpoint": "https://db-apac.meridianlabs.internal",
  "tasks": [...]
}
```

### Adding a New Region

1. Add endpoint to `REGION_ENDPOINTS` in `src/services/regionRouter.ts`
2. Add region code to Task/Project `region` enum in `src/db.ts`
3. Update rate limiting docs if new region has different tier contracts
4. Test with `npm run dev` and curl requests to the new region
5. Update this document with the new region details

---

## Deploying to Production

### Pre-Deployment Checklist

- [ ] `NODE_ENV` is set to `production`
- [ ] `MERIDIAN_API_KEY` is set (fetch from secrets manager)
- [ ] `DATABASE_URL` is set (PostgreSQL connection string, if using Postgres)
- [ ] All unit/integration tests pass
- [ ] Code review and merge approval

### Deployment Steps

#### Option 1: Direct Node.js Deployment

```bash
# On production server
cd /opt/meridian-tasks-api
git pull origin main
npm ci  # Use ci instead of install for reproducible builds
npm run build
# Set environment variables
export NODE_ENV=production
export MERIDIAN_API_KEY=$(vault kv get -field=api_key secret/meridian)
export DATABASE_URL=$(vault kv get -field=db_url secret/meridian)
npm start
```

#### Option 2: Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
npm run build
docker build -t meridian-tasks-api:latest .
docker push <registry>/meridian-tasks-api:latest
docker run -e NODE_ENV=production \
           -e MERIDIAN_API_KEY=$API_KEY \
           -e DATABASE_URL=$DB_URL \
           -p 4000:4000 \
           <registry>/meridian-tasks-api:latest
```

#### Option 3: Kubernetes Deployment

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meridian-tasks-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: meridian-tasks-api
  template:
    metadata:
      labels:
        app: meridian-tasks-api
    spec:
      containers:
      - name: meridian-tasks-api
        image: <registry>/meridian-tasks-api:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: production
        - name: MERIDIAN_API_KEY
          valueFrom:
            secretKeyRef:
              name: meridian-secrets
              key: api-key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: meridian-secrets
              key: db-url
        livenessProbe:
          httpGet:
            path: /v2/projects  # Simple health check
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 10
```

### Post-Deployment Verification

```bash
# Healthcheck
curl -H "x-api-key: $MERIDIAN_API_KEY" \
     https://api.production.internal/v2/projects

# Verify rate limiting
for i in {1..70}; do
  curl -s -H "x-api-key: $MERIDIAN_API_KEY" \
       -H "x-plan-tier: free" \
       https://api.production.internal/v2/tasks | jq .
done
# Request 61-70 should return 429
```

---

## Rolling Back

If deployment fails:

```bash
# Revert to previous version
git revert HEAD
npm run build
npm start

# Or directly run previous Docker image
docker run ... <registry>/meridian-tasks-api:previous-tag
```

---

## Scaling

### Horizontal Scaling

Run multiple instances behind a load balancer:

```bash
# Instance 1
PORT=4001 npm start

# Instance 2
PORT=4002 npm start

# Load balancer (nginx example)
upstream meridian_api {
  server 127.0.0.1:4001;
  server 127.0.0.1:4002;
}
server {
  listen 80;
  location / {
    proxy_pass http://meridian_api;
  }
}
```

**Caveat**: In-memory rate limit counters will not be shared across instances. Migrate to Redis before scaling horizontally.

### Vertical Scaling

Increase CPU/memory per instance (limited benefit for a lightweight API).

### Database Scaling

- Add read replicas per region (see `resolveRegionEndpoint()`)
- Use connection pooling (PgBouncer, pgpool)
- Add indexes on `region`, `status`, `projectId` columns

---

## Monitoring & Observability

### Logging

Add structured logging (not yet implemented):

```typescript
// Example: use pino or winston
import pino from "pino";
const logger = pino();

app.use((req, res, next) => {
  logger.info({ method: req.method, path: req.path });
  next();
});
```

### Metrics

Expose Prometheus metrics (not yet implemented):

```bash
npm install prom-client
```

Then add a `/metrics` endpoint.

### Error Tracking

Use Sentry or similar:

```typescript
import Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN });
app.use(Sentry.Handlers.errorHandler());
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process on port 4000
lsof -i :4000
kill -9 <PID>
```

### Database Connection Errors

- Check `DATABASE_URL` format: `postgresql://user:password@host:port/dbname`
- Verify database is reachable: `psql $DATABASE_URL`
- Check firewall rules

### Rate Limit Issues

- Verify `x-plan-tier` header is being sent
- Check client IP is correct (may be behind proxy)
- Review counter reset logic in `rateLimit.ts`

### High Memory Usage

- In-memory rate limit counters grow unbounded; implement counter cleanup
- Check in-memory task/project arrays aren't accumulating stale data
