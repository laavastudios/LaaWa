import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth, hasScope, API_SCOPES } from "../../../../lib/api";
import { assertAccountAllowed, callWorker, conversationFor } from "../../../../lib/api-messaging";
import { isDatabaseConfigured, query } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonBody = async (request: Request) => await request.json().catch(() => null) as Record<string, unknown> | null;
const clean = (v: unknown, max = 4096) => typeof v === "string" ? v.trim().slice(0, max) : "";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, API_SCOPES.read);
  if ("response" in auth) return auth.response;
  if (!isDatabaseConfigured()) return apiError({ status: 503, code: "DATABASE_UNAVAILABLE", message: "Database is not configured.", requestId: auth.requestId });
  const url = new URL(request.url);
  const accountId = clean(url.searchParams.get("accountId"), 80);
  const chatId = clean(url.searchParams.get("chatId"), 160);
  if (!accountId || !chatId) return apiError({ status: 400, code: "INVALID_REQUEST", message: "accountId and chatId are required.", requestId: auth.requestId });
  const account = await assertAccountAllowed(auth.principal, accountId);
  if (!account) return apiError({ status: 404, code: "ACCOUNT_NOT_FOUND", message: "WhatsApp account not found or not permitted for this API key.", requestId: auth.requestId });
  const response = await callWorker(account, `/messages?chatId=${encodeURIComponent(chatId)}`);
  return response.status >= 400 ? apiError({ status: response.status, code: "WORKER_ERROR", message: String(response.data?.error || "Unable to read messages."), details: response.data, requestId: auth.requestId }) : apiSuccess(response.data, { requestId: auth.requestId });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, API_SCOPES.write);
  if ("response" in auth) return auth.response;
  if (!isDatabaseConfigured()) return apiError({ status: 503, code: "DATABASE_UNAVAILABLE", message: "Database is not configured.", requestId: auth.requestId });
  const body = await jsonBody(request);
  const action = clean(body?.action || "send", 30).toLowerCase();
  const conversationId = clean(body?.conversationId, 80);
  let accountId = clean(body?.accountId, 80);
  let chatId = clean(body?.chatId, 160);

  if (conversationId) {
    const conversation = await conversationFor(auth.principal, conversationId);
    if (!conversation) return apiError({ status: 404, code: "CONVERSATION_NOT_FOUND", message: "Conversation not found or not permitted for this API key.", requestId: auth.requestId });
    accountId = conversation.account.id;
    chatId = chatId || conversation.chat_id;
  }
  if (!accountId || !chatId) return apiError({ status: 400, code: "INVALID_REQUEST", message: "accountId and chatId (or conversationId) are required.", requestId: auth.requestId });
  const account = await assertAccountAllowed(auth.principal, accountId);
  if (!account) return apiError({ status: 404, code: "ACCOUNT_NOT_FOUND", message: "WhatsApp account not found or not permitted for this API key.", requestId: auth.requestId });

  if (action === "send") {
    const text = clean(body?.text ?? body?.body, 4096);
    const media = body?.media && typeof body.media === "object" ? body.media as Record<string, unknown> : undefined;
    if (!text && !media?.data) return apiError({ status: 400, code: "MESSAGE_REQUIRED", message: "text or media is required.", requestId: auth.requestId });
    const response = await callWorker(account, "/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId, body: text, media }) });
    return response.status >= 400 ? apiError({ status: response.status, code: "SEND_FAILED", message: String(response.data?.error || "Unable to send message."), details: response.data, requestId: auth.requestId }) : apiSuccess({ accountId, chatId, ...response.data }, { status: 201, requestId: auth.requestId });
  }

  if (action === "location" || action === "contact" || action === "reply" || action === "react" || action === "read") {
    const messageId = clean(body?.messageId, 300);
    if (["reply", "react", "read"].includes(action) && !messageId) return apiError({ status: 400, code: "MESSAGE_ID_REQUIRED", message: "messageId is required for this action.", requestId: auth.requestId });
    const response = await callWorker(account, `/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId, messageId, body: clean(body?.text ?? body?.body, 4096), reaction: clean(body?.reaction, 8), latitude: body?.latitude, longitude: body?.longitude, description: clean(body?.description, 500), phone: clean(body?.phone, 40), name: clean(body?.name, 160), vcard: clean(body?.vcard, 10000) }) });
    return response.status >= 400 ? apiError({ status: response.status, code: `${action.toUpperCase()}_FAILED`, message: String(response.data?.error || `Unable to ${action} message.`), details: response.data, requestId: auth.requestId }) : apiSuccess({ accountId, chatId, ...response.data }, { status: 201, requestId: auth.requestId });
  }

  return apiError({ status: 400, code: "UNSUPPORTED_ACTION", message: "Supported actions: send, location, contact, reply, react, read.", requestId: auth.requestId });
}
