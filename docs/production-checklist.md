# Production deployment checklist

## Vercel / Netlify web layer

- Build command: `npm run build`
- Node.js: 20+
- PostgreSQL: set `DATABASE_URL`
- Authentication: set `LAAWA_SESSION_SECRET`, owner username, and owner password
- Encryption: set `INTEGRATION_ENCRYPTION_KEY`
- Verify `GET /api/v1/health`
- Verify `GET /api/v1/openapi.json`

The Next.js App Router and Route Handlers do not require a custom server for the web/API layer.

## Persistent services

WhatsApp Web sessions require a persistent worker process. Run these independently from the serverless web layer when enabled:

- `npm run whatsapp`
- `npm run whatsapp:manager`
- `npm run jobs`
- `npm run webhooks`
- `npm run notifications`

Set the corresponding worker URLs/secrets in the web deployment.

## Security smoke test

- Confirm HTTPS is active in production.
- Confirm response headers contain the LaaWa security policy.
- Confirm owner credentials are not committed to source.
- Create a least-privilege API key and use it for integrations.
- Confirm revoked API keys stop authenticating.
- Confirm privacy export excludes secrets and integration ciphertext.
- Confirm workspace erasure requires the exact confirmation phrase.

## No platform lock-in

The deployment does not depend on a proprietary billing layer, subscription state, credits, or artificial request quotas. PostgreSQL remains the durable application store and external persistent workers can be hosted independently.
