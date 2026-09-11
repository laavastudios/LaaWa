# API Integration Checklist

- [ ] Create a dedicated API key.
- [ ] Select the smallest required scope.
- [ ] Restrict the key to required WhatsApp accounts when appropriate.
- [ ] Store the key only in server-side secrets.
- [ ] Verify `/api/v1/health` after deployment.
- [ ] Verify authenticated reads before enabling writes.
- [ ] Add retry/backoff for transient failures.
- [ ] Add exponential reconnect backoff for realtime SSE.
- [ ] Record request IDs for operational debugging.
- [ ] Revoke and rotate keys when an integration is retired or compromised.
