# Server-Sent Events

`GET /api/v1/events?accountId=ACCOUNT_ID` returns an authenticated `text/event-stream` response.

Required scope: `read`.

The stream is authorized against the caller's workspace and API-key account restrictions before the connection is established. Clients should reconnect with exponential backoff and jitter after transient disconnects.
