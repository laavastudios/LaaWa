# API Deployment

## Vercel

Connect the repository as a Next.js project. Use the repository root, `npm run build`, and Node.js 20+. Configure the variables from `.env.example` in the project environment.

## Netlify

Connect the repository and use the existing `netlify.toml`. Use `npm run build` and keep the Next.js output configuration supplied by the repository.

## Worker architecture

The web/API layer is portable to managed Next.js hosting. WhatsApp Web and long-running workers require a persistent Node.js runtime and should be hosted separately when the managed platform does not provide that runtime model.

After deployment, verify `/api/v1/health` before configuring external integrations.
