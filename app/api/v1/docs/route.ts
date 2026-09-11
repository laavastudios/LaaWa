import { NextResponse } from "next/server";

export const runtime = "nodejs";

const spec = {
  openapi: "3.0.3",
  info: { title: "LaaWa API", version: "1.0.0", description: "Messaging and customer data API for a self-hosted LaaWa instance." },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" } } },
  paths: {
    "/messages": { get: { summary: "Read messages" }, post: { summary: "Send or act on a message" } },
    "/conversations": { get: { summary: "List conversations" } },
    "/conversations/{id}/messages": { get: { summary: "Read conversation history" } },
    "/contacts": { get: { summary: "Search contacts" } },
  },
};

export async function GET() {
  return NextResponse.json(spec, { headers: { "Cache-Control": "public, max-age=300" } });
}
