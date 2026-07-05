# Architecture Overview

**meridian-tasks-api** is a lightweight Express-based REST API built with TypeScript. It manages tasks and projects across four geographic regions with built-in authentication, rate limiting, and multi-region failover support.

## System Design

### Request Flow

```
HTTP Request
    ↓
Express JSON Parser
    ↓
Authentication Middleware (x-api-key validation)
    ↓
Rate Limiting Middleware (plan-tier sliding window)
    ↓
Route Handler (tasks or projects)
    ↓
Region Router (resolves regional database endpoint)
    ↓
HTTP Response
```

### Architectural Layers

| Layer | Purpose | Files |
|-------|---------|-------|
| **Entrypoint** | Express app setup, route registration, port binding | `src/index.ts` |
| **Data Layer** | In-memory data store and type definitions | `src/db.ts` |
| **Middleware** | Cross-cutting concerns: auth, rate limiting | `src/middleware/` |
| **API Routes** | HTTP endpoint handlers for tasks and projects | `src/routes/` |
| **Services** | Business logic: region resolution, failover | `src/services/` |

## Data Storage

The current implementation uses **in-memory arrays** (`tasks`, `projects` in `src/db.ts`). Data is lost on restart.

**Production path**: Replace in-memory store with PostgreSQL via environment variable `DATABASE_URL` (not yet implemented in code; see [Operations › Deployment](../operations/deployment.md)).

## Middleware Stack

Applied globally to all routes in this order:

1. **Express JSON Parser** — Parse request body as JSON
2. **Auth Middleware** — Validate `x-api-key` header
3. **Rate Limit Middleware** — Track and enforce per-plan request limits

See [Middleware](./middleware.md) for implementation details.

## Multi-Region Support

The API serves four regions:
- **NA** (North America)
- **EU** (Europe)
- **APAC** (Asia-Pacific)
- **LATAM** (Latin America)

Each task and project is tagged with a `region` enum. The `resolveRegionEndpoint()` service ([Operations › Region Router](../operations/region-router.md)) maps region codes to database endpoints and handles failover logic.

## API Versioning

- **v2** (current): `/v2/tasks`, `/v2/projects`
- **v1** (legacy): `/v1/tickets` → `/v2/tasks` (for pre-1.0 mobile clients)

The v1 alias will remain until mobile v3 rollout completes; do not remove it early.

## Key Design Decisions

### Why in-memory storage for dev?
Fast iteration and zero external dependencies during development. Production uses real database.

### Why slide window rate limiting?
Simple per-minute enforcement without complex token bucket logic. Adequate for current scale.

### Why keep v1 alias?
Mobile app v1 cannot be instantly updated. The alias prevents breaking production mobile traffic during the v3 rollout period.

### Why is APAC failover special?
Singapore replica has historically had availability issues. If it goes down, traffic falls back to NA to avoid total data loss. Tracked as task t3 in seed data.

## Performance & Scaling

**Current limitations:**
- In-memory storage: O(n) array scans for filtering by region/status
- No database indexes
- Single-process: no clustering or load balancing

**Scaling path:**
1. Switch to PostgreSQL with region+status indexes
2. Add connection pooling
3. Deploy behind load balancer (one instance per region or multi-region)
4. Consider read replicas for each region

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20.x+ | Runtime |
| **Express** | 4.19.x | HTTP framework |
| **TypeScript** | 5.4.x | Type-safe development |
| **ts-node** | 10.9.x | Dev-time TS execution |

Build target: **CommonJS** (ES2022), outputs to `dist/`.
