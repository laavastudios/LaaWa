import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../lib/api";
import { encryptIntegrationConfig, INTEGRATION_PROVIDERS, integrationWorkspace, listIntegrations, normalizeProvider } from "../../../../../lib/integrations";
import { query } from "../../../../../lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  return apiSuccess({ providers: INTEGRATION_PROVIDERS, connections: await listIntegrations(auth.principal) }, { requestId: auth.requestId });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  let body: { provider?: unknown; name?: unknown; config?: unknown; enabled?: unknown };
  try { body = await request.json(); } catch { return apiError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON.", requestId: auth.requestId }); }
  const provider = normalizeProvider(body.provider);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const config = body.config && typeof body.config === "object" && !Array.isArray(body.config) ? body.config : null;
  if (!provider || !name || !config) return apiError({ status: 400, code: "INVALID_INTEGRATION", message: "provider, name, and config are required.", requestId: auth.requestId });
  const workspaceId = await integrationWorkspace(auth.principal);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  try {
    const result = await query<{ id: string }>("INSERT INTO integration_connections (workspace_id, provider, name, config_ciphertext, enabled) VALUES ($1,$2,$3,$4,$5) RETURNING id", [workspaceId, provider, name, encryptIntegrationConfig(config), body.enabled !== false]);
    return apiSuccess({ id: result.rows[0].id, provider, name, enabled: body.enabled !== false }, { status: 201, requestId: auth.requestId });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("integration_connections_workspace_provider_name_idx") ? "An integration with this provider and name already exists." : "Unable to create integration.";
    return apiError({ status: message.startsWith("An ") ? 409 : 500, code: message.startsWith("An ") ? "INTEGRATION_EXISTS" : "INTEGRATION_CREATE_FAILED", message, requestId: auth.requestId });
  }
}
