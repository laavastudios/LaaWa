import { type PoolClient } from "pg";
import { query, withTransaction } from "./db";

export type PrivacyPolicy = {
  workspaceId: string;
  messageRetentionDays: number;
  notificationRetentionDays: number;
  auditLogRetentionDays: number;
  updatedAt: string;
};

export type PrivacySummary = {
  workspaceId: string;
  workspaceName: string;
  counts: {
    contacts: number;
    conversations: number;
    messages: number;
    mediaAssets: number;
    broadcasts: number;
    automations: number;
    integrations: number;
    notifications: number;
    auditLogs: number;
  };
  oldest: {
    message: string | null;
    notification: string | null;
    auditLog: string | null;
  };
};

const DEFAULT_POLICY: Omit<PrivacyPolicy, "workspaceId" | "updatedAt"> = {
  messageRetentionDays: 0,
  notificationRetentionDays: 90,
  auditLogRetentionDays: 365,
};

async function ensurePolicy(workspaceId: string, client?: PoolClient) {
  const executor = client ?? { query };
  await executor.query(
    `INSERT INTO privacy_policies (workspace_id, message_retention_days, notification_retention_days, audit_log_retention_days)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id) DO NOTHING`,
    [workspaceId, DEFAULT_POLICY.messageRetentionDays, DEFAULT_POLICY.notificationRetentionDays, DEFAULT_POLICY.auditLogRetentionDays],
  );
}

export async function privacyWorkspace(principalWorkspaceId?: string) {
  if (principalWorkspaceId) return principalWorkspaceId;
  const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  return result.rows[0]?.id ?? null;
}

