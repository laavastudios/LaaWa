# Hardening notes

The production web layer now applies defensive browser headers and removes `unsafe-eval` from the production Content Security Policy. Development retains the compatibility directive needed by the development runtime.

Runtime and 404 boundaries use the same premium visual language as the command center and respect reduced-motion preferences.

For Vercel or Netlify, deploy the Next.js web/API layer normally and keep persistent WhatsApp-related workers on a process-capable runtime. PostgreSQL remains the durable state layer.
