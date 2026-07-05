# API Endpoints & Routes

This document describes all HTTP endpoints, query parameters, request bodies, and response shapes.

**Base path:** `/v2` (production) or `/v1` (legacy alias to `/v2/tasks`)

**Required headers on all requests:**
- `x-api-key`: API key (dev: `meridian-dev-key`, prod: set `MERIDIAN_API_KEY` env)
- `x-plan-tier` (optional): `free` | `pro` | `enterprise` (defaults to `free` for rate limiting)

---

## Tasks

Source: `src/routes/tasks.ts`

### GET /v2/tasks

List all tasks, optionally filtered by region and/or status.

**Query Parameters:**
| Parameter | Type | Optional | Example |
|-----------|------|----------|---------|
| `region` | string | Yes | `APAC`, `NA`, `EU`, `LATAM` |
| `status` | string | Yes | `todo`, `in_progress`, `done` |

**Example Request:**
```bash
curl -X GET "http://localhost:4000/v2/tasks?region=APAC&status=todo" \
  -H "x-api-key: meridian-dev-key"
```

**Response (200 OK):**
```json
{
  "endpoint": "https://db-apac.meridianlabs.internal",
  "tasks": [
    {
      "id": "t3",
      "projectId": "p3",
      "title": "Fix push notification lag",
      "status": "todo",
      "assignee": "mei",
      "region": "APAC",
      "dueDate": "2026-07-08"
    }
  ]
}
```

**Notes:**
- The `endpoint` field shows which regional database replica would be used for this query.
- If no filters are applied, returns all tasks.
- Empty result set returns `{"endpoint": "...", "tasks": []}`.

---

### GET /v2/tasks/:id

Retrieve a single task by ID.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Task ID, e.g., `t1`, `t2` |

**Example Request:**
```bash
curl -X GET "http://localhost:4000/v2/tasks/t1" \
  -H "x-api-key: meridian-dev-key"
```

**Response (200 OK):**
```json
{
  "id": "t1",
  "projectId": "p1",
  "title": "Migrate hero banner",
  "status": "in_progress",
  "assignee": "priya",
  "region": "NA",
  "dueDate": "2026-07-10"
}
```

**Response (404 Not Found):**
```json
{
  "error": "task not found"
}
```

---

### POST /v2/tasks

Create a new task.

**Request Body:**
```json
{
  "projectId": "p1",
  "title": "Update logo",
  "status": "todo",
  "assignee": "alice",
  "region": "NA",
  "dueDate": "2026-08-01"
}
```

**Response (201 Created):**
```json
{
  "id": "t5",
  "projectId": "p1",
  "title": "Update logo",
  "status": "todo",
  "assignee": "alice",
  "region": "NA",
  "dueDate": "2026-08-01"
}
```

**Notes:**
- The `id` is auto-generated as `t${length + 1}` in the current in-memory implementation.
- All fields from the request body are copied into the task; no validation of region or status values is performed.
- Production code should validate schema before storing.

---

## Projects

Source: `src/routes/projects.ts`

### GET /v2/projects

List all projects.

**Example Request:**
```bash
curl -X GET "http://localhost:4000/v2/projects" \
  -H "x-api-key: meridian-dev-key"
```

**Response (200 OK):**
```json
[
  {
    "id": "p1",
    "name": "Website Redesign",
    "plan": "pro",
    "region": "NA"
  },
  {
    "id": "p2",
    "name": "Q3 Onboarding Revamp",
    "plan": "enterprise",
    "region": "EU"
  }
]
```

---

### GET /v2/projects/:id/summary

Get a task summary (rollup) for a single project: total tasks and counts per status.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Project ID, e.g., `p1`, `p2` |

**Example Request:**
```bash
curl -X GET "http://localhost:4000/v2/projects/p1/summary" \
  -H "x-api-key: meridian-dev-key"
```

**Response (200 OK):**
```json
{
  "project": "Website Redesign",
  "plan": "pro",
  "total": 1,
  "todo": 0,
  "in_progress": 1,
  "done": 0
}
```

**Response (404 Not Found):**
```json
{
  "error": "project not found"
}
```

**Notes:**
- Commonly used by the dashboard to display project health at a glance.
- `total` equals `todo + in_progress + done`.

---

## Legacy API (v1)

**Route:** `/v1/tickets`

Maps to `/v2/tasks` router. All v2 endpoints are accessible under `/v1/tickets` for backward compatibility with pre-1.0 mobile clients. Do not remove until mobile v3 rollout completes.

Example:
```bash
curl -X GET "http://localhost:4000/v1/tickets?region=NA" \
  -H "x-api-key: meridian-dev-key"
```

---

## Error Handling

### 401 Unauthorized
Invalid or missing `x-api-key` header.
```json
{
  "error": "invalid api key"
}
```

### 404 Not Found
Resource (task, project) does not exist.
```json
{
  "error": "<resource> not found"
}
```

### 429 Too Many Requests
Rate limit exceeded for the plan tier.
```json
{
  "error": "rate limit exceeded",
  "limit": 60,
  "plan": "free"
}
```

---

## Rate Limiting Headers

Include `x-plan-tier` header to specify which rate limit tier applies:

| Header Value | Requests/min |
|--------------|--------------|
| `free` | 60 |
| `pro` | 600 |
| `enterprise` | 3000 |

If omitted, defaults to `free`. Each IP+plan-tier combination has its own 60-second sliding window.

Example:
```bash
curl -X GET "http://localhost:4000/v2/tasks" \
  -H "x-api-key: meridian-dev-key" \
  -H "x-plan-tier: pro"
```
