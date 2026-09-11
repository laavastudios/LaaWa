# API Quick Start

1. Open the Developer console and create an API key.
2. Give it `read` for data access or `write` when it must send messages.
3. Store the secret in the integration server's secret manager.
4. Set the deployed host as the API base URL.
5. Call `/api/v1/health` to verify the web layer.
6. Call `/api/v1/conversations` or `/api/v1/contacts` to verify authenticated reads.
7. Call `/api/v1/messages` from a trusted server when write access is required.
8. Subscribe to `/api/v1/events?accountId=ACCOUNT_ID` when live events are needed.

The live OpenAPI contract at `/api/v1/openapi.json` is the source of truth for client tooling.