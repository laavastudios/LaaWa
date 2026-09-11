# API Migration Notes

The current contract is v1. Keep integrations on `/api/v1` and regenerate clients from `/api/v1/openapi.json` after contract changes.

Prefer additive changes within v1. When a future breaking contract is introduced, publish the new version alongside the existing contract and provide migration notes before retiring the older version.