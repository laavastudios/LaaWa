# Multi-engine WhatsApp architecture

LaaWa keeps the public messaging contract independent from the WhatsApp runtime used by an account.

## Engines

- `whatsapp-web.js` — default local runtime. Existing workers and the multi-account manager continue to use this engine.
- `baileys` — remote adapter. Set `BAILEYS_WORKER_URL` to an HTTP worker exposing the same account transport contract before assigning accounts to it.

The application does not import the optional Baileys package. This keeps Next.js builds compatible with Vercel and Netlify while allowing the persistent runtime to live on a worker host.

## Account selection

`whatsapp_accounts.engine` stores the runtime selection. Existing rows are already compatible because the core schema defaults the field to `whatsapp-web.js`.

The v1 API resolves the account engine before sending a request. The same selection is used by messaging and realtime event streaming, so integrations do not need engine-specific endpoints.

## Adapter contract

An engine adapter should expose the worker contract consumed by the API:

- `GET /accounts/{sessionKey}/status`
- `GET /accounts/{sessionKey}/messages`
- `POST /accounts/{sessionKey}/send`
- `GET /accounts/{sessionKey}/events` as Server-Sent Events

Requests are authenticated with `WHATSAPP_WORKER_SECRET` when configured.

## Deployment

Deploy the Next.js web/API application to Vercel or Netlify. Run the persistent WhatsApp runtime separately. For an optional Baileys runtime, configure `BAILEYS_WORKER_URL` on the web/API deployment and expose the adapter endpoints above from the worker host.

No billing, quota, credit, or subscription layer is required by the engine architecture.
