# API Release Checklist

Before releasing a change to the v1 API:

- Update `/api/v1/openapi.json`.
- Update the interactive developer guide when user-facing behavior changes.
- Update endpoint examples and error documentation.
- Verify authentication and scope requirements.
- Verify workspace and account isolation.
- Run lint and the production build.
- Verify `/api/v1/health` after deployment.
