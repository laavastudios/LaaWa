import { query } from "./db";

export type MetricsSnapshot = {
  generatedAt: string;
  accounts: { total: number; connected: number; reconnecting: number; error: number };
  messages: { total: number; inbound: number; outbound: number; failed: number; last24h: number };
  conversations: { total: number; open: number; unread: number };
  broadcasts: { total: number; running: number; failed: number; completed: number; recipientsFailed: number };
  jobs: { queued: number; running: number; failed: number; completed: number };
  webhooks: { enabled: number; pending: number; failed: number; delivered: number };
  notifications: { unread: number; pendingDelivery: number; deliveryErrors: number };
  automations: { enabledRules: number; failedRuns24h: number };
};

async function count(sql: string, params: unknown[] = []) {
  const result = await query<{ count: string }>(sql, params);
  return Number(result.rows[0]?.count || 0);
}

export async function getMetricsSnapshot(workspaceId: string): Promise<MetricsSnapshot> {
  const [accounts, connected, reconnecting, accountErrors, messages, inbound, outbound, messageFailed, messages24h, conversations, openConversations, unread, broadcasts, broadcastRunning, broadcastFailed, broadcastCompleted, recipientsFailed, jobsQueued, jobsRunning, jobsFailed, jobsCompleted, webhooksEnabled, webhookPending, webhookFailed, webhookDelivered, notificationUnread, notificationPending, notificationErrors, automationRules, automationFailed] = await Promise.all([
    count("SELECT COUNT(*)::text count FROM whatsapp_accounts WHERE workspace_id=$1", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM whatsapp_accounts WHERE workspace_id=$1 AND status='connected'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM whatsapp_accounts WHERE workspace_id=$1 AND status IN ('connecting','reconnecting')", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM whatsapp_accounts WHERE workspace_id=$1 AND status='error'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1 AND m.direction='inbound'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1 AND m.direction='outbound'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1 AND m.status='failed'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1 AND m.created_at >= NOW()-INTERVAL '24 hours'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM conversations WHERE workspace_id=$1", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM conversations WHERE workspace_id=$1 AND status='open'", [workspaceId]),
    count("SELECT COALESCE(SUM(unread_count),0)::text count FROM conversations WHERE workspace_id=$1", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM broadcasts WHERE workspace_id=$1", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM broadcasts WHERE workspace_id=$1 AND status='running'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM broadcasts WHERE workspace_id=$1 AND status='failed'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM broadcasts WHERE workspace_id=$1 AND status='completed'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM broadcast_recipients br JOIN broadcasts b ON b.id=br.broadcast_id WHERE b.workspace_id=$1 AND br.status='failed'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM jobs WHERE workspace_id=$1 AND status IN ('queued','scheduled')", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM jobs WHERE workspace_id=$1 AND status='running'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM jobs WHERE workspace_id=$1 AND status='failed'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM jobs WHERE workspace_id=$1 AND status='completed'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM webhooks WHERE workspace_id=$1 AND enabled=true", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id WHERE w.workspace_id=$1 AND d.status='pending'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id WHERE w.workspace_id=$1 AND d.status='failed'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id WHERE w.workspace_id=$1 AND d.status='delivered'", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM notifications WHERE workspace_id=$1 AND read_at IS NULL", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM notifications WHERE workspace_id=$1 AND (browser_sent_at IS NULL OR email_sent_at IS NULL)", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM notifications WHERE workspace_id=$1 AND delivery_error IS NOT NULL", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM automation_rules WHERE workspace_id=$1 AND enabled=true", [workspaceId]),
    count("SELECT COUNT(*)::text count FROM automation_runs r JOIN automation_rules a ON a.id=r.rule_id WHERE a.workspace_id=$1 AND r.status='failed' AND r.created_at >= NOW()-INTERVAL '24 hours'", [workspaceId]),
  ]);
  return { generatedAt: new Date().toISOString(), accounts: { total: accounts, connected, reconnecting, error: accountErrors }, messages: { total: messages, inbound, outbound, failed: messageFailed, last24h: messages24h }, conversations: { total: conversations, open: openConversations, unread }, broadcasts: { total: broadcasts, running: broadcastRunning, failed: broadcastFailed, completed: broadcastCompleted, recipientsFailed }, jobs: { queued: jobsQueued, running: jobsRunning, failed: jobsFailed, completed: jobsCompleted }, webhooks: { enabled: webhooksEnabled, pending: webhookPending, failed: webhookFailed, delivered: webhookDelivered }, notifications: { unread: notificationUnread, pendingDelivery: notificationPending, deliveryErrors: notificationErrors }, automations: { enabledRules: automationRules, failedRuns24h: automationFailed } };
}

function metricLine(name: string, value: number, help: string) {
  return `# HELP ${name} ${help}\n# TYPE ${name} gauge\n${name} ${Number.isFinite(value) ? value : 0}`;
}

export function toPrometheus(snapshot: MetricsSnapshot) {
  const metrics = [
    ["laawa_workspace_up", 1, "Whether the workspace metrics endpoint is operational."],
    ["laawa_whatsapp_accounts_total", snapshot.accounts.total, "Total WhatsApp accounts."],
    ["laawa_whatsapp_accounts_connected", snapshot.accounts.connected, "Connected WhatsApp accounts."],
    ["laawa_whatsapp_accounts_reconnecting", snapshot.accounts.reconnecting, "WhatsApp accounts connecting or reconnecting."],
    ["laawa_whatsapp_accounts_error", snapshot.accounts.error, "WhatsApp accounts in error state."],
    ["laawa_messages_total", snapshot.messages.total, "Total persisted messages."],
    ["laawa_messages_inbound_total", snapshot.messages.inbound, "Total inbound messages."],
    ["laawa_messages_outbound_total", snapshot.messages.outbound, "Total outbound messages."],
    ["laawa_messages_failed", snapshot.messages.failed, "Persisted messages with failed status."],
    ["laawa_messages_24h", snapshot.messages.last24h, "Messages created in the last 24 hours."],
    ["laawa_conversations_total", snapshot.conversations.total, "Total conversations."],
    ["laawa_conversations_open", snapshot.conversations.open, "Open conversations."],
    ["laawa_conversations_unread", snapshot.conversations.unread, "Unread conversation messages."],
    ["laawa_broadcasts_total", snapshot.broadcasts.total, "Total broadcasts."],
    ["laawa_broadcasts_running", snapshot.broadcasts.running, "Running broadcasts."],
    ["laawa_broadcasts_failed", snapshot.broadcasts.failed, "Failed broadcasts."],
    ["laawa_broadcasts_completed", snapshot.broadcasts.completed, "Completed broadcasts."],
    ["laawa_broadcast_recipients_failed", snapshot.broadcasts.recipientsFailed, "Failed broadcast recipients."],
    ["laawa_jobs_queued", snapshot.jobs.queued, "Queued or scheduled jobs."],
    ["laawa_jobs_running", snapshot.jobs.running, "Running jobs."],
    ["laawa_jobs_failed", snapshot.jobs.failed, "Failed jobs."],
    ["laawa_jobs_completed", snapshot.jobs.completed, "Completed jobs."],
    ["laawa_webhooks_enabled", snapshot.webhooks.enabled, "Enabled webhooks."],
    ["laawa_webhook_deliveries_pending", snapshot.webhooks.pending, "Pending webhook deliveries."],
    ["laawa_webhook_deliveries_failed", snapshot.webhooks.failed, "Failed webhook deliveries."],
    ["laawa_webhook_deliveries_delivered", snapshot.webhooks.delivered, "Delivered webhook deliveries."],
    ["laawa_notifications_unread", snapshot.notifications.unread, "Unread notifications."],
    ["laawa_notifications_pending_delivery", snapshot.notifications.pendingDelivery, "Notifications awaiting channel delivery."],
    ["laawa_notifications_delivery_errors", snapshot.notifications.deliveryErrors, "Notifications with delivery errors."],
    ["laawa_automation_rules_enabled", snapshot.automations.enabledRules, "Enabled automation rules."],
    ["laawa_automation_failed_runs_24h", snapshot.automations.failedRuns24h, "Automation runs failed in the last 24 hours."],
  ] as const;
  return `${metrics.map(([name,value,help]) => metricLine(name, value, help)).join("\n")}\n`;
}
