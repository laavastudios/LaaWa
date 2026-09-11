# LaaWa deployment

LaaWa is a Next.js application and is prepared for Git-connected deployment on Vercel and Netlify.

## Vercel

Import the repository into Vercel and keep the project root as `/`.

- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`
- Node.js: 20+

Set the variables from `.env.example` in the deployment project's Environment Variables before the first production deploy.

## Netlify

Import the repository into Netlify. The repository already contains `netlify.toml` with the Next.js build configuration.

- Build command: `npm run build`
- Publish directory: `.next`
- Node.js: 20+

Set the same environment variables in Netlify's project environment settings.

## Runtime architecture

The web/API layer is deployable on managed Next.js platforms. The WhatsApp worker and long-running background processes are separate processes and require a persistent Node.js runtime. Configure their public/internal URLs through the worker environment variables when deploying the complete self-hosted stack.

The deployment health check is available at `/api/v1/health` and does not require dashboard authentication, so a platform deployment can be smoke-tested immediately after the web layer is live.

## Required production secrets

Never commit production values. Generate unique values for:

- `LAAWA_SESSION_SECRET`
- `LAAWA_OWNER_USERNAME`
- `LAAWA_OWNER_PASSWORD`
- `DATABASE_URL`
- `WHATSAPP_WORKER_SECRET`

Add provider-specific worker URLs when the worker is hosted separately.
