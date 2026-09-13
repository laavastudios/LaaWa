# UI and security notes

The recovery and 404 pages use the same UI components as the main dashboard and support reduced-motion preferences.

Production responses use stricter browser security headers. The production CSP also removes `unsafe-eval`; development keeps the setting required by the development runtime.

The Next.js web/API layer can run on Vercel or Netlify. WhatsApp and other long-running workers must stay on a persistent Node.js runtime.
