# API Security

Use a dedicated API key per integration and grant only the scopes required for that integration.

API keys are bearer credentials. Keep them out of browser bundles, URLs, logs, screenshots, source control, and client-side environment variables.

When possible, restrict a key to the WhatsApp accounts it needs. Use expiration for temporary access and revoke compromised credentials immediately.

The API enforces workspace isolation and returns request identifiers to make failures traceable without exposing secrets.
