import { NextRequest, NextResponse } from "next/server";
import { apiError, requireApiAuth } from "../../../../lib/api";
import { getMetricsSnapshot, toPrometheus } from "../../../../lib/metrics";
import { notificationWorkspace } from "../../../../lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  try {
    const snapshot = await getMetricsSnapshot(workspaceId);
    const response = new NextResponse(toPrometheus(snapshot), { status: 200, headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8", "cache-control": "no-store", "x-request-id": auth.requestId, "x-laawa-api-version": "v1" } });
    return response;
  } catch {
    return apiError({ status: 503, code: "METRICS_UNAVAILABLE", message: "Operational metrics are temporarily unavailable.", requestId: auth.requestId });
  }
}
