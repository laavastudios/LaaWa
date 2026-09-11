export async function notifyWorkspace(pool, workspaceId, eventType, severity, title, body, data = {}) {
  if (!workspaceId) return;
  try {
    const rule = await pool.query("SELECT enabled,cooldown_seconds FROM notification_rules WHERE workspace_id=$1 AND event_type=$2 LIMIT 1", [workspaceId, eventType]);
    if (rule.rows[0]?.enabled === false) return;
    const cooldown = Number(rule.rows[0]?.cooldown_seconds || 0);
    if (cooldown > 0) {
      const recent = await pool.query("SELECT id FROM notifications WHERE workspace_id=$1 AND event_type=$2 AND created_at > NOW() - ($3::int * INTERVAL '1 second') LIMIT 1", [workspaceId, eventType, cooldown]);
      if (recent.rows[0]) return;
    }
    await pool.query("INSERT INTO notifications (workspace_id,event_type,severity,title,body,data) VALUES ($1,$2,$3,$4,$5,$6)", [workspaceId, eventType, severity, String(title).slice(0, 180), String(body).slice(0, 2000), JSON.stringify(data)]);
  } catch (error) {
    console.error("[notifications] Could not record notification:", error instanceof Error ? error.message : String(error));
  }
}

export async function workspaceForAccount(pool, accountId) {
  try {
    const result = await pool.query("SELECT workspace_id FROM whatsapp_accounts WHERE session_key=$1 LIMIT 1", [accountId]);
    return result.rows[0]?.workspace_id || null;
  } catch {
    return null;
  }
}
