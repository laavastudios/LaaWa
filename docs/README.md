# LaaWa Documentation

This is the complete implementation index for the LaaWa platform. It records the capabilities delivered through Steps 1–14, the important architecture boundaries, local operation, deployment, and the developer-facing extension surfaces.

## What LaaWa is

LaaWa is a self-hosted AI business command center built around WhatsApp operations. It combines messaging, multi-account WhatsApp connectivity, CRM/customer context, analytics, AI, automations, broadcasts, jobs, integrations, notifications, realtime APIs, privacy controls, plugins, SDKs, and operational tooling.

There are no billing, subscription, credits, quota, or artificial usage-limit systems in the product.

## Platform map

### Core workspace

- Overview / command center
- Inbox and conversation management
- Contacts
- Customer 360
- Analytics
- Intelligence
- More Features
- Automation Studio
- Visual Automation
- Jobs / scheduling
- Business tools
- Platform controls
- AI Studio / Gemini
- WhatsApp connection and account management
- Settings

### Developer platform

- Versioned REST API under `/api/v1`
- API authentication and scoped API keys
- Messaging API
- Conversations and contacts API
- Realtime SSE events
- OpenAPI document at `/api/v1/openapi.json`
- Multi-engine control
- TypeScript, Python and PHP SDK foundations
- n8n community-node integration
- Chatwoot integration
- WordPress connector/plugin
- Generic signed HTTPS webhooks
- Browser push and optional SMTP notifications
- Prometheus-compatible metrics
- Privacy export, retention and erasure controls
- Plugin catalog, installation, permissions and signed event delivery

## Implementation history

### Step 1 — API architecture foundation

Delivered the versioned API foundation, request IDs, common success/error responses, API headers, session authentication helpers, health endpoint, deployment configuration and Vercel/Netlify web/API compatibility.

### Step 2 — API authentication and API keys

Delivered hashed API credentials, scopes (`read`, `write`, `admin`), optional expiration, revocation, optional WhatsApp-account restrictions, secure one-time secret display and the Developer API Key center.

### Step 3 — Messaging API

Delivered versioned message sending/listing, conversation access, conversation message history and contacts access, with engine-aware account routing and developer documentation/OpenAPI coverage.

### Step 4 — Realtime SSE

Delivered `/api/v1/events` for authenticated account-scoped Server-Sent Events, including persistent upstream worker/manager streaming and appropriate no-cache/SSE response behavior.

### Step 5 — API documentation

Delivered the OpenAPI contract and the in-product Developer API Documentation center. The machine-readable contract is exposed directly from each deployment.

### Step 6 — Multi-engine architecture

Delivered the WhatsApp engine abstraction, engine descriptors, account engine selection, engine-aware messaging routing and Engine Control Center. The persistent WhatsApp runtime remains separate from serverless web hosting.

### Step 7 — SDK system

Delivered TypeScript, Python and PHP SDK foundations targeting the same `/api/v1` HTTP contract, plus SDK documentation and developer navigation.

### Step 8 — n8n integration

Delivered the isolated n8n community-node package with credentials and operations for messaging, engine discovery and health checks, plus workflow examples and documentation.

### Step 9 — External integrations

Delivered encrypted integration configuration and management for Chatwoot, WordPress and generic HTTPS webhooks. Webhook requests use HMAC-SHA256 signatures and durable delivery processing is handled outside the request path.

### Step 10 — Notification system

Delivered persistent notifications, browser push via VAPID, optional SMTP email, preferences, rules, severity, channels, cooldowns and the notification delivery worker.

### Step 11 — Observability

Delivered workspace-scoped operational metrics, Prometheus text output, JSON snapshots and the Observability dashboard covering accounts, messages, conversations, broadcasts, jobs, webhooks, notifications and automations.

### Step 12 — Privacy and data controls

Delivered privacy policy/retention controls, workspace data inventory, transactional JSON export, retention cleanup and transactional workspace child-data erasure with explicit confirmation and audit recording.

### Step 13 — Plugin architecture

Delivered plugin catalog and installation storage, encrypted secrets/settings, permissions, event subscriptions, signed HTTPS event delivery, plugin testing, Developer Plugin Center and plugin-author verification documentation.

