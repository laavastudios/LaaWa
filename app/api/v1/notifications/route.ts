import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../lib/api";
import { createNotification, listNotifications, notificationWorkspace, unreadNotificationCount, markNotificationsRead, NOTIFICATION_EVENTS, type NotificationSeverity } from "../../../../lib/notifications";
import { query } from "../../../../lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
  const [notifications, unread] = await Promise.all([listNotifications(workspaceId, Number.isFinite(limit) ? limit : 50), unreadNotificationCount(workspaceId)]);
  return apiSuccess({ notifications, unread, events: NOTIFICATION_EVENTS }, { requestId: auth.requestId });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "write");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  let body: { ids?: unknown[]; test?: unknown } = {};
  try { body = await request.json(); } catch { return apiError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON.", requestId: auth.requestId }); }
  if (Array.isArray(body.ids)) {
    const count = await markNotificationsRead(workspaceId, body.ids.filter((id): id is string => typeof id === "string"));
    return apiSuccess({ markedRead: count }, { requestId: auth.requestId });
  }
  if (body.test === true) {
    if (!auth.principal.scopes.includes("admin")) return apiError({ status: 403, code: "INSUFFICIENT_SCOPE", message: "The 'admin' scope is required to create a test notification.", requestId: auth.requestId });
    const id = await createNotification({ workspaceId, eventType: "worker.failure", severity: "warning" as NotificationSeverity, title: "Notification test", body: "Your LaaWa notification channels are configured and ready.", data: { test: true } });
    return apiSuccess({ id }, { status: 201, requestId: auth.requestId });
  }
  return apiError({ status: 400, code: "INVALID_NOTIFICATION_ACTION", message: "Provide notification ids to mark as read or set test=true.", requestId: auth.requestId });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  await query("DELETE FROM notifications WHERE workspace_id=$1 AND read_at IS NOT NULL", [workspaceId]);
  return apiSuccess({ cleared: true }, { requestId: auth.requestId });
}
