# LaaWa

LaaWa is a premium AI business command center designed around WhatsApp customer conversations, lead capture, appointments, automations and AI-assisted operations.

## Current foundation

- Next.js 16 App Router
- TypeScript strict mode
- Vercel-friendly server routes
- Secure HTTP-only owner session
- Premium responsive dashboard shell
- Server-side Gemini integration
- Environment-based secrets
- WhatsApp integration environment contract ready for the persistent worker layer

## Local development

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Set `LAAWA_OWNER_USERNAME`, `LAAWA_OWNER_PASSWORD`, `LAAWA_SESSION_SECRET` and `GEMINI_API_KEY`.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open `http://localhost:3000`.

## Vercel deployment

Import this repository into Vercel and add the environment variables from `.env.example`. The dashboard and server API are designed to deploy without a custom server process.

The WhatsApp Web/pairing worker is intentionally kept separate from the serverless dashboard because persistent socket sessions should not be hosted inside short-lived serverless functions. The production architecture will connect that worker to the dashboard through authenticated APIs/webhooks.

## Security

Never commit real Gemini keys, WhatsApp tokens, passwords, or session secrets. If a secret has ever been pasted into chat, source control, screenshots, or logs, rotate it before production use.
