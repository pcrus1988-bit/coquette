# COQUETTE Project Boundaries

## Non-negotiable isolation
COQUETTE is operated as an independent codebase and runtime.

The following must be dedicated to COQUETTE:
1. GitHub repository
2. local working directory / worktree
3. Vercel project
4. database project and credentials
5. object storage and buckets
6. environment variables and secrets
7. payment-provider applications and credentials
8. AADE/myDATA configuration and credentials
9. courier-provider credentials
10. email configuration
11. logs, monitoring, analytics and error tracking
12. documentation, issues, PRs and deployment history

## Allowed reuse
General engineering patterns, lessons learned, algorithms and integration approaches may be reimplemented.

## Forbidden reuse
No shared production database, schema, API key, secret, bucket, webhook endpoint, environment file, project ID, runtime queue, customer/vendor data or deployment configuration.
