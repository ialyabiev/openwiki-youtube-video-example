# OpenWiki Documentation Index

This is a complete reference of all documentation pages in the OpenWiki.

## Quick Navigation

**Start here:** [openwiki/quickstart.md](quickstart.md)

## Documentation Pages

### Architecture (`architecture/`)
- **[overview.md](architecture/overview.md)** — System design, request flow, architectural layers, data storage
- **[api.md](architecture/api.md)** — All HTTP endpoints, query parameters, request/response examples, error handling
- **[data-models.md](architecture/data-models.md)** — TypeScript interfaces for Task/Project, enums for Region/Plan/Status
- **[middleware.md](architecture/middleware.md)** — Authentication, rate limiting, middleware stack ordering

### Operations (`operations/`)
- **[deployment.md](operations/deployment.md)** — Build, environment variables, Docker/Kubernetes, scaling, monitoring
- **[region-router.md](operations/region-router.md)** — Multi-region database routing, APAC failover logic, adding new regions

## Documentation Statistics

- **Total pages:** 7 (plus this index)
- **Total lines:** ~1,400
- **Sections:** Architecture (4 pages), Operations (2 pages)
- **Code examples:** 40+
- **Tables:** 20+

## How to Use This Wiki

1. **New to the project?** Start with [quickstart.md](quickstart.md)
2. **Want to call an API?** Go to [architecture/api.md](architecture/api.md)
3. **Building new features?** Read [architecture/overview.md](architecture/overview.md)
4. **Deploying to production?** See [operations/deployment.md](operations/deployment.md)
5. **Debugging multi-region issues?** Check [operations/region-router.md](operations/region-router.md)

## Key Concepts Quick Reference

- **Regions:** NA, EU, APAC, LATAM (see [region-router.md](operations/region-router.md))
- **Plan Tiers:** free (60 req/min), pro (600 req/min), enterprise (3000 req/min)
- **Task Status:** todo, in_progress, done
- **API Versions:** v2 (current), v1 (legacy alias for mobile)
- **Auth:** x-api-key header (dev: meridian-dev-key, prod: MERIDIAN_API_KEY env)

## Maintenance Notes

- Last updated: 2025-01-03
- Git commit: 834776bf6b93a2c7011d64ac1ac36f45d7e5cba2
- Status: Complete initial documentation
