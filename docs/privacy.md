# Privacy & Data Controls

LaaWa keeps privacy controls inside the self-hosted workspace so operators can inspect, export, retain, and erase their own data without a third-party service.

## API

All endpoints are under `/api/v1` and require an authenticated session or bearer API key. Mutating privacy operations require the `admin` scope.

- `GET /privacy` — privacy policy plus workspace data inventory.
- `PATCH /privacy` — set retention days for messages, notifications, and audit logs. `0` disables cleanup for that class.
- `POST /privacy` with `{ "action": "retention" }` — execute the configured cleanup immediately.
- `GET /privacy/export` — download a portable JSON export.
- `POST /privacy` with `{ "action": "erase", "confirmation": "ERASE <workspace name>" }` — permanently erase workspace-owned data.

## Export boundaries

The export includes workspace records needed to move or inspect the deployment: WhatsApp account metadata, contacts, conversations, messages, media metadata, templates, broadcasts, schedules, automation definitions/runs, webhook definitions/deliveries, API-key fingerprints, audit history, settings, durable jobs, integrations metadata, notification data, and privacy policy.

Plaintext API-key secrets and integration ciphertext are never exported. Webhook secret hashes are also excluded.

## Retention

Retention is explicit and per data class:

- Messages: `0` by default (disabled).
- Notifications: `90` days by default.
- Audit logs: `365` days by default.
- Maximum configured retention: `3650` days.

The cleanup operation runs in a PostgreSQL transaction. Message cleanup also removes unreferenced media metadata older than the same threshold.

## Erasure

Erasure is intentionally separate from retention. The UI requires typing the exact `ERASE <workspace name>` phrase, and the server requires `admin` authorization. The operation locks the workspace row and deletes workspace-owned records in a single transaction. If any deletion fails, PostgreSQL rolls the entire operation back.

The workspace shell itself remains, allowing an operator to restart from a clean state without recreating the deployment.

## Deployment

Privacy APIs use Next.js Node.js Route Handlers and PostgreSQL only. No always-on privacy service is required, so the web/API layer remains compatible with the existing Netlify/Vercel deployment model. Scheduled retention can be invoked by the existing worker/cron infrastructure or manually from the Privacy Center.
