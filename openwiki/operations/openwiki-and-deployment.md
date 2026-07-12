# Operations and OpenWiki Workflow

This page covers how to run, configure, deploy, and maintain documentation for `meridian-tasks-api`.

## Runtime and build commands

Source: `package.json` and `tsconfig.json`.

| Command | Purpose |
| --- | --- |
| `npm install` | Install runtime and development dependencies. |
| `npm run dev` | Run `src/index.ts` directly with `ts-node`. |
| `npm run build` | Compile TypeScript from `src/` to `dist/` with `tsc`. |
| `npm start` | Run compiled output at `dist/index.js`. |

Compiler settings are strict TypeScript, ES2022 target, CommonJS module output, `rootDir: src`, and `outDir: dist`.

## Environment variables

| Variable | Used by | Required? | Behavior |
| --- | --- | --- | --- |
| `PORT` | `src/index.ts` | Optional | Defaults to `4000`. |
| `NODE_ENV` | `src/middleware/auth.ts` | Required for production auth behavior | When exactly `production`, API key validation is strict. |
| `MERIDIAN_API_KEY` | `src/middleware/auth.ts` | Required in production | Expected value for request `x-api-key`. Store as a secret; do not commit it. |
| `APAC_FAILOVER` | `src/services/regionRouter.ts` | Optional | When set to `"1"`, APAC endpoint resolution falls back to NA. |
| `DATABASE_URL` | Commented/documented only | Not currently consumed by code | `src/db.ts` comments mention production Postgres via this variable, but no runtime database integration exists yet. |

Do not document or commit live secret values. Use secret managers or CI secrets for production keys.

## Local smoke checks

There is no automated test suite in the current repository. Basic verification after a change:

```bash
npm run build
npm run dev
```

Then exercise representative routes:

```bash
curl "http://localhost:4000/v2/tasks" \
  -H "x-api-key: meridian-dev-key"

curl "http://localhost:4000/v2/tasks?region=APAC&status=todo" \
  -H "x-api-key: meridian-dev-key" \
  -H "x-plan-tier: pro"

curl "http://localhost:4000/v2/projects/p1/summary" \
  -H "x-api-key: meridian-dev-key"
```

For APAC failover behavior:

```bash
APAC_FAILOVER=1 npm run dev
curl "http://localhost:4000/v2/tasks?region=APAC" \
  -H "x-api-key: meridian-dev-key"
```

The returned `endpoint` should be the NA endpoint when failover is enabled.

## Deployment considerations

The app can be deployed as a standard Node.js service after `npm run build`. Production process requirements:

1. Set `NODE_ENV=production`.
2. Set `MERIDIAN_API_KEY` from a trusted secret store.
3. Set `PORT` if the platform does not use `4000`.
4. Run `npm start` against built output.

Important caveats before scaling production traffic:

- Storage is in-memory; tasks created through `POST /v2/tasks` disappear on restart.
- Rate-limit counters are in-memory and process-local; multiple instances will not share quotas.
- There is no health endpoint, database connection, structured logging, metrics, or request validation layer in current source.
- `DATABASE_URL` is not read by the application yet, so configuring it alone will not enable Postgres.

## Regional operations

Region endpoint behavior lives in `src/services/regionRouter.ts`.

- Unknown regions fall back to NA.
- APAC falls back to NA only when `APAC_FAILOVER=1`.
- Source comments describe APAC fallback as a mitigation for a Singapore replica issue that can add mobile latency and appear as push notification lag.

When adding a region:

1. Add the endpoint key in `src/services/regionRouter.ts`.
2. Add the region to both `Task.region` and `Project.region` unions in `src/db.ts`.
3. Add or update seed data if needed for local smoke tests.
4. Update [Architecture overview](../architecture/overview.md) and [API reference](../architecture/api.md).
5. Run `npm run build`.

## Rate-limit operations

Current source limits in `src/middleware/rateLimit.ts`:

- `free`: 600 requests/minute
- `pro`: 800 requests/minute
- `enterprise`: 3000 requests/minute

The file comments state enterprise limits are contractual. Do not change enterprise behavior without platform-team confirmation. Recent git history shows the pro tier has been actively adjusted, so verify the desired product value before updating it.

## OpenWiki documentation workflow

Repository docs are generated under `openwiki/`. The README describes a code-mode OpenWiki workflow, and `.github/workflows/openwiki-update.yml` automates updates.

Current workflow behavior from `.github/workflows/openwiki-update.yml`:

- Workflow name: `OpenWiki Update`.
- Triggers: manual `workflow_dispatch` and a scheduled daily cron (`0 8 * * *`).
- Runner: `ubuntu-latest` with Node.js `22`.
- Installs OpenWiki globally with `npm install --global openwiki`.
- Runs `openwiki code --update --print` (no inline instruction string; the update scope is controlled by the workflow environment and agent instructions).
- Sets `OPENROUTER_API_KEY`, `OPENWIKI_MODEL_ID=z-ai/glm-5.2`, and LangSmith tracing environment variables from repository secrets/environment.
- Opens or updates branch `openwiki/update` through `peter-evans/create-pull-request`.

Current PR add paths include:

```text
openwiki
AGENTS.md
CLAUDE.md
.github/workflows/openwiki-update.yml
```

The PR scope was broadened to include agent instruction files and the workflow itself, so the update PR can reflect changes to those files alongside generated wiki content.

## Running OpenWiki locally

The README provides the repository runbook. Current high-level commands:

```bash
openwiki code --init
openwiki code --update
openwiki code --update --print "Update only repository documentation under openwiki/."
```

For repository documentation work, always use code mode. The README notes that plain `openwiki --update` defaults to personal mode, which targets the local personal brain wiki rather than this repo's `openwiki/` directory.

## Agent notes

- `AGENTS.md` and `CLAUDE.md` point future agents to `openwiki/quickstart.md` and generated docs.
- During normal OpenWiki runs, do not edit those agent instruction files unless explicitly asked.
- Generated documentation should stay under `openwiki/`.
- If source behavior and generated docs conflict, prefer inspected source code and update the wiki.
