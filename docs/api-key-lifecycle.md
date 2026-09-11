# API Key Lifecycle

Create one key per integration, choose the minimum scopes, optionally restrict it to WhatsApp accounts, and set an expiration for temporary access.

Store the secret once in the integration's server-side secret manager. The secret should not be committed, logged, or exposed to the browser.

Rotate by creating the replacement key, deploying the replacement secret, verifying the integration, and then revoking the old key.