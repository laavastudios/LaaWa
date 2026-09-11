# API Compatibility

All integration endpoints are under `/api/v1`. Clients should pin to the versioned base path and consume the OpenAPI document served by the target instance.

The web/API layer is implemented with standard Next.js Route Handlers and standard HTTP/SSE responses, keeping the integration surface portable across supported Next.js hosting platforms.