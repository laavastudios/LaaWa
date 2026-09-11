# LaaWa

LaaWa is a premium AI business command center designed around WhatsApp customer conversations, lead capture, appointments, automations and AI-assisted operations.

## Platform foundation

- Next.js 16 App Router
- TypeScript strict mode
- Vercel and Netlify compatible web/API layer
- Secure HTTP-only owner session
- Premium responsive dashboard shell
- 3D motion, depth transitions and reduced-motion fallbacks
- Server-side Gemini integration
- PostgreSQL-backed business, platform, automation and durable job data
- Persistent scheduled messages with daily/weekly recurrence and IANA timezone validation
- Worker-safe PostgreSQL job claiming with `FOR UPDATE SKIP LOCKED`
- Retry with exponential backoff, stale-worker recovery and dead-letter/failed state
- Idempotency keys and execution history
- Scoped API keys with hashing, expiry support and revocation
- HTTPS webhooks with encrypted delivery secrets and durable retry processing
- Audit trail and operational platform console
- Multi-WhatsApp persistent worker manager with isolated sessions
- Persistent WhatsApp worker kept separate from serverless hosting

## One-click web deployment

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/laavastudios/LaaWa)

Vercel auto-detects Next.js. Add the production environment variables from `.env.example` before enabling database-backed and AI features.

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/laavastudios/LaaWa)

Netlify uses the repository's `netlify.toml`, `npm run build`, and `.next` output. Node 20 is pinned for consistent builds.

## Local development

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Set `LAAWA_OWNER_USERNAME`, `LAAWA_OWNER_PASSWORD`, `LAAWA_SESSION_SECRET` and the required AI/database/worker variables.
4. Run `npm install`.
5. Run `npm run dev` for the web app, or `npm run laawa` for the web app plus the persistent WhatsApp manager, durable jobs and webhook delivery workers.
6. Open `http://localhost:3000`.

For database-backed features, run `npm run db:migrate` after setting `DATABASE_URL`.

## Production architecture

The Next.js dashboard and API routes are designed for serverless deployment. The persistent WhatsApp manager, durable jobs worker and webhook delivery worker remain separate long-running Node services. PostgreSQL is the source of truth for durable work and webhook delivery, so queued work survives web restarts and worker restarts. Connect the worker services to the deployed dashboard using the configured worker URL and secret.

Do not expect Vercel or Netlify serverless functions to replace the persistent WhatsApp, durable-jobs or webhook-delivery processes.

## Security

Never commit real Gemini keys, WhatsApp tokens, passwords, database URLs, worker secrets, or session secrets. If a secret has ever been pasted into chat, source control, screenshots, or logs, rotate it before production use.

Never delete `.whatsapp-session` from a running local worker if you need to preserve its WhatsApp pairing.