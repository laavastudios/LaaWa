# Hardening notes

Production responses use browser security headers, and the production Content Security Policy does not allow `unsafe-eval`. Development keeps the setting needed by the development runtime.

Recovery and 404 pages use the dashboard UI and respect reduced-motion preferences.

Vercel and Netlify can host the Next.js web/API layer. WhatsApp and other long-running workers need a persistent Node.js runtime. PostgreSQL remains the main database.
