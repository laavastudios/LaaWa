# n8n integration

LaaWa exposes a self-hosted n8n community node under `integrations/n8n`.

## What it provides

- Send WhatsApp messages from an n8n workflow.
- Read messages for a selected account/chat.
- Discover configured WhatsApp engines.
- Check LaaWa API health.
- Use LaaWa webhook deliveries with n8n Webhook nodes for inbound workflows.

## Installation

Build the package from the repository:

```bash
cd integrations/n8n
npm install
npm run build
npm pack
```

Install the generated package in an n8n environment with community-node installation enabled.

## Authentication

Create a LaaWa API key and use the `LaaWa API` credential in n8n. Keep the key scoped to the operations required by the workflow; message sending requires `write`.

## One-click deployment safety

The n8n package is deliberately isolated from the Next.js dependency graph. The main application continues to build with the existing Vercel and Netlify configuration. n8n is an optional automation runtime, not a requirement for the web application.
