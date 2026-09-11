import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../lib/api";
import { getMetricsSnapshot } from "../../../../../lib/metrics";
import { notificationWorkspace } from "../../../../../lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  try { return apiSuccess(await getMetricsSnapshot(workspaceId), { requestId: auth.requestId }); }
  catch { return apiError({ status: 503, code: "METRICS_UNAVAILABLE", message: "Operational metrics are temporarily unavailable.", requestId: auth.requestId }); }
}
