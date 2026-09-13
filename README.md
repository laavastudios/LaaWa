<div align="center">

<img src="docs/assets/laawa-hero.svg" alt="LaaWa — WhatsApp-first business command center" width="100%" />

# LaaWa

### WhatsApp-first business command center

**Conversations · Customers · AI · Automation · Integrations · Developer Platform**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Backed-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-8e7cff)](LICENSE)

**Made in India · Developed with love by LaavaBee**

</div>

---

## What is LaaWa?

LaaWa is an open-source, self-hosted business platform built around WhatsApp.

The goal is simple: keep conversations, contacts, customer history, AI tools, automation, background jobs and integrations in one place instead of spreading them across different services.

The main flow is:

**Message → understand → act → automate → keep track**

It is built for WhatsApp-first businesses, support and sales teams, developers, and teams that want to keep control of their own data and runtime.

## What is included

- WhatsApp inbox and account-aware message routing
- Contacts and customer history
- Customer 360
- Analytics
- AI tools and Gemini integration
- Broadcasts
- Scheduled and event-driven automation
- Visual workflows
- Durable background jobs
- Webhooks and integrations
- Browser push and optional SMTP notifications
- Versioned HTTP API and API keys
- Realtime events through Server-Sent Events
- TypeScript, Python and PHP SDK foundations
- n8n integration
- Plugins
- Prometheus-compatible metrics
- Data export, retention and workspace deletion controls

<img src="docs/assets/README-flow.svg" alt="LaaWa workflow" width="100%" />

---

## Architecture

<img src="docs/assets/README-architecture.svg" alt="LaaWa architecture" width="100%" />

```text
Browser
   │
   ▼
Next.js dashboard + /api/v1
   │
   ▼
PostgreSQL
   │
   ├── WhatsApp manager / worker
   ├── Jobs worker
   ├── Webhook worker
   └── Notification worker
```

The web/API layer can run on Vercel or Netlify. WhatsApp sessions and background workers need a persistent Node.js process, so they run separately from the serverless web layer.

PostgreSQL stores the business data and durable job state.

### Background jobs

Jobs are stored in PostgreSQL rather than treated as fire-and-forget requests. The worker system includes:

- `FOR UPDATE SKIP LOCKED` job claiming
- Retry backoff
- Stale-worker recovery
- Failed/dead-letter state
- Execution history
- Idempotency keys
- Durable webhook delivery
- HMAC-signed webhooks
- Request IDs and structured API errors

---

## WhatsApp

WhatsApp connectivity is kept behind an engine interface so the rest of the application is not tied to one transport.

The current persistent implementation uses `whatsapp-web.js`.

Each account has its own session identity. When a reply is sent, LaaWa resolves the conversation's account first so messages are not accidentally sent through another account.

---

## API

The public API lives under `/api/v1`.

```text
/api/v1/health
/api/v1/openapi.json
/api/v1/keys
/api/v1/messages
/api/v1/conversations
/api/v1/contacts
/api/v1/events
/api/v1/engines
/api/v1/integrations
/api/v1/notifications
/api/v1/metrics
/api/v1/privacy
/api/v1/plugins
```

API keys support `read`, `write` and `admin` scopes.

---

## Developer tools

### SDKs

SDK foundations are included for TypeScript, Python and PHP. They use the HTTP API and do not run the WhatsApp worker inside client applications.

### n8n

An n8n community-node package provides operations for messaging, engine information and health checks.

### Integrations

Integration foundations currently include Chatwoot, WordPress and generic HTTPS webhooks.

Webhook requests use HMAC-SHA256 signatures through the `x-laawa-signature` header.

### Plugins

Plugins have scoped permissions and signed event delivery for supported LaaWa events.

---

## Notifications and observability

Notifications can use browser push or optional SMTP email. Credentials stay on the server.

The metrics layer exposes Prometheus-compatible data and JSON snapshots for accounts, messages, conversations, broadcasts, jobs, webhooks, notifications and automations.

The point is practical: you should be able to tell whether the system is healthy and where work is getting stuck.

---

## Privacy and security

LaaWa includes:

