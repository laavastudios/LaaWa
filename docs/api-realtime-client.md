# Realtime Client Pattern

Use the authenticated `/api/v1/events?accountId=ACCOUNT_ID` stream from a server-side integration.

Recommended behavior:

1. Open one subscription per required account.
2. Consume standard SSE frames.
3. Handle `state`, `snapshot`, `message`, and `sync` events.
4. Reconnect after disconnects with exponential backoff and jitter.
5. Stop reconnecting when credentials are revoked or the integration is intentionally disabled.

Keep bearer credentials outside browser-delivered source and never put them in query parameters.