# Production hardening

LaaWa's web/API layer is designed for direct deployment to Vercel or Netlify with PostgreSQL as the durable data store. The WhatsApp worker remains a persistent process and should run on a worker-capable host when WhatsApp connectivity is required.

## Required production configuration

Set these values in the deployment environment:

- `DATABASE_URL` — pooled PostgreSQL runtime connection string.
- `LAAWA_SESSION_SECRET` — long random secret used to sign sessions.
- `LAAWA_OWNER_USERNAME` / `LAAWA_OWNER_PASSWORD` — initial owner credentials.
- `INTEGRATION_ENCRYPTION_KEY` — long random secret for encrypted integration settings; if omitted, `AUTH_SECRET` is used by the integration layer.

For a remote WhatsApp worker, also set `WHATSAPP_WORKER_URL` and `WHATSAPP_WORKER_SECRET`. For the multi-account manager, set `WHATSAPP_MANAGER_URL` and its worker secret.

## Browser security

Production responses include content-type sniffing protection, clickjacking protection, strict referrer policy, restrictive Permissions Policy, COOP/CORP, legacy cross-domain policy protection, HSTS, and a Content Security Policy. `unsafe-eval` is enabled only during development because production Next.js does not need it.

## Data and secrets

Never commit `.env`, session directories, WhatsApp authentication state, API-key plaintext, integration ciphertext, or private signing keys. Rotate `LAAWA_SESSION_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, worker secrets, and notification private keys independently when exposure is suspected.

## Deployment checklist

1. Run `npm install`.
2. Run `npm run db:migrate` against the production PostgreSQL database once before first use.
3. Run `npm run build` and `npm start` locally with production environment variables for a final smoke test.
4. Deploy the Next.js web/API layer to Vercel or Netlify.
5. Run persistent workers separately where required: WhatsApp, manager, durable jobs, webhooks, and notifications.
6. Confirm `/api/v1/health` and `/api/v1/openapi.json` after deployment.
7. Create a scoped API key rather than sharing owner credentials with integrations.

No billing service, subscription system, usage meter, credits, or artificial quota is required for deployment.
