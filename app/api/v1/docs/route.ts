import { NextResponse } from "next/server";

export const runtime = "nodejs";

const spec = {
  openapi: "3.1.0",
  info: { title: "LaaWa API", version: "1.0.0", description: "Messaging and customer data API for a self-hosted LaaWa instance." },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" } } },
  paths: {
    "/messages": {
      get: { summary: "Read WhatsApp messages", parameters: [{ name: "accountId", in: "query", required: true, schema: { type: "string", format: "uuid" } }, { name: "chatId", in: "query", required: true, schema: { type: "string" } }] },
      post: { summary: "Send or act on a WhatsApp message", description: "Supports send, location, contact, reply, react and read actions. Media payloads use base64 data with mimetype, filename and kind.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["accountId", "chatId"], properties: { action: { type: "string", enum: ["send", "location", "contact", "reply", "react", "read"], default: "send" }, accountId: { type: "string", format: "uuid" }, chatId: { type: "string" }, conversationId: { type: "string", format: "uuid" }, text: { type: "string" }, messageId: { type: "string" }, reaction: { type: "string" }, latitude: { type: "number" }, longitude: { type: "number" }, description: { type: "string" }, phone: { type: "string" }, name: { type: "string" }, vcard: { type: "string" }, media: { type: "object", properties: { data: { type: "string" }, mimetype: { type: "string" }, filename: { type: "string" }, kind: { type: "string", enum: ["image", "video", "audio", "document", "sticker"] }, voice: { type: "boolean" } } } } } } } } },
    "/conversations": { get: { summary: "List conversations", parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } }] } },
    "/conversations/{id}/messages": { get: { summary: "Read persisted conversation history", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }, { name: "limit", in: "query", schema: { type: "integer", maximum: 200 } }, { name: "before", in: "query", schema: { type: "string", format: "date-time" } }] } },
    "/contacts": { get: { summary: "Search contacts", parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } }] } },
  },
};

export async function GET() {
  return NextResponse.json(spec, { headers: { "Cache-Control": "public, max-age=300" } });
}