- Transactional JSON export
- Retention cleanup
- Workspace erasure
- Sensitive-credential exclusion from exports
- Audit records for destructive operations
- HTTP-only owner sessions
- Hashed API credentials
- Scoped authorization
- Encrypted integration and plugin secrets
- HTTPS-only external callbacks
- HMAC signatures for webhooks and plugins
- CSP and security headers
- HSTS in production
- Sensitive-response cache controls

Never commit real API keys, database credentials, worker secrets, session secrets, VAPID private keys, SMTP credentials or encryption keys.

If a secret is exposed, rotate it before using the affected environment again.

See [`SECURITY.md`](SECURITY.md) for the security policy.

---

## Deployment

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/laavastudios/LaaWa)

Vercel can host the Next.js dashboard and API layer.

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/laavastudios/LaaWa)

The repository includes `netlify.toml` and targets Node 20 for the web build.

### Important

The web deployment does not replace the persistent workers. A production setup needs the web/API layer plus a long-running runtime for WhatsApp and background jobs.

See [`DEPLOY.md`](DEPLOY.md) for deployment notes.

---

## Run locally

### Requirements

- Node.js 20+
- PostgreSQL or Supabase
- Gemini API key for AI features
- Persistent Node.js runtime for WhatsApp and background workers

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

To start the complete local stack:

```bash
npm run laawa
```

Individual workers:

```bash
npm run whatsapp
npm run whatsapp:manager
npm run jobs
npm run webhooks
npm run notifications
```

---

## Project structure

```text
LaaWa/
├── app/                  # Next.js application and API routes
├── components/           # Shared UI
├── lib/                  # Auth, DB, API, engines and platform logic
├── worker/               # WhatsApp and background workers
├── scripts/              # Local scripts and migrations
├── db/                   # PostgreSQL migrations
├── integrations/         # External integrations
├── sdk/                  # SDK packages
├── docs/                 # Documentation and visual assets
├── public/               # Public assets
├── netlify.toml          # Netlify configuration
├── next.config.ts        # Next.js configuration
├── SECURITY.md           # Security policy
├── DEPLOY.md             # Deployment notes
└── LICENSE               # MIT license
```

## Documentation

- [`docs/README.md`](docs/README.md) — technical notes
- [`DEPLOY.md`](DEPLOY.md) — deployment
- [`SECURITY.md`](SECURITY.md) — security policy
- [`docs/sdk.md`](docs/sdk.md) — SDK information
- `/developer` — Developer Center
- `/developer/docs` — API documentation
- `/api/v1/openapi.json` — OpenAPI document
- `/platform` — Platform features

## Visual assets

The README uses custom LaaWa SVGs:

- `docs/assets/laawa-hero.svg` — product hero
- `docs/assets/README-flow.svg` — workflow
- `docs/assets/README-architecture.svg` — architecture
- `docs/assets/README-platform.svg` — platform overview

---

## Why LaaWa exists

**Own the data.** Business data should live somewhere you control.

**Keep WhatsApp persistent.** A WhatsApp session should not depend on a short-lived serverless request.

**Make background work recoverable.** Retries, idempotency and execution history matter when a job fails halfway through.

**Keep the API usable.** The same system should work for people and other software.

**Keep sensitive things on the server.** Provider keys, integration secrets and worker credentials should never reach the browser.

**Keep the core usable.** Developer and infrastructure features belong in Platform instead of turning the main workspace into a settings dump.

---

## Open source

LaaWa is released under the MIT License. You can use it, study it, modify it and self-host it according to [`LICENSE`](LICENSE).

If you use LaaWa or build something substantial on top of it, crediting LaavaBee / Laava Studios and linking back to this repository is appreciated.

> Built with [LaaWa](https://github.com/laavastudios/LaaWa) by LaavaBee / Laava Studios.

The MIT copyright and permission notice must remain with copies or substantial portions of the software.

---

<div align="center">

## LaaWa

**One place for WhatsApp conversations, customers and business automation.**

[Star LaaWa on GitHub](https://github.com/laavastudios/LaaWa) · [Explore the code](https://github.com/laavastudios/LaaWa/tree/main)

**Made in India · Developed with love by LaavaBee**

</div>
