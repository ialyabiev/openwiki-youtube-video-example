# Meridian Tasks API — Quick Start

Welcome to **meridian-tasks-api**, a lightweight Express-based REST API for managing tasks and projects across multiple geographic regions.

## What is this?

This is an **internal task management API** for Meridian Labs. It serves as a backend for task and project lifecycle management, with support for multi-region deployments, plan-based rate limiting, and API key authentication.

**Key features:**
- **REST API** for tasks and projects (`GET`, `POST` endpoints)
- **Multi-region support** (NA, EU, APAC, LATAM) with regional database routing
- **Plan-tier rate limiting** (free: 60 req/min, pro: 600 req/min, enterprise: 3000 req/min)
- **API key authentication** (header-based)
- **Legacy API alias** for pre-1.0 mobile clients (`/v1/tickets` → `/v2/tasks`)

## Getting Started

### Install Dependencies
```bash
npm install
```

### Development
```bash
npm run dev
```
Runs on http://localhost:4000 (or custom `PORT` env var).

### Production Build
```bash
npm run build
npm start
```

### API Keys
- **Development:** Use header `x-api-key: meridian-dev-key`
- **Production:** Set `MERIDIAN_API_KEY` environment variable

### Rate Limiting
Include `x-plan-tier` header (`free` | `pro` | `enterprise`) for plan-specific limits. Defaults to `free` if missing.

---

## Documentation Map

### [Architecture](./architecture/overview.md)
- **[API Endpoints & Routes](./architecture/api.md)** — Tasks and projects REST endpoints, query parameters, response shapes
- **[Data Models](./architecture/data-models.md)** — Task and project schemas, region enum, plan tiers
- **[Middleware](./architecture/middleware.md)** — Authentication, rate limiting, and error handling

### [Operations](./operations/deployment.md)
- **[Deployment & Configuration](./operations/deployment.md)** — Environment variables, database setup, regional endpoints
- **[Region Router](./operations/region-router.md)** — Multi-region routing logic and APAC failover behavior

---

## Source Tree

```
src/
├── index.ts                    # Express app, middleware, route registration
├── db.ts                       # In-memory data store (Task, Project interfaces)
├── middleware/
│   ├── auth.ts                 # API key validation
│   └── rateLimit.ts            # Plan-tier rate limiting
├── routes/
│   ├── tasks.ts                # GET, POST tasks; region filtering
│   └── projects.ts             # GET projects; task summary rollup
└── services/
    └── regionRouter.ts         # Regional endpoint resolution, failover logic
```

---

## Quick Decision Flows

### Adding a new endpoint?
1. Create it in `/src/routes/` (or add to existing router)
2. Import in `/src/index.ts` and register with `app.use()`
3. Protect with auth/rate limit if needed (auto-applied globally)
4. Document query params and response shape in [API Endpoints](./architecture/api.md)

### Changing rate limits?
1. Edit `LIMITS` in `/src/middleware/rateLimit.ts`
2. Coordinate with platform team if enterprise (contractual)
3. Update [Middleware](./architecture/middleware.md) docs

### Deploying to a new region?
1. Add endpoint to `REGION_ENDPOINTS` in `/src/services/regionRouter.ts`
2. Set `DATABASE_URL` to point to regional database in production
3. Review [Region Router](./operations/region-router.md) failover logic
4. Update [Operations](./operations/deployment.md) docs with new region credentials

### Fixing APAC failover behavior?
- See [Region Router — APAC Failover](./operations/region-router.md#apac-failover) for current logic and why it exists

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js 4.19.x
- **Language:** TypeScript 5.4.x
- **Data:** In-memory (dev) or PostgreSQL (prod, via `DATABASE_URL` env)

---

## Key Context

- **Version:** 1.4.2
- **Main Entry:** `src/index.ts` (starts Express server on port 4000)
- **Build Target:** CommonJS (ES2022)
- **Legacy Compatibility:** `/v1/tickets` route kept for pre-1.0 mobile clients; do not remove until mobile v3 rollout

---

## Next Steps

- **Familiarize yourself with the API:** Read [API Endpoints & Routes](./architecture/api.md)
- **Understand the data model:** Check [Data Models](./architecture/data-models.md)
- **Deploy or configure:** See [Deployment & Configuration](./operations/deployment.md)
- **Debug regional issues:** Check [Region Router](./operations/region-router.md)

For any architectural questions, start with [Architecture Overview](./architecture/overview.md).
