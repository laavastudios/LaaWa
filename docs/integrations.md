# External integrations

LaaWa keeps third-party connectors behind a small provider registry so adding a provider does not change the messaging API.

## Providers

- **Chatwoot** — configure the self-hosted or managed Chatwoot HTTPS URL, account ID, and API token. The connection test validates API access server-side.
- **WordPress** — use a WordPress Application Password. The included `integrations/wordpress/laawa.php` plugin exposes a protected `wp-json/laawa/v1/send` bridge that forwards messages to `/api/v1/messages`.
- **Webhooks** — register any HTTPS endpoint and optionally sign every dispatched payload with HMAC-SHA256. Use `POST /api/v1/integrations/{id}/dispatch` with `write` scope.

## Security

Integration configuration is encrypted with AES-256-GCM before database persistence. Set `INTEGRATION_ENCRYPTION_KEY` in production; `AUTH_SECRET` is accepted as a fallback for existing deployments. Plaintext secrets are never returned by the API.

## Deployment

The integration layer is Node-runtime Route Handlers and has no additional production package dependency, so the web layer remains compatible with Next.js deployments on Vercel and Netlify. External services are optional; an instance can run without configuring any provider.
