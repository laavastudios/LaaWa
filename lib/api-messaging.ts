import { engineDescriptor, normalizeEngine } from "./engines";
import { query } from "./db";
import type { ApiPrincipal } from "./api";

type Account = { id: string; session_key: string; engine?: string | null; workspace_id?: string | null };

export async function accountFor(principal: ApiPrincipal, accountId?: string | null): Promise<Account | null> {
  if (!principal.workspaceId) return null;
  const params: unknown[] = [principal.workspaceId];
  let clause = "workspace_id=$1";
  if (accountId) {
    params.push(accountId);
    clause += ` AND id=$${params.length}`;
  }
  if (principal.whatsappAccountIds?.length) {
    params.push(principal.whatsappAccountIds);
    clause += ` AND id = ANY($${params.length}::uuid[])`;
  }
  const result = await query<Account>(`SELECT id,session_key,engine,workspace_id FROM whatsapp_accounts WHERE ${clause} LIMIT 1`, params);
  return result.rows[0] ?? null;
}

export async function workspaceFor(principal: ApiPrincipal) {
  if (principal.workspaceId) return principal.workspaceId;
  const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  return result.rows[0]?.id ?? null;
}

export async function conversationFor(principal: ApiPrincipal, conversationId: string) {
  const wid = await workspaceFor(principal);
  if (!wid) return null;
  const result = await query<{ id: string; whatsapp_account_id: string; chat_id: string }>(
    `SELECT id,whatsapp_account_id,chat_id FROM conversations WHERE id=$1 AND workspace_id=$2 LIMIT 1`,
    [conversationId, wid],
  );
  const conversation = result.rows[0] ?? null;
  if (!conversation) return null;
  if (principal.whatsappAccountIds?.length && !principal.whatsappAccountIds.includes(conversation.whatsapp_account_id)) return null;
  return conversation;
}

function workerHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  if (process.env.WORKER_AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.WORKER_AUTH_TOKEN}`;
  return headers;
}

export async function callWorker(account: Account, path: string, init: RequestInit = {}) {
  const engine = normalizeEngine(account.engine);
  const descriptor = engineDescriptor(engine);
  const engineBase = descriptor.baseUrl;
  const managerUrl = process.env.WHATSAPP_MANAGER_URL?.replace(/\/$/, "") || "";
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
      headers: { ...(init.headers || {}), ...workerHeaders() } as HeadersInit,
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch {
    return { status: 503, data: { error: `${descriptor.label} engine is unavailable.`, code: "ENGINE_UNAVAILABLE", engine } };
  }
}
