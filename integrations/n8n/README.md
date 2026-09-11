# LaaWa for n8n

A self-hosted n8n community node for connecting workflows to the LaaWa v1 API.

## Install

From the `integrations/n8n` directory:

```bash
npm install
npm run build
npm pack
```

Install the resulting package in an n8n instance that allows community nodes. The package does not modify the LaaWa Next.js build and has no effect on Vercel or Netlify deployment.

## Credential

Create a **LaaWa API** credential with:

- **Base URL**: your LaaWa `/api/v1` URL
- **API Key**: an API key created in LaaWa Developer → API Keys

Use the smallest scope required. Sending messages requires `write`; health and engine discovery require `read`.

## Operations

- **Message → Send** — sends text to an account/chat.
- **Message → List Messages** — retrieves messages for an account/chat.
- **Engine → List** — discovers configured WhatsApp engines.
- **Health → Check** — checks the API health endpoint.

The node passes n8n item data through a configurable field fallback, making it straightforward to connect webhook, AI, database, schedule, and transform nodes before a LaaWa send step.

## Incoming automation

For inbound automation, use n8n's Webhook node as the workflow trigger and configure a LaaWa webhook delivery to that URL. Keep the n8n webhook URL private and use a signing secret or an authenticated gateway in front of it where appropriate.

## Deployment

The integration is intentionally isolated under `integrations/n8n`. The root LaaWa application does not import n8n packages, so normal Vercel and Netlify builds remain independent of n8n.
