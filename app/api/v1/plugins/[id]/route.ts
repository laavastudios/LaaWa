import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../lib/api";
import { getPlugin, uninstallPlugin, updatePluginInstallation } from "../../../../../lib/plugins";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const auth = await requireApiAuth(request, "read"); if ("response" in auth) return auth.response;
  const { id } = await context.params;
  try { const plugin = await getPlugin(auth.principal, id); if (!plugin) return apiError({ status: 404, code: "PLUGIN_NOT_FOUND", message: "Plugin not found.", requestId: auth.requestId }); return apiSuccess(plugin, { requestId: auth.requestId }); }
  catch (error) { return apiError({ status: 503, code: "PLUGIN_UNAVAILABLE", message: error instanceof Error ? error.message : "Plugin unavailable.", requestId: auth.requestId }); }
}
export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireApiAuth(request, "admin"); if ("response" in auth) return auth.response;
  const { id } = await context.params;
  try { const result = await updatePluginInstallation(auth.principal, id, await request.json()); if (!result) return apiError({ status: 404, code: "INSTALLATION_NOT_FOUND", message: "Plugin installation not found.", requestId: auth.requestId }); return apiSuccess(result, { requestId: auth.requestId }); }
  catch (error) { return apiError({ status: 400, code: "INVALID_PLUGIN_UPDATE", message: error instanceof Error ? error.message : "Unable to update plugin.", requestId: auth.requestId }); }
}
export async function DELETE(request: NextRequest, context: Context) {
  const auth = await requireApiAuth(request, "admin"); if ("response" in auth) return auth.response;
  const { id } = await context.params;
  try { if (!await uninstallPlugin(auth.principal, id)) return apiError({ status: 404, code: "INSTALLATION_NOT_FOUND", message: "Plugin installation not found.", requestId: auth.requestId }); return apiSuccess({ id, uninstalled: true }, { requestId: auth.requestId }); }
  catch (error) { return apiError({ status: 503, code: "PLUGIN_UNINSTALL_FAILED", message: error instanceof Error ? error.message : "Unable to uninstall plugin.", requestId: auth.requestId }); }
}
