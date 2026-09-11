import type { ApiPrincipal } from "./api";
import { query } from "./db";
import { getWhatsAppEngine, getWhatsAppEngineUrl, normalizeWhatsAppEngine, type WhatsAppEngineId } from "./whatsapp/engines";

export const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";
export const managerUrl = process.env.WHATSAPP_MANAGER_URL || "http://127.0.0.1:3020";

function workerHeaders() {
  const secret = process.env.WHATSAPP_WORKER_SECRET;
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}

export async function workspaceFor(principal: ApiPrincipal) {
  if (principal.workspaceId) return principal.workspaceId;
  const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  return result.rows[0]?.id || null;
}

export async function accountFor(principal: ApiPrincipal, accountId: string) {
  const workspaceId = await workspaceFor(principal);
  if (!workspaceId || !accountId) return null;
  const result = await query<{ id: string; session_key: string; name: string; engine: WhatsAppEngineId }>(
    `SELECT id, session_key, name, engine FROM whatsapp_accounts
     WHERE id=$1 AND workspace_id=$2 LIMIT 1`,
    [accountId, workspaceId],
  );
  const account = result.rows[0];
  if (!account) return null;
  if (principal.type === "api-key" && principal.whatsappAccountIds?.length && !principal.whatsappAccountIds.includes(account.id)) return null;
  const engine = normalizeWhatsAppEngine(account.engine);
  return { ...account, engine, engineDescriptor: getWhatsAppEngine(engine), workspaceId };
}

export async function conversationFor(principal: ApiPrincipal, conversationId: string) {
  const workspaceId = await workspaceFor(principal);
  if (!workspaceId) return null;
  const result = await query<{ id: string; workspace_id: string; whatsapp_account_id: string; chat_id: string; contact_id: string | null }>(
    `SELECT id, workspace_id, whatsapp_account_id, chat_id, contact_id
       FROM conversations WHERE id=$1 AND workspace_id=$2 LIMIT 1`,
    [conversationId, workspaceId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const account = await accountFor(principal, row.whatsapp_account_id);
  return account ? { ...row, account } : null;
}

export async function callWorker(account: { session_key: string; engine?: WhatsAppEngineId }, path: string, init: RequestInit = {}) {
  const engine = normalizeWhatsAppEngine(account.engine);
  const descriptor = getWhatsAppEngine(engine);
  const engineBase = getWhatsAppEngineUrl(engine);
  if (!engineBase || !descriptor.configured) {
    return { status: 503, data: { error: `${descriptor.label} engine is not configured.`, code: "ENGINE_NOT_CONFIGURED", engine } };
  }

  const isManager = engine === "whatsapp-web.js" && Boolean(process.env.WHATSAPP_MANAGER_URL);
  const base = isManager
    ? `${managerUrl}/accounts/${encodeURIComponent(account.session_key)}`
    : engine === "whatsapp-web.js"
      ? engineBase.replace(/\/$/, "")
      : `${engineBase.replace(/\/$/, "")}/accounts/${encodeURIComponent(account.session_key)}`;
  const target = `${base}${path}`;
  try {
    const response = await fetch(target, {
      ...init,
      cache: "no-store",
      headers: { ...(init.headers || {}), ...workerHeaders() },
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch {
    return { status: 503, data: { error: `${descriptor.label} engine is unavailable.`, code: "ENGINE_UNAVAILABLE", engine } };
  }
}

export async function assertAccountAllowed(principal: ApiPrincipal, accountId: string) {
  const account = await accountFor(principal, accountId);
  return account;
}
