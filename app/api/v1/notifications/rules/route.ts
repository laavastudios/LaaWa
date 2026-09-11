import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../lib/api";
import { notificationWorkspace } from "../../../../../lib/notifications";
import { query } from "../../../../../lib/db";

export const runtime = "nodejs";
const EVENTS = ["whatsapp.connection", "broadcast.failure", "worker.failure", "webhook.failure"] as const;
const SEVERITIES = ["info", "warning", "critical"] as const;
const CHANNELS = ["browser", "email"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  const result = await query("SELECT id,event_type,enabled,severity,channels,cooldown_seconds,updated_at FROM notification_rules WHERE workspace_id=$1 ORDER BY event_type", [workspaceId]);
  return apiSuccess({ rules: result.rows }, { requestId: auth.requestId });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const workspaceId = await notificationWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId });
  let body: { eventType?: unknown; enabled?: unknown; severity?: unknown; channels?: unknown; cooldownSeconds?: unknown };
  try { body = await request.json(); } catch { return apiError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON.", requestId: auth.requestId }); }
  const eventType = typeof body.eventType === "string" && EVENTS.includes(body.eventType as typeof EVENTS[number]) ? body.eventType : null;
  const severity = typeof body.severity === "string" && SEVERITIES.includes(body.severity as typeof SEVERITIES[number]) ? body.severity : null;
  const channels = Array.isArray(body.channels) ? body.channels.filter((item): item is string => typeof item === "string" && CHANNELS.includes(item as typeof CHANNELS[number])) : null;
  const cooldownSeconds = typeof body.cooldownSeconds === "number" && Number.isFinite(body.cooldownSeconds) ? Math.min(86400, Math.max(0, Math.floor(body.cooldownSeconds))) : null;
  if (!eventType || !severity || !channels?.length || cooldownSeconds === null || typeof body.enabled !== "boolean") return apiError({ status: 400, code: "INVALID_NOTIFICATION_RULE", message: "eventType, enabled, severity, channels, and cooldownSeconds are required.", requestId: auth.requestId });
  const result = await query(
    `INSERT INTO notification_rules (workspace_id,event_type,enabled,severity,channels,cooldown_seconds)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (workspace_id,event_type) DO UPDATE SET enabled=EXCLUDED.enabled,severity=EXCLUDED.severity,channels=EXCLUDED.channels,cooldown_seconds=EXCLUDED.cooldown_seconds,updated_at=NOW()
     RETURNING id,event_type,enabled,severity,channels,cooldown_seconds,updated_at`,
    [workspaceId, eventType, body.enabled, severity, JSON.stringify(channels), cooldownSeconds],
  );
  return apiSuccess(result.rows[0], { requestId: auth.requestId });
}
