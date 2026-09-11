import { type PoolClient, type QueryResultRow, Pool } from "pg";
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
  await (executor as Pool).query(
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
  const result = await query<PrivacyPolicy>(
    `SELECT workspace_id AS "workspaceId", message_retention_days AS "messageRetentionDays",
      notification_retention_days AS "notificationRetentionDays", audit_log_retention_days AS "auditLogRetentionDays",
      updated_at AS "updatedAt" FROM privacy_policies WHERE workspace_id=$1 LIMIT 1`,
    [workspaceId],
  );
  return result.rows[0];
}

export async function updatePrivacyPolicy(workspaceId: string, policy: Partial<Omit<PrivacyPolicy, "workspaceId" | "updatedAt">>) {
  await ensurePolicy(workspaceId);
  const result = await query<PrivacyPolicy>(
    `UPDATE privacy_policies SET message_retention_days=$2, notification_retention_days=$3,
      audit_log_retention_days=$4, updated_at=NOW() WHERE workspace_id=$1
     RETURNING workspace_id AS "workspaceId", message_retention_days AS "messageRetentionDays",
      notification_retention_days AS "notificationRetentionDays", audit_log_retention_days AS "auditLogRetentionDays",
      updated_at AS "updatedAt"`,
    [workspaceId, policy.messageRetentionDays ?? DEFAULT_POLICY.messageRetentionDays, policy.notificationRetentionDays ?? DEFAULT_POLICY.notificationRetentionDays, policy.auditLogRetentionDays ?? DEFAULT_POLICY.auditLogRetentionDays],
  );
  return result.rows[0];
}

export async function getPrivacySummary(workspaceId: string): Promise<PrivacySummary> {
  const result = await query<PrivacySummary>(
    `SELECT w.id AS "workspaceId", w.name AS "workspaceName",
      (SELECT COUNT(*)::int FROM contacts WHERE workspace_id=w.id) AS "contacts",
      (SELECT COUNT(*)::int FROM conversations WHERE workspace_id=w.id) AS "conversations",
      (SELECT COUNT(*)::int FROM messages WHERE workspace_id=w.id) AS "messages",
      (SELECT COUNT(*)::int FROM media_assets WHERE workspace_id=w.id) AS "mediaAssets",
      (SELECT COUNT(*)::int FROM broadcasts WHERE workspace_id=w.id) AS "broadcasts",
      (SELECT COUNT(*)::int FROM automation_runs WHERE workspace_id=w.id) AS "automations",
      (SELECT COUNT(*)::int FROM integrations WHERE workspace_id=w.id) AS "integrations",
      (SELECT COUNT(*)::int FROM notification_subscriptions WHERE workspace_id=w.id) AS "notifications",
      (SELECT COUNT(*)::int FROM audit_logs WHERE workspace_id=w.id) AS "auditLogs"
     FROM workspaces w WHERE w.id=$1 LIMIT 1`,
    [workspaceId],
  );
  const row = result.rows[0];
  return {
    workspaceId,
    workspaceName: row?.workspaceName ?? "Workspace",
    counts: {
      contacts: Number((row as QueryResultRow & { contacts?: number })?.contacts ?? 0),
      conversations: Number((row as QueryResultRow & { conversations?: number })?.conversations ?? 0),
      messages: Number((row as QueryResultRow & { messages?: number })?.messages ?? 0),
      mediaAssets: Number((row as QueryResultRow & { mediaAssets?: number })?.mediaAssets ?? 0),
      broadcasts: Number((row as QueryResultRow & { broadcasts?: number })?.broadcasts ?? 0),
      automations: Number((row as QueryResultRow & { automations?: number })?.automations ?? 0),
      integrations: Number((row as QueryResultRow & { integrations?: number })?.integrations ?? 0),
      notifications: Number((row as QueryResultRow & { notifications?: number })?.notifications ?? 0),
      auditLogs: Number((row as QueryResultRow & { auditLogs?: number })?.auditLogs ?? 0),
    },
    oldest: { message: null, notification: null, auditLog: null },
  };
}
