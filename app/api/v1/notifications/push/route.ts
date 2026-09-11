import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../../lib/api";
import { notificationWorkspace } from "../../../../../../lib/notifications";
import { query } from "../../../../../../lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  const result = await query<{ id: string }>("SELECT id FROM notification_push_subscriptions WHERE workspace_id=$1 AND principal_id=$2 LIMIT 1", [workspaceId, auth.principal.id]);
  return apiSuccess({ subscribed: Boolean(result.rows[0]) }, { requestId: auth.requestId });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "write");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try { body = await request.json(); } catch { return apiError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON.", requestId: auth.requestId }); }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const authKey = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !/^https:\/\//i.test(endpoint) || !p256dh || !authKey) return apiError({ status: 400, code: "INVALID_PUSH_SUBSCRIPTION", message: "A valid HTTPS push subscription is required.", requestId: auth.requestId });
  await query(
    `INSERT INTO notification_push_subscriptions (workspace_id,principal_id,endpoint,p256dh,auth,user_agent,last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (workspace_id,endpoint) DO UPDATE SET principal_id=EXCLUDED.principal_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,user_agent=EXCLUDED.user_agent,last_seen_at=NOW()`,
    [workspaceId, auth.principal.id, endpoint.slice(0, 2048), p256dh.slice(0, 512), authKey.slice(0, 512), request.headers.get("user-agent")?.slice(0, 500) || null],
  );
  return apiSuccess({ subscribed: true }, { status: 201, requestId: auth.requestId });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, "write");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  await query("DELETE FROM notification_push_subscriptions WHERE workspace_id=$1 AND principal_id=$2", [workspaceId, auth.principal.id]);
  return apiSuccess({ subscribed: false }, { requestId: auth.requestId });
}
