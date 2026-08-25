# Environments

## Local
Developer-only environment. Uses local services or services dedicated to COQUETTE development.

## Staging
Pre-production COQUETTE environment for migration validation, checkout testing, content review and integration sandbox testing.

Preferred hostname: `staging.coquetteconcept.gr` (or another dedicated COQUETTE staging hostname approved later).

## Production
Live customer environment for `coquetteconcept.gr`.

Production secrets must never be stored in the repository or copied into local files. Staging and production must use separate credentials wherever the provider supports it.

## Deployment boundary
COQUETTE must have its own Vercel project. It must not be deployed through another application's Vercel project, project ID, environment-variable set or domain configuration.
