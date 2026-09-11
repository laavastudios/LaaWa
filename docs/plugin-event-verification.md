# Plugin event verification

For every plugin event, read the request body as raw bytes/text before JSON parsing. Build an HMAC-SHA256 digest with the installation secret and compare it to the `sha256=` value in `x-laawa-signature` using a constant-time comparison.

The envelope contains `id`, `apiVersion`, `type`, `createdAt`, and `data`. Treat the event ID as the idempotency key in the receiving plugin.
