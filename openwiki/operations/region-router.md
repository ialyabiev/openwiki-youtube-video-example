# Region Router & Multi-Region Strategy

This document explains how the API routes database reads to regional replicas and the APAC failover behavior.

---

## Overview

**Source:** `src/services/regionRouter.ts`

The API serves four geographic regions. Each task and project is tagged with a region code (NA, EU, APAC, LATAM). When a client queries tasks, the response includes the database endpoint that would be used for that region.

### Regional Database Endpoints

```typescript
const REGION_ENDPOINTS: Record<string, string> = {
  NA: "https://db-na.meridianlabs.internal",
  EU: "https://db-eu.meridianlabs.internal",
  APAC: "https://db-apac.meridianlabs.internal",
  LATAM: "https://db-latam.meridianlabs.internal"
};
```

| Region | Code | Database Endpoint |
|--------|------|-------------------|
| North America | NA | db-na.meridianlabs.internal |
| Europe | EU | db-eu.meridianlabs.internal |
| Asia-Pacific | APAC | db-apac.meridianlabs.internal |
| Latin America | LATAM | db-latam.meridianlabs.internal |

---

## Router Function

```typescript
export function resolveRegionEndpoint(region: string): string {
  const endpoint = REGION_ENDPOINTS[region];
  if (!endpoint) return REGION_ENDPOINTS.NA;  // Default to NA for unknown regions
  if (region === "APAC" && process.env.APAC_FAILOVER === "1") {
    return REGION_ENDPOINTS.NA;
  }
  return endpoint;
}
```

### Behavior

1. **Normal case**: Return the endpoint for the requested region
2. **Unknown region**: Default to North America (NA)
3. **APAC failover enabled**: If `APAC_FAILOVER=1`, route APAC requests to NA instead

---

## APAC Failover

The APAC (Singapore) database replica has historically had availability issues. To mitigate data loss during regional outages, the router can fall back to NA.

### When to Enable APAC Failover

Set `APAC_FAILOVER=1` when:

- Singapore database is known to be unreachable or degraded
- You need to temporarily route APAC traffic to NA to avoid total loss
- You're waiting for Singapore replica to recover

```bash
export APAC_FAILOVER=1
npm start
```

### Trade-offs

**Pros:**
- Requests succeed instead of timing out
- Data consistency with NA replica
- Prevents total loss of APAC traffic

**Cons:**
- Increased latency for APAC clients (network distance to NA)
- Mobile app may report "push notification lag" (see task t3 in seed data)
- APAC region in response doesn't match actual database location

### Monitoring APAC Failover

When `APAC_FAILOVER=1`, monitor:

1. **Client latency** — Will increase for APAC users (typically 100-200ms extra)
2. **Successful requests** — Should remain 100% (not timing out)
3. **Singapore replica recovery time** — Check database team's status page

Once Singapore replica is recovered, disable the flag:

```bash
export APAC_FAILOVER=0
npm start
```

---

## Database Routing in Practice

### Current Implementation

Currently, the API is **in-memory** — it doesn't actually connect to any database. The `resolveRegionEndpoint()` function only returns the endpoint URL that *would* be used.

Client receives:
```json
{
  "endpoint": "https://db-apac.meridianlabs.internal",
  "tasks": [...]
}
```

### Future: PostgreSQL Integration

When moving to PostgreSQL:

```typescript
// Pseudo-code (not yet implemented)
const endpoint = resolveRegionEndpoint(region);
const client = new PostgresClient(endpoint);
const result = await client.query("SELECT * FROM tasks WHERE region = $1", [region]);
return result.rows;
```

At that point, the region router becomes the actual database connection handler.

---

## Adding a New Region

To serve a new geographic region (e.g., Africa, India):

### 1. Update Region Endpoints

Edit `src/services/regionRouter.ts`:

```typescript
const REGION_ENDPOINTS: Record<string, string> = {
  NA: "https://db-na.meridianlabs.internal",
  EU: "https://db-eu.meridianlabs.internal",
  APAC: "https://db-apac.meridianlabs.internal",
  LATAM: "https://db-latam.meridianlabs.internal",
  INDIA: "https://db-india.meridianlabs.internal"  // NEW
};
```

### 2. Update Region Enum

Edit `src/db.ts`:

```typescript
export interface Task {
  // ...
  region: "NA" | "EU" | "APAC" | "LATAM" | "INDIA";
  // ...
}

export interface Project {
  // ...
  region: "NA" | "EU" | "APAC" | "LATAM" | "INDIA";
  // ...
}
```

### 3. Test

```bash
npm run dev

# Test the new region
curl "http://localhost:4000/v2/tasks?region=INDIA" \
  -H "x-api-key: meridian-dev-key"

# Response should include the new endpoint
# {
#   "endpoint": "https://db-india.meridianlabs.internal",
#   "tasks": [...]
# }
```

### 4. Update Documentation

- Update this file with the new region
- Update [Data Models](../architecture/data-models.md) with the new region enum
- Update [Deployment](./deployment.md) if new region requires special config

### 5. Deploy

```bash
npm run build
npm start
```

---

## Multi-Region Architecture Decisions

### Why Region-Based Routing?

1. **Data residency** — Regulations (GDPR, CCPA) may require data to stay within specific regions
2. **Latency** — Users get faster access to nearby replicas
3. **Failure isolation** — A region's database outage doesn't affect others

### Why Failover to NA?

- NA is the most stable and geographically central replica
- APAC failover specifically targets the Singapore replica's known instability
- Other regions default to NA if unknown (safe fallback)

### Why Not Global Replication?

- Adds complexity and consistency challenges
- Current four-region setup serves Meridian Labs' current customer base

---

## Troubleshooting

### Queries to APAC are Slow

Check if Singapore replica is down:

```bash
# Manually test connectivity (if you have network access)
curl https://db-apac.meridianlabs.internal/health

# If unreachable, enable failover
export APAC_FAILOVER=1
npm start

# Monitor latency metrics
```

### New Region Returns Unknown Endpoint

If you query a region that doesn't exist:

```bash
curl "http://localhost:4000/v2/tasks?region=UNKNOWN" \
  -H "x-api-key: meridian-dev-key"

# Response includes NA endpoint (hardcoded fallback)
# {
#   "endpoint": "https://db-na.meridianlabs.internal",
#   "tasks": [...]
# }
```

Add the region to `REGION_ENDPOINTS` if it should be supported.

### APAC Failover Not Working

Verify the environment variable is set correctly:

```bash
# Check current value
echo $APAC_FAILOVER

# Set it
export APAC_FAILOVER=1

# Verify
npm start
curl "http://localhost:4000/v2/tasks?region=APAC" \
  -H "x-api-key: meridian-dev-key"

# Response should show NA endpoint even though region=APAC
# {
#   "endpoint": "https://db-na.meridianlabs.internal",
#   "tasks": [...]
# }
```

---

## Future Improvements

1. **Dynamic region configuration** — Load region endpoints from a config file or env instead of hardcoding
2. **Health checks** — Periodically ping regional endpoints to detect failures automatically
3. **Weighted routing** — Route a percentage of traffic to different replicas for A/B testing
4. **Read replicas** — Add multiple read replicas per region with load balancing
5. **Latency monitoring** — Track and log query latency per region to detect degradation
