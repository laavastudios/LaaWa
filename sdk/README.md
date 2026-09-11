# LaaWa SDKs

This directory contains lightweight clients for the public v1 API contract.

- `typescript/` — modern typed client, buildable as an npm package
- `python/` — standard-library HTTP client, buildable as a Python package
- `php/` — Composer package using cURL

The SDKs are intentionally independent of the LaaWa web application's deployment runtime. They do not add dependencies to the Next.js application, persistent workers, or Vercel/Netlify build.