### Step 14 — Premium UI and production hardening

Delivered the premium command-center visual layer, animated depth/glass treatment, 3D interaction, responsive behavior, reduced-motion support, hardened browser security headers/CSP, recovery pages, deployment hardening guidance and production checklists.

## Important runtime architecture

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

Vercel and Netlify are suitable for the Next.js web/API layer. They do not replace the persistent WhatsApp or background worker processes.

## Local development

```bash
npm install
npm run db:migrate
npm run laawa
```

`npm run laawa` is the all-in-one local launcher. It starts the migration check, Multi-WhatsApp manager, durable jobs worker, webhook delivery worker and Next.js development server.

Web app: `http://localhost:3000`

## Environment

Copy `.env.example` to your local environment and configure the owner/session, PostgreSQL, Gemini, WhatsApp worker/manager, webhook, notification, SMTP and optional plugin encryption variables required by the features you use.

Never commit real secrets.

## Database migrations

Current application migrations are stored under `db/migrations/` and include the core schema, durable jobs, webhook delivery, API keys, integrations, notifications, privacy controls and plugins.

Run:

```bash
npm run db:migrate
```

before testing database-backed features after a fresh checkout.

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

## Developer centers

The application exposes dedicated Developer surfaces for:

- API keys
- API documentation
- Engine Control Center
- SDKs
- n8n
- External integrations
- Notifications
- Observability
- Privacy
- Plugins

## Documentation files

- `api-engines.md` — engine API
- `api-realtime.md` — SSE realtime API
- `n8n.md` — n8n integration
- `integrations.md` — external integrations
- `notifications.md` — notification system
- `observability.md` — metrics and Prometheus
- `privacy.md` — privacy/data controls
- `plugins.md` — plugin architecture
- `plugin-event-verification.md` — HMAC event verification
- `plugin-example.json` — plugin manifest example
- `sdk.md` — TypeScript/Python/PHP SDKs
- `deployment-hardening.md` — deployment hardening
- `production-hardening.md` — production guidance
- `production-checklist.md` — production checklist
- `premium-hardening.md` — premium UI/security hardening
- `premium-hardening-checklist.md` — hardening checklist
- `step-14.md` — Step 14 scope

## Deployment

### Vercel

Deploy the Next.js application using the repository configuration and set the production environment variables. Keep the persistent WhatsApp and worker services on a long-running Node runtime.

### Netlify

Deploy the Next.js application using `netlify.toml` and Node 20. Keep the persistent WhatsApp and worker services separate.

### Full local / server deployment

Use the Node processes represented by `npm run laawa`, or run the individual workers when your infrastructure needs separate services.

## Security boundaries

- Owner sessions are HTTP-only.
- API keys are stored as hashes and never retrievable as plaintext after creation.
- Integration/plugin secrets are encrypted at rest.
- Plugin callbacks are HTTPS-only and protected against common local/private targets.
- Webhooks/plugins use signed payloads.
- Workspace access is enforced throughout the versioned API.
- Privacy exports intentionally exclude sensitive credential material.
- Production CSP removes `unsafe-eval`.
- Security headers include frame, MIME-sniffing, referrer and permissions protections.

## Testing checklist

Before considering a deployment production-ready, verify:

1. Owner login and session persistence.
2. Database migration success.
3. WhatsApp authentication and reconnect behavior.
4. Incoming message persistence.
5. Outgoing reply through the correct WhatsApp account.
6. Conversation/contact creation.
7. API key creation and scoped API access.
8. Realtime event streaming.
9. Jobs and scheduled work.
10. Webhook delivery and retries.
11. Notifications.
12. Analytics and metrics.
13. Automation execution.
14. Plugin signature verification.
15. Privacy export/retention/erasure controls.
16. Production `npm run build`.
17. Vercel/Netlify web deployment plus separately hosted persistent workers.

## Current architectural follow-up

The next major engineering focus after the Step 1–14 foundation is production-grade persistent engine/worker infrastructure: durable queueing, retries, realtime event fan-out, reliable broadcast processing, automation execution reliability, rate limiting and end-to-end testing.
