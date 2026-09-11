import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../../lib/api";
import { getNotificationPreferences, notificationWorkspace, upsertNotificationPreferences, type NotificationSeverity } from "../../../../../../lib/notifications";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  return apiSuccess(await getNotificationPreferences(workspaceId), { requestId: auth.requestId });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  let body: { browserEnabled?: unknown; emailEnabled?: unknown; emailAddress?: unknown; minimumSeverity?: unknown };
  try { body = await request.json(); } catch { return apiError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON.", requestId: auth.requestId }); }
  const minimumSeverity = body.minimumSeverity === "info" || body.minimumSeverity === "warning" || body.minimumSeverity === "critical" ? body.minimumSeverity as NotificationSeverity : undefined;
  const emailAddress = body.emailAddress === null ? null : typeof body.emailAddress === "string" ? body.emailAddress.trim().slice(0, 320) : undefined;
  if (emailAddress && !/^\S+@\S+\.\S+$/.test(emailAddress)) return apiError({ status: 400, code: "INVALID_EMAIL", message: "Provide a valid notification email address.", requestId: auth.requestId });
  const preferences = await upsertNotificationPreferences(workspaceId, {
    browserEnabled: typeof body.browserEnabled === "boolean" ? body.browserEnabled : undefined,
    emailEnabled: typeof body.emailEnabled === "boolean" ? body.emailEnabled : undefined,
    emailAddress,
    minimumSeverity,
  });
  return apiSuccess(preferences, { requestId: auth.requestId });
}
