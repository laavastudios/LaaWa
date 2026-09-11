# LaaWa Observability

LaaWa exposes workspace-scoped operational telemetry without requiring a separate metrics process.

## Endpoints

- `GET /api/v1/metrics` — Prometheus text exposition format.
- `GET /api/v1/metrics/snapshot` — JSON snapshot used by the developer dashboard.

Both endpoints require an API credential with the `read` scope and only return data for the authenticated workspace.

## Metrics

Telemetry covers WhatsApp account state, message volume and failures, conversations, broadcasts, durable jobs, webhook delivery, notifications, and automation failures.

The metrics endpoint is intentionally uncached so scrapers receive a current database-backed snapshot. It is safe to deploy with the Next.js web/API layer on Vercel or Netlify; no always-on observability daemon is required.

## Prometheus example

```yaml
scrape_configs:
  - job_name: laawa
    metrics_path: /api/v1/metrics
    scheme: https
    static_configs:
      - targets: ['your-laawa.example.com']
    authorization:
      type: Bearer
      credentials: 'YOUR_READ_API_KEY'
```

Keep the API key in the Prometheus secret-management mechanism used by your deployment. Do not commit credentials to the repository.

## Dashboard

The premium operational dashboard is available at `/developer/observability`. It refreshes every 15 seconds by default and can be manually refreshed or paused.
