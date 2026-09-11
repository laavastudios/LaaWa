import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../lib/api";
import { listPlugins, pluginWorkspace, registerPlugin } from "../../../../lib/plugins";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read"); if ("response" in auth) return auth.response;
  try { return apiSuccess(await listPlugins(auth.principal), { requestId: auth.requestId }); }
  catch (error) { return apiError({ status: 503, code: "PLUGINS_UNAVAILABLE", message: error instanceof Error ? error.message : "Plugin registry unavailable.", requestId: auth.requestId }); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin"); if ("response" in auth) return auth.response;
  if (!await pluginWorkspace(auth.principal)) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  try {
    const body = await request.json();
    const result = await registerPlugin(auth.principal, body?.manifest ?? body);
    return apiSuccess(result, { status: 201, requestId: auth.requestId });
  } catch (error) { return apiError({ status: 400, code: "INVALID_PLUGIN", message: error instanceof Error ? error.message : "Invalid plugin manifest.", requestId: auth.requestId }); }
}
