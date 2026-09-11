# API Contract

LaaWa v1 uses `/api/v1` as its stable version boundary. The live OpenAPI document is available at `/api/v1/openapi.json` and should be used for generated clients and tooling.

Authentication is via session credentials for the internal console or bearer API keys for integrations. API keys use `read`, `write`, and `admin` scopes.
