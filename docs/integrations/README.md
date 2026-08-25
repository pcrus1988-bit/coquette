# Integrations

Integration design documents belong here. Each integration must record:
- provider
- sandbox vs production endpoint
- credential owner
- required webhooks
- idempotency strategy
- retry/error policy
- data stored locally
- GDPR/security considerations
- test strategy
- cutover/rollback plan

Initial targets:
- PayPal
- Klarna
- AADE/myDATA
- courier/shipping provider(s)
- transactional email

All credentials and provider applications must belong to COQUETTE. General integration patterns may be reused, but not project-specific credentials or runtime state.
