# Initial Version Baseline

Recorded: 2026-08-25

The first runnable scaffold should follow the versions currently used by the official Medusa DTC starter rather than independently upgrading framework majors before baseline verification.

## Initial baseline
- Medusa packages: `2.19.0`
- Next.js storefront: `15.5.21`
- React storefront: `19.0.5`
- Node.js: `^20.19.0 || >=22.12.0`
- pnpm workspace: compatible with the official DTC starter baseline; repository lockfile is authoritative.

## Upgrade policy
Although newer Next.js/React/pnpm releases may exist, COQUETTE will not chase `latest` blindly.

Dependency upgrades follow this sequence:
1. establish the official Medusa DTC baseline;
2. run build, type, integration and storefront smoke tests;
3. implement COQUETTE customizations;
4. upgrade dependencies deliberately on dedicated branches;
5. accept only upgrades that pass the same gates in staging.

This policy is especially important around the commerce framework, Admin SDK, React Router and Next.js because compatibility across those packages affects both the storefront and merchant back office.
