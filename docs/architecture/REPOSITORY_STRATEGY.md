# Repository Strategy

## Repository
GitHub repository: `pcrus1988-bit/coquette`.

Visibility: public by owner decision. This makes secret hygiene and private-data exclusion mandatory.

## Branching
- `main` — releasable branch
- `feature/*` — product work
- `fix/*` — defects
- `chore/*` — maintenance/infrastructure

Preview deployments should be generated from non-main branches.

## Main protection target
Once CI exists, configure:
- pull request required before merge
- required CI checks
- no force-push to `main`
- no branch deletion of `main`
- squash merge preferred

## Commit rule
Do not commit secrets, customer data, source-shop private exports or production credentials. Migration source files with personal or sensitive data belong in dedicated private storage, not Git.
