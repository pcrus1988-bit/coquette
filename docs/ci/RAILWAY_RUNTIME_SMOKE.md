# Railway production-runtime smoke gate

The full COQUETTE CI builds the deployable Medusa artifact and then exercises the same backend lifecycle used by Railway:

1. run the backend pre-deploy migration command;
2. start the built production artifact through the Railway start wrapper;
3. require an HTTP 2xx response from `/health`;
4. fail closed if the runtime exits or never becomes healthy.

The health contract intentionally validates HTTP success rather than a hard-coded response body. Medusa owns the exact health payload shape; COQUETTE's deployment requirement is that the production artifact starts and serves a successful health response.

This gate was added after a controlled Railway release produced a backend deployment failure while the worker and all build/contract checks succeeded. It closes the prior gap between “artifact builds” and “server artifact actually starts.”
