import { NextRequest } from "next/server";
import { apiError, apiSuccess, getRequestId } from "../../../lib/api";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  return apiSuccess({
    name: "LaaWa API", version: "v1", status: "ready", documentation: "/developer/docs", openapi: "/api/v1/openapi.json",
    capabilities: { authentication: "session + api-key", apiKeys: true, messaging: true, media: true, locations: true, contacts: true, conversations: true, webhooks: true, realtime: true, multiEngine: true, integrations: true, notifications: true, observability: true, privacy: true, plugins: true, openapi: true },
    integrations: ["chatwoot", "wordpress", "webhook"],
    endpoints: { messages: "/api/v1/messages", conversations: "/api/v1/conversations", contacts: "/api/v1/contacts", events: "/api/v1/events?accountId={accountId}", engines: "/api/v1/engines", keys: "/api/v1/keys", integrations: "/api/v1/integrations", notifications: "/api/v1/notifications", metrics: "/api/v1/metrics", metricsSnapshot: "/api/v1/metrics/snapshot", privacy: "/api/v1/privacy", privacyExport: "/api/v1/privacy/export", plugins: "/api/v1/plugins", openapi: "/api/v1/openapi.json" },
  }, { requestId });
}
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  return apiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "This API root is read-only.", requestId, headers: { Allow: "GET" } });
}
