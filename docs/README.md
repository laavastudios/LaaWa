# LaaWa Documentation

This folder contains the notes and references for the LaaWa application.

## What LaaWa is

LaaWa is a self-hosted business app built around WhatsApp. It includes messaging, multiple WhatsApp accounts, contacts, customer data, analytics, AI features, automations, broadcasts, jobs, integrations, notifications, realtime events, privacy controls, plugins and developer APIs.

There are no billing, subscription, credit or usage-limit features in the product.

## Main areas

- Dashboard and inbox
- Contacts and customer 360
- Analytics and intelligence
- Automation Studio and Visual Automation
- Jobs and scheduling
- Business tools
- WhatsApp account management
- Settings
- AI Studio / Gemini

## Developer features

- Versioned REST API at `/api/v1`
- API keys and scopes
- Messaging, conversations and contacts APIs
- Server-Sent Events at `/api/v1/events`
- OpenAPI at `/api/v1/openapi.json`
- WhatsApp engine selection and control
- TypeScript, Python and PHP SDKs
- n8n node
- Chatwoot integration
- WordPress connector/plugin
- Signed HTTPS webhooks
- Browser push and optional SMTP notifications
- Prometheus-compatible metrics
- Privacy export, retention and erasure
- Plugin installation, permissions and signed events

## Implementation history

### Step 1 — API foundation

Versioned API routes, request IDs, common responses, headers, session helpers, a health endpoint and deployment configuration for Vercel/Netlify.

### Step 2 — API keys

Hashed API keys with scopes, optional expiry, revocation, optional WhatsApp-account restrictions and one-time secret display. Includes the Developer API Key page.

### Step 3 — Messaging API

Message sending/listing, conversations, message history and contacts, with account-aware engine routing and OpenAPI coverage.

### Step 4 — Realtime SSE

`/api/v1/events` provides authenticated account-scoped Server-Sent Events. Persistent upstream workers handle the WhatsApp side of the stream.

### Step 5 — API documentation

OpenAPI support and an in-app API documentation page.

### Step 6 — Multi-engine support

WhatsApp engine descriptors, account engine selection, engine-aware routing and the Engine Control Center. Persistent WhatsApp processes stay outside the serverless web runtime.

### Step 7 — SDKs

TypeScript, Python and PHP SDK foundations for the `/api/v1` HTTP API.

### Step 8 — n8n

An n8n community node with credentials and operations for messaging, engine discovery and health checks.

### Step 9 — External integrations

Chatwoot, WordPress and generic HTTPS webhooks. Integration settings are encrypted, and webhook requests use HMAC-SHA256 signatures.

### Step 10 — Notifications

Persistent notifications, browser push, optional SMTP email, preferences, rules, severity, channels and cooldowns.

### Step 11 — Metrics

Workspace-scoped metrics, Prometheus output, JSON snapshots and an Observability page.

### Step 12 — Privacy controls

Privacy policy and retention controls, workspace data inventory, JSON export, cleanup and confirmed workspace child-data deletion with audit records.

### Step 13 — Plugins

Plugin catalog and installation storage, encrypted settings/secrets, permissions, event subscriptions and signed HTTPS event delivery.

### Step 14 — UI and security work

The command-center UI was updated with the current visual treatment, responsive behavior and reduced-motion support. Browser security headers, CSP, recovery pages and deployment notes were also added.

## Runtime architecture

```text
Browser
  ↓
Next.js dashboard + API
  ↓
PostgreSQL
  ↓
Persistent Node workers
  ├─ Multi-WhatsApp manager / WhatsApp worker
  ├─ Durable jobs worker
  └─ Webhook delivery worker
```

Vercel and Netlify can host the Next.js web/API layer. Persistent WhatsApp and background workers need a long-running Node.js process.

## Local development

```bash
npm install
npm run db:migrate
npm run laawa
```

`npm run laawa` starts the migration check, WhatsApp manager, durable jobs worker, webhook delivery worker and Next.js development server.

Web app: `http://localhost:3000`

## Environment

Copy `.env.example` to your local environment and set the variables needed for the features you use. Do not commit real secrets.

## Database migrations

Migrations live in `db/migrations/`.

```bash
npm run db:migrate
```

Run migrations before testing database-backed features after a fresh checkout.

## API reference

- API root: `/api/v1`
- Health: `/api/v1/health`
- OpenAPI: `/api/v1/openapi.json`
- API keys: `/api/v1/keys`
- Messaging: `/api/v1/messages`
- Conversations: `/api/v1/conversations`
- Contacts: `/api/v1/contacts`
- Realtime: `/api/v1/events`
- Engines: `/api/v1/engines`
- Integrations: `/api/v1/integrations`
- Notifications: `/api/v1/notifications`
- Metrics: `/api/v1/metrics`
- Privacy: `/api/v1/privacy`
- Plugins: `/api/v1/plugins`

## Developer pages

The app has dedicated pages for API keys, API docs, engines, SDKs, n8n, integrations, notifications, observability, privacy and plugins.

## Documentation files

- `api-engines.md` — engine API
- `api-realtime.md` — SSE API
- `n8n.md` — n8n integration
- `integrations.md` — external integrations
- `notifications.md` — notification system
- `observability.md` — metrics and Prometheus
- `privacy.md` — privacy and data controls
- `plugins.md` — plugin architecture
- `plugin-event-verification.md` — HMAC event verification
- `plugin-example.json` — plugin manifest example
- `sdk.md` — TypeScript/Python/PHP SDKs
- `deployment-hardening.md` — deployment notes
- `production-hardening.md` — production guidance
- `production-checklist.md` — production checklist
- `premium-hardening.md` — UI/security notes
- `premium-hardening-checklist.md` — hardening checklist
- `step-14.md` — Step 14 scope

## Deployment

### Vercel

Use the repository configuration and set the production environment variables. Run persistent WhatsApp and worker processes on a long-running Node.js host.

### Netlify

Use the existing `netlify.toml` configuration and Node 20. Keep persistent WhatsApp and worker processes separate from Netlify.

### Full local / server deployment

Use `npm run laawa` for the combined local launcher, or run individual workers when they need to be separate services.

## Security notes

- Owner sessions are HTTP-only.
- API keys are stored as hashes and are shown only when created.
- Integration and plugin secrets are encrypted at rest.
- Plugin callbacks use HTTPS and block common local/private targets.
- Webhooks and plugin events are signed.
- Workspace access is checked by the versioned API.
- Privacy exports do not include credential material.
- Production CSP does not allow `unsafe-eval`.
- Browser security headers cover framing, MIME sniffing, referrer and permissions.

## Deployment smoke test

At minimum, check:

1. Owner login and session persistence.
2. Database migrations.
3. WhatsApp login and reconnect.
4. Incoming message persistence.
5. Outgoing messages from the correct account.
6. Conversation and contact creation.
7. API key creation and scoped access.
8. Realtime events.
9. Jobs and scheduled work.
10. Webhook delivery and retries.
11. Notifications.
12. Analytics and metrics.
13. Automation execution.
14. Plugin signature verification.
15. Privacy export, retention and erasure.
16. `npm run build`.
17. Web deployment and separately hosted persistent workers.

## Next work

The next engineering work is around persistent worker infrastructure, queue retries, realtime fan-out, broadcast processing, automation reliability, rate limiting and end-to-end tests.
