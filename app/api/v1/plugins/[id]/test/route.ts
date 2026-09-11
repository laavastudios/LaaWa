import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../../lib/api";
import { testPlugin } from "../../../../../../lib/plugins";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireApiAuth(request, "admin"); if ("response" in auth) return auth.response;
  const { id } = await context.params;
  try { const result = await testPlugin(auth.principal, id); if (!result) return apiError({ status: 404, code: "INSTALLATION_NOT_FOUND", message: "Plugin installation not found.", requestId: auth.requestId }); return apiSuccess(result, { requestId: auth.requestId }); }
  catch (error) { return apiError({ status: 503, code: "PLUGIN_TEST_FAILED", message: error instanceof Error ? error.message : "Plugin test delivery failed.", requestId: auth.requestId }); }
}
