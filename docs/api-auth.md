# API Authentication

External integrations authenticate with a bearer API key:

```http
Authorization: Bearer YOUR_API_KEY
```

Use `read` for reads and realtime subscriptions, `write` for message writes, and `admin` for API credential administration. Workspace and optional WhatsApp-account restrictions are enforced by the API.

Treat API keys as secrets. Store them server-side and rotate them through the key lifecycle described in `docs/api-key-lifecycle.md`.