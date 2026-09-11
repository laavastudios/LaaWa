import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../../lib/api";
import { decryptIntegrationConfig, getIntegration } from "../../../../../../lib/integrations";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request, "write");
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const integration = await getIntegration(auth.principal, id);
  if (!integration || integration.provider !== "webhook") return apiError({ status: 404, code: "WEBHOOK_INTEGRATION_NOT_FOUND", message: "Webhook integration not found.", requestId: auth.requestId });
  if (!integration.enabled) return apiError({ status: 409, code: "INTEGRATION_DISABLED", message: "This integration is disabled.", requestId: auth.requestId });
  let payload: unknown;
  try { payload = await request.json(); } catch { return apiError({ status: 400, code: "INVALID_JSON", message: "Payload must be valid JSON.", requestId: auth.requestId }); }
  const config = decryptIntegrationConfig<{ url: string; secret?: string }>(integration.config_ciphertext);
  if (!/^https:\/\//i.test(config.url)) return apiError({ status: 400, code: "INVALID_WEBHOOK_URL", message: "Webhook URL must use HTTPS.", requestId: auth.requestId });
  const body = JSON.stringify({ event: "laawa.integration", timestamp: new Date().toISOString(), data: payload });
  const signature = config.secret ? crypto.createHmac("sha256", config.secret).update(body).digest("hex") : undefined;
  try {
    const response = await fetch(config.url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "LaaWa-Webhook/1.0", "x-laawa-event": "laawa.integration", ...(signature ? { "x-laawa-signature": `sha256=${signature}` } : {}) }, body, cache: "no-store" });
    if (!response.ok) return apiError({ status: 502, code: "WEBHOOK_DELIVERY_FAILED", message: `Webhook returned HTTP ${response.status}.`, requestId: auth.requestId });
    return apiSuccess({ delivered: true, status: response.status }, { requestId: auth.requestId });
  } catch { return apiError({ status: 502, code: "WEBHOOK_UNREACHABLE", message: "Webhook endpoint is unreachable.", requestId: auth.requestId }); }
}
