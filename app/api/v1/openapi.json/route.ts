import { NextResponse } from "next/server";

export const runtime = "nodejs";

const spec = {
  openapi: "3.0.3",
  info: { title: "LaaWa API", version: "1.0.0", description: "Versioned API for messaging, conversations, contacts, API keys, and realtime events." },
  servers: [{ url: "/api/v1", description: "Current deployment" }],
  tags: [{ name: "System" }, { name: "API Keys" }, { name: "Messages" }, { name: "Conversations" }, { name: "Contacts" }, { name: "Realtime" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "Use a LaaWa API key. Session authentication is also supported for browser requests." } },
    schemas: {
      ApiSuccess: { type: "object", properties: { ok: { type: "boolean", example: true }, data: {}, requestId: { type: "string" } }, required: ["ok"] },
      ApiError: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {} }, required: ["code", "message"] }, requestId: { type: "string" } }, required: ["ok", "error"] },
      ApiKey: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, keyPrefix: { type: "string" }, scopes: { type: "array", items: { type: "string", enum: ["read", "write", "admin"] } }, whatsappAccountIds: { type: "array", items: { type: "string", format: "uuid" } }, expiresAt: { type: "string", format: "date-time", nullable: true }, revokedAt: { type: "string", format: "date-time", nullable: true }, lastUsedAt: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
    },
  },
  paths: {
    "/": { get: { tags: ["System"], summary: "API capabilities", security: [], responses: { "200": { description: "API status and capabilities" } } } },
    "/health": { get: { tags: ["System"], summary: "Health check", security: [], responses: { "200": { description: "Healthy API" }, "503": { description: "Dependency unavailable" } } } },
    "/openapi.json": { get: { tags: ["System"], summary: "OpenAPI document", security: [], responses: { "200": { description: "OpenAPI 3.0 document" } } } },
    "/keys": { get: { tags: ["API Keys"], summary: "List API keys", responses: { "200": { description: "API keys" }, "401": { description: "Unauthorized" } } }, post: { tags: ["API Keys"], summary: "Create API key", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, scopes: { type: "array", items: { type: "string", enum: ["read", "write", "admin"] } }, whatsappAccountIds: { type: "array", items: { type: "string", format: "uuid" } }, expiresAt: { type: "string", format: "date-time" } } } } } }, responses: { "201": { description: "Created key; plaintext is returned once" }, "400": { description: "Invalid request" } } } },
    "/keys/{id}": { delete: { tags: ["API Keys"], summary: "Revoke API key", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "204": { description: "Revoked" }, "404": { description: "Not found" } } } },
    "/messages": { get: { tags: ["Messages"], summary: "Read chat messages", parameters: [{ name: "accountId", in: "query", required: true, schema: { type: "string" } }, { name: "chatId", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "Messages" } } }, post: { tags: ["Messages"], summary: "Send or act on a message", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { action: { type: "string", enum: ["send", "location", "contact", "reply", "react", "read"], default: "send" }, accountId: { type: "string" }, chatId: { type: "string" }, conversationId: { type: "string" }, messageId: { type: "string" }, text: { type: "string" }, reaction: { type: "string" }, latitude: { type: "number" }, longitude: { type: "number" }, description: { type: "string" }, phone: { type: "string" }, name: { type: "string" }, vcard: { type: "string" }, media: { type: "object" } } } } } }, responses: { "201": { description: "Message action accepted" }, "400": { description: "Invalid request" }, "403": { description: "Insufficient scope" } } } },
    "/conversations": { get: { tags: ["Conversations"], summary: "List conversations", responses: { "200": { description: "Conversation list" } } },
    "/contacts": { get: { tags: ["Contacts"], summary: "Search contacts", parameters: [{ name: "q", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Contact list" } } } },
    "/events": { get: { tags: ["Realtime"], summary: "Stream realtime events", description: "Server-Sent Events stream. Events include state, snapshot, message, and sync.", parameters: [{ name: "accountId", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "SSE stream", content: { "text/event-stream": { schema: { type: "string" } } } }, "400": { description: "Invalid request" }, "404": { description: "Account not found" } } } },
  },
};

export async function GET() {
  return NextResponse.json(spec, { headers: { "cache-control": "public, max-age=300", "x-laawa-api-version": "v1" } });
}
