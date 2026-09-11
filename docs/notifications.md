# LaaWa Notifications

LaaWa includes an operational notification layer for self-hosted deployments.

## Alert events

- `whatsapp.connection` — unexpected WhatsApp worker exits and restart exhaustion.
- `broadcast.failure` — a broadcast recipient reaches terminal delivery failure.
- `worker.failure` — worker-level test and operational alerts.
- `webhook.failure` — a durable webhook reaches its retry limit.

Rules support `info`, `warning`, or `critical` severity, browser/email channels, enable/disable state, and a per-event cooldown.

## Browser push

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. The notification center registers `/notifications-sw.js` and stores only the push subscription endpoint and public subscription keys.

Generate a VAPID key pair once with the `web-push` package's standard VAPID tooling, then keep the private key only in the server environment.

## Email

Email delivery is optional. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`, then enable Email alerts and supply the destination address in the notification center.

## Worker

The web/API layer remains compatible with Netlify and Vercel. The notification delivery process is a persistent Node worker, just like the WhatsApp, durable jobs, and webhook workers. Run `npm run notifications` alongside those workers on your own persistent runtime.

`npm run laawa` starts the notification worker automatically when `DATABASE_URL` is configured.

## API

- `GET /api/v1/notifications`
- `POST /api/v1/notifications`
- `DELETE /api/v1/notifications`
- `GET/PATCH /api/v1/notifications/preferences`
- `GET/POST/DELETE /api/v1/notifications/push`
- `GET /api/v1/notifications/config`
- `GET/PATCH /api/v1/notifications/rules`

Notification secrets are never returned by the API.
