import { NextRequest } from "next/server";
import { apiError, apiSuccess, API_SCOPES, requireApiAuth } from "../../../../../../lib/api";
import { conversationFor } from "../../../../../../lib/api-messaging";
import { isDatabaseConfigured, query } from "../../../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request, API_SCOPES.read);
  if ("response" in auth) return auth.response;
  if (!isDatabaseConfigured()) return apiError({ status: 503, code: "DATABASE_UNAVAILABLE", message: "Database is not configured.", requestId: auth.requestId });
  const { id } = await params;
  const conversation = await conversationFor(auth.principal, id);
  if (!conversation) return apiError({ status: 404, code: "CONVERSATION_NOT_FOUND", message: "Conversation not found or not permitted for this API key.", requestId: auth.requestId });
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100) || 100));
  const before = url.searchParams.get("before");
  const paramsList: unknown[] = [id, limit];
  const where = before ? "m.conversation_id=$1 AND m.created_at < $3" : "m.conversation_id=$1";
  if (before) paramsList.push(before);
  const result = await query(`SELECT m.id,m.whatsapp_message_id,m.direction,m.sender_wa_id,m.recipient_wa_id,m.message_type,m.body,m.status,m.external_timestamp,m.metadata,m.created_at,m.updated_at FROM messages m WHERE ${where} ORDER BY m.created_at DESC LIMIT $2`, paramsList);
  return apiSuccess({ conversationId: id, messages: result.rows.reverse() }, { requestId: auth.requestId });
}
