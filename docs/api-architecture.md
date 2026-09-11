# API Architecture

The public developer surface is split into three concerns:

1. Native Next.js Route Handlers expose `/api/v1`.
2. Shared API/authentication helpers enforce request IDs, scopes, and workspace/account boundaries.
3. The persistent WhatsApp worker or account manager performs long-running WhatsApp operations behind the web/API boundary.

This keeps the HTTP layer portable while preserving the runtime requirements of WhatsApp Web.