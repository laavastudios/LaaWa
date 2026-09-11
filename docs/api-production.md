# API Production Readiness

The API web layer uses native Next.js Route Handlers and standard HTTP/SSE primitives for portability across Vercel and Netlify.

Production checklist:

- Configure all required server-side environment variables.
- Keep database and worker credentials private.
- Create dedicated, scoped API keys for integrations.
- Verify health, authentication, reads, writes, and realtime behavior after deployment.
- Keep the persistent WhatsApp worker on a runtime suitable for long-lived Node.js processes.
- Use request IDs and structured API errors when diagnosing failures.
