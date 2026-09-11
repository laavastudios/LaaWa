# API Client Guidance

Prefer standard HTTP clients for request/response endpoints and an SSE-capable client for `/api/v1/events`.

Treat the API base URL as configuration. Keep the bearer credential in server-side secret storage. Handle HTTP errors using status plus `error.code`, and preserve `requestId` for diagnostics.

For realtime connections, reconnect with bounded exponential backoff and jitter and avoid duplicate subscriptions.