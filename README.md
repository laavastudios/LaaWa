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
- PostgreSQL-backed business, platform and automation data
- Scoped API keys with hashing, expiry support and revocation
- HTTPS webhooks with stored signing-secret hashes
- Audit trail and operational platform console
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
5. Run `npm run dev` for the web app, or `npm run laawa` for the web app plus the persistent WhatsApp worker.
6. Open `http://localhost:3000`.

For database-backed features, run `npm run db:migrate` after setting `DATABASE_URL`.

## Production architecture

The Next.js dashboard and API routes are designed for serverless deployment. The persistent WhatsApp Web worker remains a separate long-running service because the WhatsApp session must survive individual HTTP requests and deployments. Connect the worker to the deployed dashboard using `WHATSAPP_WORKER_URL` and `WHATSAPP_WORKER_SECRET`.

Do not expect Vercel or Netlify serverless functions to replace that persistent worker process.

## Security

Never commit real Gemini keys, WhatsApp tokens, passwords, database URLs, worker secrets, or session secrets. If a secret has ever been pasted into chat, source control, screenshots, or logs, rotate it before production use.

Never delete `.whatsapp-session` from a running local worker if you need to preserve its WhatsApp pairing.
