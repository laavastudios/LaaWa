# Plugin Architecture

LaaWa plugins are external HTTPS extensions. The web application does not execute third-party plugin JavaScript, npm packages, or arbitrary code inside the Next.js runtime.

## Lifecycle

1. Register a plugin manifest with `POST /api/v1/plugins`.
2. LaaWa validates the slug, HTTPS callback, permissions, and event subscriptions.
3. A workspace installation is created with an encrypted signing secret.
4. The secret is returned only in the installation response.
5. Events are delivered as signed HTTPS POST requests.
6. The installation can be enabled, disabled, reconfigured, tested, or uninstalled.

## Manifest

```json
{
  "slug": "crm-sync",
  "name": "CRM Sync",
  "version": "1.0.0",
  "description": "Synchronize customer conversations with a CRM.",
  "author": "Example Team",
  "callbackUrl": "https://plugin.example.com/laawa/events",
  "permissions": ["messages.read", "contacts.read"],
  "events": ["message.received", "contact.updated"]
}
```

Supported permissions are intentionally finite: `messages.read`, `messages.write`, `contacts.read`, `conversations.read`, `broadcasts.read`, and `accounts.read`.

Supported events include message, conversation, contact, broadcast, WhatsApp connection, and webhook failure lifecycle events. Unknown permissions or events are rejected.

## Signature verification

Every event body is signed with the installation secret:

`x-laawa-signature: sha256=<hex HMAC-SHA256(body)>`

Verify the signature against the raw request body before parsing or processing the event. Use constant-time comparison in the receiving application.

## Security boundaries

- Callback URLs must use HTTPS.
- URL credentials are rejected.
- localhost, `.local`, loopback, link-local, and RFC1918 IPv4 destinations are rejected at manifest validation.
- Plugin settings and signing secrets are encrypted at rest.
- API responses never expose stored plugin secrets.
- Plugin permissions and event subscriptions are stored per workspace installation.
- Plugin delivery attempts, status, response status, and failures are persisted.

The URL checks are a defense-in-depth boundary; plugin operators should also use network egress controls and allowlists where their infrastructure supports them.

## API

- `GET /api/v1/plugins`
- `POST /api/v1/plugins`
- `GET /api/v1/plugins/{id}`
- `PATCH /api/v1/plugins/{id}`
- `DELETE /api/v1/plugins/{id}`
- `POST /api/v1/plugins/{id}/test`

Read operations require `read`; installation, update, test, and uninstall operations require `admin`.

## Hosting

The plugin registry and gateway are standard Node.js Route Handlers backed by PostgreSQL. No persistent plugin runtime is required by the web app, preserving the existing one-click Next.js deployment path for Vercel and Netlify. Plugin services themselves can run on any HTTPS-capable platform.
