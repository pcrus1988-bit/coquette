# Secrets Handling

COQUETTE secrets must live only in approved secret stores or provider dashboards, never in Git.

## Rules
- `.env` files remain local and ignored
- GitHub contains only `.env.example` placeholders
- staging and production credentials are separated where supported
- credentials are COQUETTE-specific
- leaked credentials are rotated immediately
- secret values are never pasted into documentation, issues, pull requests or commit messages
