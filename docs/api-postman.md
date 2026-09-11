# API Client Setup

LaaWa exposes a standard HTTP API and an OpenAPI contract at `/api/v1/openapi.json`.

For API clients that support OpenAPI import, use the live OpenAPI endpoint from your deployed instance. Configure a bearer token variable from a server-side secret rather than hard-coding credentials.

For SSE clients, use `/api/v1/events?accountId=ACCOUNT_ID` with the same bearer credential and reconnect with exponential backoff after disconnects.