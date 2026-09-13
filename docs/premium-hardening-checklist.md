# UI and security checklist

- Recovery page works and respects reduced-motion settings
- 404 page works on desktop and mobile
- Responsive layout
- Production CSP excludes `unsafe-eval`
- COOP/CORP and other browser security headers are set
- Web/API deployment works on Vercel or Netlify
- WhatsApp and other persistent workers run outside the serverless web runtime
