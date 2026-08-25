# Security Policy

COQUETTE's repository is public. Treat every committed byte as publicly readable.

## Never commit
- passwords, API keys, tokens or private keys
- `.env` files or production configuration
- database URLs or credentials
- payment-provider credentials
- AADE/myDATA credentials
- courier or email credentials
- customer, order or account data
- Magento exports containing private or personal data
- private certificates, webhook secrets or signing keys

Use `.env.example` only for variable names and non-sensitive placeholders.

## Project isolation
Credentials, data, storage, databases, deployments and runtime configuration must be dedicated to COQUETTE. Do not reuse project-specific secrets or runtime state from any other project.

## Incident rule
If a secret is ever committed, treat it as compromised: revoke/rotate it immediately and remove it from active use. Removing it from Git history alone is not sufficient.
