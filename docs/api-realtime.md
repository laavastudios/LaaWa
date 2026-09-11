# Realtime API

LaaWa exposes a server-sent events stream for integrations that need live WhatsApp state, message, and inbox snapshot updates.

## Endpoint

`GET /api/v1/events?accountId={accountId}`

Authenticate with either the LaaWa session or a bearer API key with the `read` scope.

The account must belong to the authenticated workspace and, for restricted API keys, must be included in the key's WhatsApp account allow-list.

## Event types

- `state` — WhatsApp connection state changes.
- `snapshot` — current conversation snapshot.
- `message` — a newly captured or sent message.
- `sync` — history synchronization completion.

The endpoint uses standard `text/event-stream` framing and keeps the upstream worker connection open. It is implemented as a Node.js Route Handler so the web/API layer remains deployable on Netlify or Vercel while the persistent WhatsApp worker runs separately.
