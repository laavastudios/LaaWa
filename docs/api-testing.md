# API Testing

Before enabling an integration in production:

1. Call `/api/v1/health`.
2. Authenticate with a dedicated API key.
3. Verify a permitted read operation.
4. Verify account restrictions behave as expected.
5. Verify a write operation only from a trusted server.
6. If realtime is required, open the SSE endpoint and confirm events arrive.
7. Record the returned request ID for diagnostics.
