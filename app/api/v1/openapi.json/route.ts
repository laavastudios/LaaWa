import { NextResponse } from "next/server";

export const runtime = "nodejs";

const spec = {
  openapi: "3.0.3",
  info: { title: "LaaWa API", version: "1.0.0", description: "Versioned API for messaging, conversations, contacts, API keys, realtime events, and multi-engine runtimes." },
  servers: [{ url: "/api/v1", description: "Current deployment" }],
  security: [{ bearerAuth: [] }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
  paths: {
    "/": { get: { security: [], responses: { "200": { description: "API capabilities" } } } },
    "/health": { get: { security: [], responses: { "200": { description: "Healthy" }, "503": { description: "Dependency unavailable" } } } },
    "/openapi.json": { get: { security: [], responses: { "200": { description: "OpenAPI document" } } } },
    "/engines": { get: { responses: { "200": { description: "Available WhatsApp engines and capabilities" } } } },
    "/keys": { get: { responses: { "200": { description: "API keys" } } }, post: { requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { "201": { description: "Created" } } } },
    "/keys/{id}": { delete: { parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "204": { description: "Revoked" } } } },
    "/messages": { get: { parameters: [{ name: "accountId", in: "query", required: true, schema: { type: "string" } }, { name: "chatId", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "Messages" } } }, post: { requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { "201": { description: "Accepted" } } } },
    "/conversations": { get: { responses: { "200": { description: "Conversations" } } } },
    "/conversations/{id}/messages": { get: { parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Conversation history" } } } },
    "/contacts": { get: { responses: { "200": { description: "Contacts" } } } },
    "/events": { get: { description: "Authenticated Server-Sent Events stream.", parameters: [{ name: "accountId", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "SSE stream", content: { "text/event-stream": { schema: { type: "string" } } } } } } },
  },
};

export async function GET() {
  return NextResponse.json(spec, { headers: { "cache-control": "public, max-age=300", "x-laawa-api-version": "v1" } });
}
