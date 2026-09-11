# LaaWa API Reference

LaaWa exposes a versioned HTTP API at `/api/v1` for integrations, messaging, customer data, API credentials, and realtime events.

## Base URL

```text
https://YOUR-LAAWA-HOST/api/v1
```

The same Route Handler surface is designed for Next.js deployments on Vercel and Netlify. The WhatsApp worker remains a persistent runtime and is configured separately.

## Authentication

Use a bearer API key for external integrations:

```http
Authorization: Bearer lwa_live_xxxxxxxxxxxxxxxxxxxxxxxxx
```

API keys are scoped. `read` permits reads and realtime subscriptions, `write` permits write operations, and `admin` permits credential-management operations.

Never place an API key in browser JavaScript, source control, public URLs, or client-side environment variables. Use a server-side secret store for production integrations.

## Response envelope

Successful responses use the API success envelope and include a request identifier. Errors are machine-readable and include an error code, message, and request identifier.

```json
{
  "success": true,
  "data": {},
  "requestId": "..."
}
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "..."
  },
  "requestId": "..."
}
```

## Endpoints

| Method | Endpoint | Scope | Purpose |
| --- | --- | --- | --- |
| GET | `/` | read | API capability metadata |
| GET | `/health` | public | Deployment health check |
| GET | `/openapi.json` | public | Machine-readable OpenAPI contract |
| GET | `/keys` | admin | List API keys |
| POST | `/keys` | admin | Create an API key |
| DELETE | `/keys/{id}` | admin | Revoke an API key |
| GET | `/messages` | read | Read persisted messages |
| POST | `/messages` | write | Send a message or perform a supported message action |
| GET | `/conversations` | read | List conversations |
| GET | `/conversations/{id}/messages` | read | Read conversation history |
| GET | `/contacts` | read | Search contacts |
| GET | `/events?accountId={accountId}` | read | Subscribe to realtime SSE events |

## Messaging

Example text request:

```bash
curl -X POST "https://YOUR-LAAWA-HOST/api/v1/messages" \
  -H "Authorization: Bearer $LAAWA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"ACCOUNT_ID","to":"919876543210","type":"text","body":"Hello from LaaWa"}'
```

Keep credentials on the server that calls the API. Do not expose `$LAAWA_API_KEY` to a browser.

## Conversations and contacts

Conversation and contact reads are isolated to the authenticated workspace. API keys with an account allow-list can only access the permitted WhatsApp accounts.

```bash
curl "https://YOUR-LAAWA-HOST/api/v1/conversations?limit=50" \
  -H "Authorization: Bearer $LAAWA_API_KEY"
```

```bash
curl "https://YOUR-LAAWA-HOST/api/v1/contacts?q=Acme&limit=25" \
  -H "Authorization: Bearer $LAAWA_API_KEY"
```

Conversation history supports a `limit` and optional `before` cursor timestamp for pagination.

## Realtime events

Subscribe from a server-side integration using the account identifier:

```text
GET /api/v1/events?accountId=ACCOUNT_ID
```

The endpoint returns `text/event-stream`. Events currently cover WhatsApp state, snapshots, messages, and synchronization activity. The API validates workspace and API-key account permissions before opening the upstream stream.

For long-lived connections, reconnect with exponential backoff when the connection closes. Do not create an unbounded number of concurrent subscriptions.

## OpenAPI

The authoritative machine-readable contract is served by:

```text
GET /api/v1/openapi.json
```

It can be consumed by API tooling and client generators without deploying a separate documentation service.

## Deployment

### Vercel

Connect the repository, keep the project root at `/`, use `npm run build`, and provide the variables from `.env.example`. The web/API layer can run as Next.js Route Handlers.

### Netlify

Connect the repository and use the existing `netlify.toml`. The Next.js web/API layer uses `npm run build` and the `.next` output. Configure the same production environment variables in Netlify.

### Persistent worker

The API layer does not replace the long-running WhatsApp process. Set `WHATSAPP_WORKER_URL` and `WHATSAPP_WORKER_SECRET` as appropriate when the worker is hosted separately. If using the account manager, configure `WHATSAPP_MANAGER_URL` as well.

## Security notes

- Generate a unique API key per integration.
- Give integrations the smallest required scope.
- Restrict API keys to specific WhatsApp accounts when appropriate.
- Set an expiration for temporary integrations.
- Revoke compromised keys immediately.
- Keep worker secrets and database credentials server-side.
- Treat request IDs as support/debugging identifiers, not credentials.
- Do not commit `.env` files or production secrets.

## Compatibility

The API is intentionally implemented with native Next.js Route Handlers and standard HTTP/SSE primitives so the web/API layer remains portable across supported managed Next.js hosting platforms.
