import { query } from "./db";

export type NotificationSeverity = "info" | "warning" | "critical";
export type NotificationChannel = "browser" | "email";

const SEVERITY_RANK: Record<NotificationSeverity, number> = { info: 0, warning: 1, critical: 2 };

export const NOTIFICATION_EVENTS = [
  "whatsapp.connection",
  "broadcast.failure",
  "worker.failure",
  "webhook.failure",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type NotificationRecord = {
  id: string;
  eventType: NotificationEvent;
  severity: NotificationSeverity;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export async function notificationWorkspace(workspaceId: string | null | undefined) {
  if (workspaceId) return workspaceId;
  const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  return result.rows[0]?.id ?? null;
}

export async function createNotification(input: {
  workspaceId: string;
  eventType: NotificationEvent | string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const rule = await query<{ enabled: boolean; severity: NotificationSeverity; channels: unknown; cooldown_seconds: number }>(
    "SELECT enabled, severity, channels, cooldown_seconds FROM notification_rules WHERE workspace_id=$1 AND event_type=$2 LIMIT 1",
    [input.workspaceId, input.eventType],
  );
  const configured = rule.rows[0];
  if (configured && !configured.enabled) return null;
  const severity = configured?.severity ?? input.severity;
  if (configured?.cooldown_seconds) {
    const recent = await query<{ id: string }>(
      "SELECT id FROM notifications WHERE workspace_id=$1 AND event_type=$2 AND created_at > NOW() - ($3::int * INTERVAL '1 second') ORDER BY created_at DESC LIMIT 1",
      [input.workspaceId, input.eventType, configured.cooldown_seconds],
    );
    if (recent.rows[0]) return null;
  }
  const result = await query<{ id: string }>(
    "INSERT INTO notifications (workspace_id,event_type,severity,title,body,data) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [input.workspaceId, input.eventType, severity, input.title.slice(0, 180), input.body.slice(0, 2000), JSON.stringify(input.data ?? {})],
  );
  return result.rows[0]?.id ?? null;
}

export async function listNotifications(workspaceId: string, limit = 50): Promise<NotificationRecord[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const result = await query<{ id: string; event_type: NotificationEvent; severity: NotificationSeverity; title: string; body: string; data: Record<string, unknown>; read_at: string | null; created_at: string }>(
    `SELECT id,event_type,severity,title,body,data,read_at,created_at
       FROM notifications WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT ${safeLimit}`,
    [workspaceId],
  );
  return result.rows.map((row) => ({ id: row.id, eventType: row.event_type, severity: row.severity, title: row.title, body: row.body, data: row.data || {}, readAt: row.read_at, createdAt: row.created_at }));
}

export async function unreadNotificationCount(workspaceId: string) {
  const result = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM notifications WHERE workspace_id=$1 AND read_at IS NULL", [workspaceId]);
  return Number(result.rows[0]?.count || 0);
}

export async function markNotificationsRead(workspaceId: string, ids: string[]) {
  const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  if (!valid.length) return 0;
  const result = await query("UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE workspace_id=$1 AND id=ANY($2::uuid[])", [workspaceId, valid]);
  return result.rowCount ?? 0;
}

export async function getNotificationPreferences(workspaceId: string) {
  const result = await query<{ browser_enabled: boolean; email_enabled: boolean; email_address: string | null; minimum_severity: NotificationSeverity }>(
    "SELECT browser_enabled,email_enabled,email_address,minimum_severity FROM notification_preferences WHERE workspace_id=$1 LIMIT 1",
    [workspaceId],
  );
  return result.rows[0] || { browser_enabled: true, email_enabled: false, email_address: null, minimum_severity: "warning" as NotificationSeverity };
}

export function meetsMinimumSeverity(severity: NotificationSeverity, minimum: NotificationSeverity) {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minimum];
}

export async function upsertNotificationPreferences(workspaceId: string, input: { browserEnabled?: boolean; emailEnabled?: boolean; emailAddress?: string | null; minimumSeverity?: NotificationSeverity }) {
  const current = await getNotificationPreferences(workspaceId);
  const browserEnabled = input.browserEnabled ?? current.browser_enabled;
  const emailEnabled = input.emailEnabled ?? current.email_enabled;
  const emailAddress = input.emailAddress === undefined ? current.email_address : input.emailAddress;
  const minimumSeverity = input.minimumSeverity ?? current.minimum_severity;
  await query(
    `INSERT INTO notification_preferences (workspace_id,browser_enabled,email_enabled,email_address,minimum_severity)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (workspace_id) DO UPDATE SET browser_enabled=EXCLUDED.browser_enabled,email_enabled=EXCLUDED.email_enabled,email_address=EXCLUDED.email_address,minimum_severity=EXCLUDED.minimum_severity,updated_at=NOW()`,
    [workspaceId, browserEnabled, emailEnabled, emailAddress, minimumSeverity],
  );
  return { browser_enabled: browserEnabled, email_enabled: emailEnabled, email_address: emailAddress, minimum_severity: minimumSeverity };
}
