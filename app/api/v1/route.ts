import { NextRequest } from "next/server";
import { apiError, apiSuccess, getRequestId } from "../../../lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  return apiSuccess(
    {
      name: "LaaWa API",
      version: "v1",
      status: "ready",
      documentation: "/developer/docs",
      openapi: "/api/v1/openapi.json",
      capabilities: {
        authentication: "session + api-key",
        apiKeys: true,
        messaging: true,
        media: true,
        locations: true,
        contacts: true,
        conversations: true,
        webhooks: true,
        realtime: true,
        openapi: true,
      },
      endpoints: {
        messages: "/api/v1/messages",
        conversations: "/api/v1/conversations",
        contacts: "/api/v1/contacts",
        events: "/api/v1/events?accountId={accountId}",
        keys: "/api/v1/keys",
        openapi: "/api/v1/openapi.json",
      },
    },
    { requestId },
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  return apiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "This API root is read-only.", requestId, headers: { Allow: "GET" } });
}
