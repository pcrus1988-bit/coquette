# Deployment Boundaries

COQUETTE deployments must use a dedicated deployment project and dedicated environment variables.

## Rules
- no deployment through another project's Vercel project
- no shared production environment variable set
- preview deployments originate from COQUETTE branches only
- staging and production domains belong only to COQUETTE
- production cutover requires explicit domain/DNS plan and rollback path
- deployment logs and observability must be attributable to COQUETTE independently
