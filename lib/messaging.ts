import { query, isDatabaseConfigured } from "./db";
import { emitWebhookEvent } from "./webhooks";

type WorkerMessage = {
  id?: string;
  chatId?: string;
  body?: string;
  timestamp?: number;
  fromMe?: boolean;
  name?: string;
  phone?: string;
  avatar?: string | null;
  read?: boolean;
  type?: string;
  hasMedia?: boolean;
};

function accountKey() { return process.env.WHATSAPP_ACCOUNT_SESSION_KEY || process.env.WHATSAPP_AUTH_PATH || "default"; }
function workspaceName() { return process.env.LAAWA_WORKSPACE_NAME || "LaaWa Workspace"; }
async function ensureContext() {
  const workspace = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  const workspaceId = workspace.rows[0]?.id || (await query<{ id: string }>("INSERT INTO workspaces (name) VALUES ($1) RETURNING id", [workspaceName()])).rows[0].id;
  const account = await query<{ id: string }>("SELECT id FROM whatsapp_accounts WHERE workspace_id = $1 AND session_key = $2 LIMIT 1", [workspaceId, accountKey()]);
  const accountId = account.rows[0]?.id || (await query<{ id: string }>("INSERT INTO whatsapp_accounts (workspace_id, name, session_key) VALUES ($1, $2, $3) RETURNING id", [workspaceId, "WhatsApp", accountKey()])).rows[0].id;
  return { workspaceId, accountId };
}
function messageType(type?: string) { const value = String(type || "text").toLowerCase(); if (["text","image","video","audio","document","sticker","location","contact"].includes(value)) return value; if (value === "chat") return "text"; return "unknown"; }

export async function persistWorkerMessages(input: WorkerMessage[]) {
  if (!isDatabaseConfigured() || !input.length) return;
  const { workspaceId, accountId } = await ensureContext();
  for (const message of input) {
    const chatId = String(message.chatId || "").trim(); if (!chatId) continue;
    const externalId = String(message.id || "").trim() || null;
    const timestamp = Number(message.timestamp || Math.floor(Date.now() / 1000));
    const name = String(message.name || message.phone || "Unknown").trim();
    const phone = String(message.phone || "").replace(/\D/g, "") || null;
    const body = String(message.body || "");
    const type = messageType(message.type);
    const direction = message.fromMe ? "outbound" : "inbound";
    const status = message.fromMe ? "sent" : (message.read ? "read" : "received");
    const chatType = chatId.endsWith("@g.us") ? "group" : chatId.includes("@broadcast") ? "broadcast" : "individual";
    let contactId: string | null = null;
    if (!chatId.endsWith("@g.us") && !chatId.includes("@broadcast")) {
      const contact = await query<{ id: string }>(`INSERT INTO contacts (workspace_id, whatsapp_account_id, wa_id, phone, name, avatar_url) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (whatsapp_account_id, wa_id) WHERE wa_id IS NOT NULL DO UPDATE SET phone = COALESCE(EXCLUDED.phone, contacts.phone), name = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name), avatar_url = COALESCE(EXCLUDED.avatar_url, contacts.avatar_url), updated_at = NOW() RETURNING id`, [workspaceId, accountId, chatId, phone, name, message.avatar || null]);
      contactId = contact.rows[0]?.id || null;
    }
    const conversation = await query<{ id: string }>(`INSERT INTO conversations (workspace_id, whatsapp_account_id, contact_id, chat_id, chat_type, title, unread_count, last_message_at, last_message_preview) VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), $9) ON CONFLICT (whatsapp_account_id, chat_id) DO UPDATE SET contact_id = COALESCE(EXCLUDED.contact_id, conversations.contact_id), title = COALESCE(NULLIF(EXCLUDED.title, ''), conversations.title), unread_count = EXCLUDED.unread_count, last_message_at = GREATEST(COALESCE(conversations.last_message_at, EXCLUDED.last_message_at), EXCLUDED.last_message_at), last_message_preview = EXCLUDED.last_message_preview, updated_at = NOW() RETURNING id`, [workspaceId, accountId, contactId, chatId, chatType, name, message.fromMe || message.read ? 0 : 1, timestamp, body || (message.hasMedia ? `[${type}]` : "[message]")]);
    const conversationId = conversation.rows[0]?.id; if (!conversationId) continue;
    const inserted = await query<{ id: string }>(`INSERT INTO messages (conversation_id, whatsapp_account_id, whatsapp_message_id, direction, sender_wa_id, recipient_wa_id, message_type, body, status, external_timestamp, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10), $11::jsonb) ON CONFLICT DO NOTHING RETURNING id`, [conversationId, accountId, externalId, direction, message.fromMe ? null : chatId, message.fromMe ? chatId : null, type, body || null, status, timestamp, JSON.stringify({ name, phone, avatar: message.avatar || null, hasMedia: Boolean(message.hasMedia) })]);
    if (inserted.rows[0]) void emitWebhookEvent(workspaceId, message.fromMe ? "message.sent" : "message.received", { message_id: inserted.rows[0].id, conversation_id: conversationId, account_id: accountId, chat_id: chatId, direction, type, body, timestamp });
  }
}
