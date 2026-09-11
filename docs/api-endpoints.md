# API Endpoint Map

- `GET /api/v1/` — capability metadata
- `GET /api/v1/health` — health check
- `GET /api/v1/openapi.json` — OpenAPI contract
- `GET /api/v1/keys` — list API keys
- `POST /api/v1/keys` — create API key
- `DELETE /api/v1/keys/{id}` — revoke API key
- `GET /api/v1/messages` — read messages
- `POST /api/v1/messages` — write message/action
- `GET /api/v1/conversations` — list conversations
- `GET /api/v1/conversations/{id}/messages` — conversation history
- `GET /api/v1/contacts` — contact search
- `GET /api/v1/events?accountId={accountId}` — realtime SSE