export async function getPrivacyPolicy(workspaceId: string): Promise<PrivacyPolicy> {
  await ensurePolicy(workspaceId);
  const result = await query<{
    workspace_id: string;
    message_retention_days: number;
    notification_retention_days: number;
    audit_log_retention_days: number;
    updated_at: Date;
  }>(
    `SELECT workspace_id, message_retention_days, notification_retention_days, audit_log_retention_days, updated_at
       FROM privacy_policies WHERE workspace_id = $1`,
    [workspaceId],
  );
  const row = result.rows[0];
  return {
    workspaceId: row.workspace_id,
    messageRetentionDays: row.message_retention_days,
    notificationRetentionDays: row.notification_retention_days,
    auditLogRetentionDays: row.audit_log_retention_days,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function updatePrivacyPolicy(
  workspaceId: string,
  input: Partial<Omit<PrivacyPolicy, "workspaceId" | "updatedAt">>,
) {
  const current = await getPrivacyPolicy(workspaceId);
  const messageRetentionDays = input.messageRetentionDays ?? current.messageRetentionDays;
  const notificationRetentionDays = input.notificationRetentionDays ?? current.notificationRetentionDays;
  const auditLogRetentionDays = input.auditLogRetentionDays ?? current.auditLogRetentionDays;
  for (const [label, value] of [
    ["messageRetentionDays", messageRetentionDays],
    ["notificationRetentionDays", notificationRetentionDays],
    ["auditLogRetentionDays", auditLogRetentionDays],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 3650) throw new Error(`${label} must be an integer between 0 and 3650.`);
  }

  await query(
    `INSERT INTO privacy_policies (workspace_id, message_retention_days, notification_retention_days, audit_log_retention_days, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       message_retention_days = EXCLUDED.message_retention_days,
       notification_retention_days = EXCLUDED.notification_retention_days,
       audit_log_retention_days = EXCLUDED.audit_log_retention_days,
       updated_at = NOW()`,
    [workspaceId, messageRetentionDays, notificationRetentionDays, auditLogRetentionDays],
  );
  return getPrivacyPolicy(workspaceId);
}

export async function getPrivacySummary(workspaceId: string): Promise<PrivacySummary> {
  const workspace = await query<{ id: string; name: string }>("SELECT id, name FROM workspaces WHERE id = $1", [workspaceId]);
  const row = workspace.rows[0];
  if (!row) throw new Error("Workspace not found.");

  const [contacts, conversations, messages, mediaAssets, broadcasts, automations, integrations, notifications, auditLogs, oldestMessage, oldestNotification, oldestAudit] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM contacts WHERE workspace_id = $1", [workspaceId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM conversations WHERE workspace_id = $1", [workspaceId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.workspace_id = $1", [workspaceId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM media_assets WHERE workspace_id = $1", [workspaceId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM broadcasts WHERE workspace_id = $1", [workspaceId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM automation_rules WHERE workspace_id = $1", [workspaceId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM integration_connections WHERE workspace_id = $1", [workspaceId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM notifications WHERE workspace_id = $1", [workspaceId]),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM audit_logs WHERE workspace_id = $1", [workspaceId]),
    query<{ value: Date | null }>("SELECT MIN(m.created_at) AS value FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.workspace_id = $1", [workspaceId]),
    query<{ value: Date | null }>("SELECT MIN(created_at) AS value FROM notifications WHERE workspace_id = $1", [workspaceId]),
    query<{ value: Date | null }>("SELECT MIN(created_at) AS value FROM audit_logs WHERE workspace_id = $1", [workspaceId]),
  ]);

  return {
    workspaceId,
    workspaceName: row.name,
    counts: {
      contacts: Number(contacts.rows[0]?.count ?? 0),
      conversations: Number(conversations.rows[0]?.count ?? 0),
      messages: Number(messages.rows[0]?.count ?? 0),
      mediaAssets: Number(mediaAssets.rows[0]?.count ?? 0),
      broadcasts: Number(broadcasts.rows[0]?.count ?? 0),
      automations: Number(automations.rows[0]?.count ?? 0),
      integrations: Number(integrations.rows[0]?.count ?? 0),
      notifications: Number(notifications.rows[0]?.count ?? 0),
      auditLogs: Number(auditLogs.rows[0]?.count ?? 0),
    },
    oldest: {
      message: oldestMessage.rows[0]?.value?.toISOString() ?? null,
      notification: oldestNotification.rows[0]?.value?.toISOString() ?? null,
      auditLog: oldestAudit.rows[0]?.value?.toISOString() ?? null,
    },
  };
}

async function exportQuery<T>(client: PoolClient, text: string, values: unknown[]) {
  const result = await client.query<T>(text, values);
  return result.rows;
}

export async function exportWorkspaceData(workspaceId: string) {
  return withTransaction(async (client) => {
    const workspace = (await exportQuery<{ id: string; name: string; created_at: Date; updated_at: Date }>(client, "SELECT id, name, created_at, updated_at FROM workspaces WHERE id = $1", [workspaceId]))[0];
    if (!workspace) throw new Error("Workspace not found.");

    const [accounts, contacts, tags, conversations, messages, mediaAssets, templates, broadcasts, broadcastRecipients, schedules, automationRules, automationRuns, webhooks, webhookDeliveries, apiKeys, auditLogs, appSettings, jobs, jobRuns, scheduledJobs, integrations, notificationPreferences, notificationRules, notifications, pushSubscriptions, privacyPolicy] = await Promise.all([
      exportQuery(client, "SELECT id, name, engine, phone_number, session_key, status, metadata, last_connected_at, created_at, updated_at FROM whatsapp_accounts WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, whatsapp_account_id, wa_id, phone, name, push_name, avatar_url, email, notes, metadata, created_at, updated_at FROM contacts WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, name, created_at FROM tags WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, whatsapp_account_id, contact_id, chat_id, chat_type, title, status, unread_count, last_message_at, last_message_preview, metadata, created_at, updated_at FROM conversations WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT m.id, m.conversation_id, m.whatsapp_account_id, m.whatsapp_message_id, m.direction, m.sender_wa_id, m.recipient_wa_id, m.message_type, m.body, m.media_asset_id, m.status, m.quoted_message_id, m.external_timestamp, m.metadata, m.created_at FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.workspace_id = $1 ORDER BY m.created_at", [workspaceId]),
      exportQuery(client, "SELECT id, storage_key, original_name, mime_type, size_bytes, sha256, width, height, duration_ms, created_at FROM media_assets WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, name, category, language, body, variables, status, created_at, updated_at FROM templates WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, whatsapp_account_id, template_id, name, body, status, scheduled_for, started_at, completed_at, total_count, sent_count, delivered_count, failed_count, metadata, created_at, updated_at FROM broadcasts WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT br.id, br.broadcast_id, br.contact_id, br.chat_id, br.rendered_body, br.status, br.attempts, br.last_error, br.sent_at, br.delivered_at, br.created_at, br.updated_at FROM broadcast_recipients br JOIN broadcasts b ON b.id = br.broadcast_id WHERE b.workspace_id = $1 ORDER BY br.created_at", [workspaceId]),
      exportQuery(client, "SELECT id, whatsapp_account_id, conversation_id, contact_id, body, media_asset_id, run_at, status, attempts, last_error, created_at, updated_at FROM schedules WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, name, enabled, trigger_type, conditions, actions, created_at, updated_at FROM automation_rules WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT ar.id, ar.rule_id, ar.conversation_id, ar.trigger_message_id, ar.status, ar.result, ar.error, ar.started_at, ar.completed_at, ar.created_at FROM automation_runs ar JOIN automation_rules r ON r.id = ar.rule_id WHERE r.workspace_id = $1 ORDER BY ar.created_at", [workspaceId]),
      exportQuery(client, "SELECT id, name, url, events, enabled, created_at, updated_at FROM webhooks WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT wd.id, wd.webhook_id, wd.event_type, wd.payload, wd.status, wd.attempts, wd.response_status, wd.response_body, wd.next_attempt_at, wd.delivered_at, wd.created_at FROM webhook_deliveries wd JOIN webhooks w ON w.id = wd.webhook_id WHERE w.workspace_id = $1 ORDER BY wd.created_at", [workspaceId]),
      exportQuery(client, "SELECT id, name, key_prefix, scopes, expires_at, last_used_at, revoked_at, created_at FROM api_keys WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, actor_type, actor_id, action, resource_type, resource_id, ip_address, user_agent, metadata, created_at FROM audit_logs WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT key, value, updated_at FROM app_settings WHERE workspace_id = $1 ORDER BY key", [workspaceId]),
      exportQuery(client, "SELECT id, whatsapp_account_id, schedule_id, type, status, payload, idempotency_key, attempts, max_attempts, run_at, locked_at, locked_by, last_error, completed_at, created_at, updated_at FROM jobs WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT jr.id, jr.job_id, jr.attempt, jr.status, jr.started_at, jr.finished_at, jr.error, jr.metadata FROM job_runs jr JOIN jobs j ON j.id = jr.job_id WHERE j.workspace_id = $1 ORDER BY jr.started_at", [workspaceId]),
      exportQuery(client, "SELECT id, whatsapp_account_id, conversation_id, contact_id, name, body, run_at, timezone, recurrence, status, next_run_at, last_job_id, created_at, updated_at FROM scheduled_jobs WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, provider, name, enabled, last_tested_at, last_error, created_at, updated_at FROM integration_connections WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT workspace_id, browser_enabled, email_enabled, email_address, minimum_severity, updated_at FROM notification_preferences WHERE workspace_id = $1", [workspaceId]),
      exportQuery(client, "SELECT id, event_type, enabled, severity, channels, cooldown_seconds, created_at, updated_at FROM notification_rules WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, event_type, severity, title, body, data, read_at, browser_sent_at, email_sent_at, delivery_error, created_at FROM notifications WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT id, principal_id, endpoint, p256dh, auth, user_agent, created_at, last_seen_at FROM notification_push_subscriptions WHERE workspace_id = $1 ORDER BY created_at", [workspaceId]),
      exportQuery(client, "SELECT workspace_id, message_retention_days, notification_retention_days, audit_log_retention_days, updated_at FROM privacy_policies WHERE workspace_id = $1", [workspaceId]),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      format: "laawa-privacy-export-v1",
      workspace: { id: workspace.id, name: workspace.name, createdAt: workspace.created_at, updatedAt: workspace.updated_at },
      accounts,
      contacts,
      tags,
      conversations,
      messages,
      mediaAssets,
      templates,
      broadcasts,
      broadcastRecipients,
      schedules,
      automationRules,
      automationRuns,
      webhooks,
      webhookDeliveries,
      apiKeys,
      auditLogs,
      appSettings,
      jobs,
      jobRuns,
      scheduledJobs,
      integrations,
      notificationPreferences,
      notificationRules,
      notifications,
      pushSubscriptions,
      privacyPolicy,
    };
  });
}

export async function runPrivacyRetention(workspaceId: string) {
  return withTransaction(async (client) => {
    await ensurePolicy(workspaceId, client);
    const policyResult = await client.query<{ message_retention_days: number; notification_retention_days: number; audit_log_retention_days: number }>(
      "SELECT message_retention_days, notification_retention_days, audit_log_retention_days FROM privacy_policies WHERE workspace_id = $1",
      [workspaceId],
    );
    const policy = policyResult.rows[0];
    if (!policy) throw new Error("Privacy policy could not be loaded.");

    const result = { messages: 0, mediaAssets: 0, notifications: 0, auditLogs: 0 };
    if (policy.message_retention_days > 0) {
      const deleted = await client.query(
        `DELETE FROM messages
         WHERE id IN (
           SELECT m.id FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
           WHERE c.workspace_id = $1 AND m.created_at < NOW() - ($2::int * INTERVAL '1 day')
         )`,
        [workspaceId, policy.message_retention_days],
      );
      result.messages = deleted.rowCount ?? 0;
    }
    if (policy.message_retention_days > 0) {
      const deleted = await client.query(
        `DELETE FROM media_assets ma
         WHERE ma.workspace_id = $1
           AND ma.created_at < NOW() - ($2::int * INTERVAL '1 day')
           AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.media_asset_id = ma.id)`,
        [workspaceId, policy.message_retention_days],
      );
      result.mediaAssets = deleted.rowCount ?? 0;
    }
    if (policy.notification_retention_days > 0) {
      const deleted = await client.query(
        "DELETE FROM notifications WHERE workspace_id = $1 AND created_at < NOW() - ($2::int * INTERVAL '1 day')",
        [workspaceId, policy.notification_retention_days],
      );
      result.notifications = deleted.rowCount ?? 0;
    }
    if (policy.audit_log_retention_days > 0) {
      const deleted = await client.query(
        "DELETE FROM audit_logs WHERE workspace_id = $1 AND created_at < NOW() - ($2::int * INTERVAL '1 day')",
        [workspaceId, policy.audit_log_retention_days],
      );
      result.auditLogs = deleted.rowCount ?? 0;
    }
    return { policy, result, ranAt: new Date().toISOString() };
  });
}

export async function eraseWorkspaceData(workspaceId: string, actorId: string) {
  return withTransaction(async (client) => {
    const workspace = (await client.query<{ id: string; name: string }>("SELECT id, name FROM workspaces WHERE id = $1 FOR UPDATE", [workspaceId])).rows[0];
    if (!workspace) throw new Error("Workspace not found.");

    const counts: Record<string, number> = {};
    const statements: Array<[string, string]> = [
      ["automationRuns", "DELETE FROM automation_runs WHERE rule_id IN (SELECT id FROM automation_rules WHERE workspace_id = $1)"],
      ["automationRules", "DELETE FROM automation_rules WHERE workspace_id = $1"],
      ["jobRuns", "DELETE FROM job_runs WHERE job_id IN (SELECT id FROM jobs WHERE workspace_id = $1)"],
      ["scheduledJobs", "DELETE FROM scheduled_jobs WHERE workspace_id = $1"],
      ["jobs", "DELETE FROM jobs WHERE workspace_id = $1"],
      ["webhookDeliveries", "DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM webhooks WHERE workspace_id = $1)"],
      ["webhooks", "DELETE FROM webhooks WHERE workspace_id = $1"],
      ["broadcastRecipients", "DELETE FROM broadcast_recipients WHERE broadcast_id IN (SELECT id FROM broadcasts WHERE workspace_id = $1)"],
      ["broadcasts", "DELETE FROM broadcasts WHERE workspace_id = $1"],
      ["templates", "DELETE FROM templates WHERE workspace_id = $1"],
      ["schedules", "DELETE FROM schedules WHERE workspace_id = $1"],
      ["messages", "DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE workspace_id = $1)"],
      ["conversations", "DELETE FROM conversations WHERE workspace_id = $1"],
      ["contactTags", "DELETE FROM contact_tags WHERE contact_id IN (SELECT id FROM contacts WHERE workspace_id = $1)"],
      ["contacts", "DELETE FROM contacts WHERE workspace_id = $1"],
      ["tags", "DELETE FROM tags WHERE workspace_id = $1"],
      ["mediaAssets", "DELETE FROM media_assets WHERE workspace_id = $1"],
      ["notificationPushSubscriptions", "DELETE FROM notification_push_subscriptions WHERE workspace_id = $1"],
      ["notifications", "DELETE FROM notifications WHERE workspace_id = $1"],
      ["notificationRules", "DELETE FROM notification_rules WHERE workspace_id = $1"],
      ["notificationPreferences", "DELETE FROM notification_preferences WHERE workspace_id = $1"],
      ["integrations", "DELETE FROM integration_connections WHERE workspace_id = $1"],
      ["apiKeys", "DELETE FROM api_keys WHERE workspace_id = $1"],
      ["auditLogs", "DELETE FROM audit_logs WHERE workspace_id = $1"],
      ["appSettings", "DELETE FROM app_settings WHERE workspace_id = $1"],
      ["privacyPolicy", "DELETE FROM privacy_policies WHERE workspace_id = $1"],
      ["accounts", "DELETE FROM whatsapp_accounts WHERE workspace_id = $1"],
    ];

    for (const [key, sql] of statements) {
      const result = await client.query(sql, [workspaceId]);
      counts[key] = result.rowCount ?? 0;
    }

    await client.query(
      `INSERT INTO audit_logs (workspace_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'user', $2, 'privacy.data_erasure', 'workspace', $1, $3::jsonb)`,
      [workspaceId, actorId, JSON.stringify({ erasedAt: new Date().toISOString(), counts })],
    );

    return { workspaceId, workspaceName: workspace.name, counts, erasedAt: new Date().toISOString() };
  });
}
