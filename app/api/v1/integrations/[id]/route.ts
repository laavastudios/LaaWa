import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../../lib/api";
import { decryptIntegrationConfig, encryptIntegrationConfig, getIntegration } from "../../../../../../lib/integrations";
import { query } from "../../../../../../lib/db";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const integration = await getIntegration(auth.principal, id);
  if (!integration) return apiError({ status: 404, code: "INTEGRATION_NOT_FOUND", message: "Integration not found.", requestId: auth.requestId });
  await query("DELETE FROM integration_connections WHERE id=$1", [id]);
  return apiSuccess({ deleted: true, id }, { requestId: auth.requestId });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const integration = await getIntegration(auth.principal, id);
  if (!integration) return apiError({ status: 404, code: "INTEGRATION_NOT_FOUND", message: "Integration not found.", requestId: auth.requestId });
  const config = decryptIntegrationConfig<Record<string, unknown>>(integration.config_ciphertext);
  let ok = false;
  let error = "";
  try {
    if (integration.provider === "chatwoot") {
      const base = String(config.baseUrl || "").replace(/\/$/, "");
      const accountId = String(config.accountId || "");
      const token = String(config.apiToken || "");
      if (!/^https:\/\//i.test(base) || !accountId || !token) throw new Error("Chatwoot requires an HTTPS base URL, account ID, and API token.");
      const response = await fetch(`${base}/api/v1/accounts/${encodeURIComponent(accountId)}/agents`, { headers: { api_access_token: token }, cache: "no-store" });
      if (!response.ok) throw new Error(`Chatwoot returned HTTP ${response.status}.`);
      ok = true;
    } else if (integration.provider === "wordpress") {
      const base = String(config.baseUrl || "").replace(/\/$/, "");
      const username = String(config.username || "");
      const appPassword = String(config.appPassword || "");
      if (!/^https:\/\//i.test(base) || !username || !appPassword) throw new Error("WordPress requires an HTTPS site URL, username, and application password.");
      const response = await fetch(`${base}/wp-json/wp/v2/users/me`, { headers: { Authorization: `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}` }, cache: "no-store" });
      if (!response.ok) throw new Error(`WordPress returned HTTP ${response.status}.`);
      ok = true;
    } else {
      const url = String(config.url || "");
      if (!/^https:\/\//i.test(url)) throw new Error("Webhook URL must use HTTPS.");
      ok = true;
    }
  } catch (cause) { error = cause instanceof Error ? cause.message : "Connection test failed."; }
  await query("UPDATE integration_connections SET last_tested_at=NOW(), last_error=$2, updated_at=NOW() WHERE id=$1", [id, ok ? null : error]);
  if (!ok) return apiError({ status: 502, code: "INTEGRATION_TEST_FAILED", message: error, requestId: auth.requestId });
  return apiSuccess({ connected: true, provider: integration.provider }, { requestId: auth.requestId });
}
