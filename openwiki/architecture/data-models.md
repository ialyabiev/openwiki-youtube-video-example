# Data Models

TypeScript type definitions and the shape of all data objects used in the API.

Source: `src/db.ts`

---

## Task

```typescript
interface Task {
  id: string;
  projectId: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  assignee: string;
  region: "NA" | "EU" | "APAC" | "LATAM";
  dueDate: string;
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique task identifier (e.g., `t1`, `t2`) |
| `projectId` | string | Links task to a project |
| `title` | string | Short description of the task |
| `status` | enum | Workflow state: unstarted, active, or complete |
| `assignee` | string | Person responsible (no user object, just name/ID) |
| `region` | enum | Geographic region: NA, EU, APAC, LATAM |
| `dueDate` | string | ISO 8601 date string (e.g., `2026-07-10`) |

**Seed Data:**
```typescript
const tasks: Task[] = [
  { id: "t1", projectId: "p1", title: "Migrate hero banner", status: "in_progress", assignee: "priya", region: "NA", dueDate: "2026-07-10" },
  { id: "t2", projectId: "p2", title: "Localize welcome emails", status: "todo", assignee: "jonas", region: "EU", dueDate: "2026-07-15" },
  { id: "t3", projectId: "p3", title: "Fix push notification lag", status: "todo", assignee: "mei", region: "APAC", dueDate: "2026-07-08" },
  { id: "t4", projectId: "p4", title: "Draft partner FAQ", status: "done", assignee: "carlos", region: "LATAM", dueDate: "2026-06-28" }
];
```

---

## Project

```typescript
interface Project {
  id: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  region: "NA" | "EU" | "APAC" | "LATAM";
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique project identifier (e.g., `p1`, `p2`) |
| `name` | string | Project name |
| `plan` | enum | Billing tier: free (60 req/min), pro (600 req/min), enterprise (3000 req/min) |
| `region` | enum | Geographic region for database routing |

**Seed Data:**
```typescript
const projects: Project[] = [
  { id: "p1", name: "Website Redesign", plan: "pro", region: "NA" },
  { id: "p2", name: "Q3 Onboarding Revamp", plan: "enterprise", region: "EU" },
  { id: "p3", name: "Mobile App v3", plan: "pro", region: "APAC" },
  { id: "p4", name: "Partner Portal", plan: "free", region: "LATAM" }
];
```

---

## Region Enum

Used by both Task and Project to specify geographic affinity:

```typescript
type Region = "NA" | "EU" | "APAC" | "LATAM";
```

| Code | Name | Database Endpoint |
|------|------|-------------------|
| `NA` | North America | `https://db-na.meridianlabs.internal` |
| `EU` | Europe | `https://db-eu.meridianlabs.internal` |
| `APAC` | Asia-Pacific | `https://db-apac.meridianlabs.internal` |
| `LATAM` | Latin America | `https://db-latam.meridianlabs.internal` |

See [Operations › Region Router](../operations/region-router.md) for routing and failover logic.

---

## Plan Tier Enum

Used by Project (and validated by rate limiting middleware) to determine request allowance:

```typescript
type PlanTier = "free" | "pro" | "enterprise";
```

| Plan | Requests/min | Notes |
|------|--------------|-------|
| `free` | 60 | Default if not specified |
| `pro` | 600 | Standard tier |
| `enterprise` | 3000 | Contractual; confirm with platform team before changes |

Enterprise limits are contractual commitments. Do not change without coordination.

---

## Status Enum

Tracks task workflow state:

```typescript
type TaskStatus = "todo" | "in_progress" | "done";
```

| Status | Meaning |
|--------|---------|
| `todo` | Task not yet started |
| `in_progress` | Task is actively being worked on |
| `done` | Task is complete |

---

## Storage & Retrieval

**Current (in-memory):**
- `tasks` and `projects` exported as mutable arrays from `db.ts`
- Routes directly mutate arrays (e.g., `tasks.push(...)`)
- No persistence; data lost on restart

**Production (future):**
- Replace arrays with PostgreSQL queries
- Add indexes on `region`, `status`, `projectId` for fast filtering
- Use connection pooling

---

## Data Validation

Currently **not validated**. The API accepts any JSON structure in POST/PUT bodies. Production should:

1. Validate enum fields (`region`, `status`, `plan`) against allowed values
2. Require all mandatory fields
3. Sanitize string fields
4. Validate date format (ISO 8601)
5. Enforce foreign key constraints (e.g., `projectId` must exist)

See [Middleware](./middleware.md) for where validation should be added.
