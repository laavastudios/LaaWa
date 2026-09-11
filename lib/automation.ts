import { query, isDatabaseConfigured } from "./db";

type IncomingMessage = { id?: string; chatId?: string; body?: string; fromMe?: boolean; timestamp?: number };
type Rule = { id: string; name: string; trigger_type: string; conditions: unknown; actions: unknown };

function workerHeaders(): HeadersInit { const headers: Record<string, string> = { "content-type": "application/json" }; const secret = process.env.WHATSAPP_WORKER_SECRET; if (secret) headers.Authorization = `Bearer ${secret}`; return headers; }
function workerUrl() { return process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010"; }

function conditionsMatch(conditions: unknown, body: string) {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  const text = body.trim().toLocaleLowerCase();
  return conditions.every((condition) => {
    if (!condition || typeof condition !== "object") return true;
    const item = condition as { type?: string; value?: string };
    const value = String(item.value || "").trim().toLocaleLowerCase();
    if (!value) return true;
    if (item.type === "exact") return text === value;
    if (item.type === "starts_with") return text.startsWith(value);
    return text.includes(value);
  });
}

function replyActions(actions: unknown) {
  if (!Array.isArray(actions)) return [] as string[];
  return actions.filter((action): action is { type?: string; body?: string } => Boolean(action && typeof action === "object"))
    .filter((action) => !action.type || action.type === "reply")
    .map((action) => String(action.body || "").trim()).filter(Boolean);
}

async function context() {
  const workspace = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  if (!workspace.rows[0]) return null;
  const account = await query<{ id: string }>("SELECT id FROM whatsapp_accounts WHERE workspace_id = $1 ORDER BY created_at ASC LIMIT 1", [workspace.rows[0].id]);
  if (!account.rows[0]) return null;
  return { workspaceId: workspace.rows[0].id, accountId: account.rows[0].id };
}

export async function evaluateAutomations(message: IncomingMessage) {
  if (!isDatabaseConfigured() || message.fromMe || !message.chatId || !String(message.body || "").trim()) return;
  const ctx = await context();
  if (!ctx) return;

  const trigger = await query<{ id: string }>(
    `SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.whatsapp_account_id = $1 AND m.whatsapp_message_id = $2 LIMIT 1`,
    [ctx.accountId, String(message.id || "")],
  );
  const triggerMessageId = trigger.rows[0]?.id || null;
  if (!triggerMessageId) return;

  const rules = await query<Rule>(
    `SELECT id, name, trigger_type, conditions, actions FROM automation_rules
     WHERE workspace_id = $1 AND enabled = TRUE ORDER BY created_at ASC`, [ctx.workspaceId]);

  for (const rule of rules.rows) {
    if (rule.trigger_type !== "message" || !conditionsMatch(rule.conditions, String(message.body))) continue;
    const existing = await query<{ id: string }>("SELECT id FROM automation_runs WHERE rule_id = $1 AND trigger_message_id = $2 LIMIT 1", [rule.id, triggerMessageId]);
    if (existing.rows[0]) continue;

    const conversation = await query<{ id: string }>("SELECT id FROM conversations WHERE whatsapp_account_id = $1 AND chat_id = $2 LIMIT 1", [ctx.accountId, message.chatId]);
    const conversationId = conversation.rows[0]?.id || null;
    const run = await query<{ id: string }>(
      `INSERT INTO automation_runs (rule_id, conversation_id, trigger_message_id, status, result)
       VALUES ($1, $2, $3, 'running', $4::jsonb) RETURNING id`,
      [rule.id, conversationId, triggerMessageId, JSON.stringify({ matched: true, trigger: message.body })],
    );

    try {
      const replies = replyActions(rule.actions);
      let sent = 0;
      for (const body of replies) {
        const response = await fetch(`${workerUrl()}/send`, { method: "POST", headers: workerHeaders(), body: JSON.stringify({ chatId: message.chatId, body }) });
        if (!response.ok) throw new Error(`Worker rejected automation reply (${response.status}).`);
        sent += 1;
      }
      await query("UPDATE automation_runs SET status = 'completed', result = result || $2::jsonb, completed_at = NOW() WHERE id = $1", [run.rows[0].id, JSON.stringify({ sent })]);
    } catch (error) {
      await query("UPDATE automation_runs SET status = 'failed', error = $2, completed_at = NOW() WHERE id = $1", [run.rows[0].id, error instanceof Error ? error.message : String(error)]);
    }
  }
}
