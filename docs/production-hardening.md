# Production hardening

Set production environment secrets outside source control. Run database migrations before first use. Deploy the Next.js web/API layer to Vercel or Netlify and keep persistent WhatsApp, job, webhook, and notification workers on a process-capable runtime.

Production browser responses include clickjacking, MIME sniffing, referrer, permissions, cross-origin, HSTS, and Content Security Policy protections. The production CSP does not enable `unsafe-eval`.

Verify `/api/v1/health` and `/api/v1/openapi.json` after deployment. Use scoped API keys for integrations and keep WhatsApp authentication state and all signing/encryption secrets private.
