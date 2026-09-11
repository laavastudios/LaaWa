# API Errors

All API errors are returned in a stable machine-readable envelope.

Common codes include:

- `INVALID_REQUEST` — malformed or incomplete input.
- `UNAUTHORIZED` — authentication is missing or invalid.
- `FORBIDDEN` — the credential lacks the required scope.
- `KEY_NOT_FOUND` — requested API credential does not exist.
- `ACCOUNT_NOT_FOUND` — requested WhatsApp account is unavailable or not permitted.
- `CONVERSATION_NOT_FOUND` — requested conversation is unavailable or not permitted.
- `DATABASE_UNAVAILABLE` — required database configuration is unavailable.
- `WORKER_UNAVAILABLE` — the WhatsApp worker cannot service the request.

Use the HTTP status together with `error.code` for programmatic handling. Include `requestId` when reporting an issue.