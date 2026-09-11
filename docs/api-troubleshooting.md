# API Troubleshooting

## 401 Unauthorized

Check that the bearer credential is present, valid, unexpired, and has not been revoked.

## 403 Forbidden

Check that the API key includes the required scope.

## 404 Account or conversation

Verify the resource belongs to the authenticated workspace and, for restricted API keys, that the WhatsApp account is in the key's allow-list.

## 503 Worker unavailable

Verify the persistent WhatsApp worker or account manager is running and that its configured URL and shared secret are reachable from the web/API runtime.

Use the response `requestId` when investigating failures.