# Multi-engine WhatsApp architecture

LaaWa keeps the public messaging API independent from the WhatsApp runtime used by an account.

## Engines

- `whatsapp-web.js` — default local runtime used by the existing worker and multi-account manager.
- `baileys` — optional remote adapter selected through `BAILEYS_WORKER_URL`.

The optional engine is intentionally not imported by the Next.js application. This keeps Vercel and Netlify builds free from a long-lived WhatsApp runtime dependency.

## Adapter contract

An engine adapter exposes the same transport surface:

- `GET /accounts/{sessionKey}/status`
- `GET /accounts/{sessionKey}/messages`
- `POST /accounts/{sessionKey}/send`
- `GET /accounts/{sessionKey}/events` as Server-Sent Events

The web/API layer resolves an account's `engine` and routes requests without exposing engine-specific API endpoints to integrations.

## Deployment

Deploy the Next.js web/API layer to Vercel or Netlify and run persistent WhatsApp engines on a worker host. Set `BAILEYS_WORKER_URL` only when a compatible Baileys adapter is available.
