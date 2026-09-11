import { NextRequest, NextResponse } from "next/server";
import { apiError, requireApiAuth } from "../../../../../lib/api";
import { exportWorkspaceData, privacyWorkspace } from "../../../../../lib/privacy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const workspaceId = await privacyWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });

  try {
    const data = await exportWorkspaceData(workspaceId);
    const filename = `laawa-privacy-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Laawa-API-Version": "v1",
        "X-Request-Id": auth.requestId,
      },
    });
  } catch (error) {
    return apiError({ status: 503, code: "EXPORT_FAILED", message: error instanceof Error ? error.message : "Data export failed.", requestId: auth.requestId });
  }
}
