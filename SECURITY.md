# Security

LaaWa is intended to be self-hosted. Keep production secrets outside source control and rotate them independently.

## Report a vulnerability

For a private deployment, report security issues directly to the deployment owner. Do not publish credentials, session state, API-key secrets, integration ciphertext, webhook signing secrets, or notification private keys in an issue or pull request.

## High-value secrets

- `LAAWA_SESSION_SECRET`
- `INTEGRATION_ENCRYPTION_KEY`
- `WHATSAPP_WORKER_SECRET`
- `VAPID_PRIVATE_KEY`
- API-key plaintext values
- Integration provider credentials

Treat WhatsApp authentication/session directories as secrets as well.
