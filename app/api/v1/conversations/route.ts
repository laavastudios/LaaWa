import { NextRequest } from "next/server";
import { apiError, apiSuccess, API_SCOPES, requireApiAuth } from "../../../../lib/api";
import { workspaceFor } from "../../../../lib/api-messaging";
import { isDatabaseConfigured, query } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, API_SCOPES.read);
  if ("response" in auth) return auth.response;
  if (!isDatabaseConfigured()) return apiError({ status: 503, code: "DATABASE_UNAVAILABLE", message: "Database is not configured.", requestId: auth.requestId });
  const workspaceId = await workspaceFor(auth.principal);
  if (!workspaceId) return apiSuccess({ conversations: [] }, { requestId: auth.requestId });
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50) || 50));
  const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const params: unknown[] = [workspaceId];
  let where = "v.workspace_id=$1";
  if (auth.principal.type === "api-key" && auth.principal.whatsappAccountIds?.length) {
    params.push(auth.principal.whatsappAccountIds); where += ` AND v.whatsapp_account_id=ANY($${params.length}::uuid[])`;
  }
  if (search) { params.push(`%${search}%`); where += ` AND (COALESCE(v.title,'') ILIKE $${params.length} OR COALESCE(c.name,'') ILIKE $${params.length} OR COALESCE(c.phone,'') ILIKE $${params.length} OR v.chat_id ILIKE $${params.length})`; }
  params.push(limit);
  const result = await query(`SELECT v.id,v.chat_id,v.chat_type,v.title,v.unread_count,v.last_message_at,v.last_message_preview,v.whatsapp_account_id AS account_id,wa.name AS account_name,c.id AS contact_id,c.name AS contact_name,c.phone,c.avatar_url FROM conversations v LEFT JOIN contacts c ON c.id=v.contact_id LEFT JOIN whatsapp_accounts wa ON wa.id=v.whatsapp_account_id WHERE ${where} ORDER BY v.last_message_at DESC NULLS LAST,v.updated_at DESC LIMIT $${params.length}`, params);
  return apiSuccess({ conversations: result.rows }, { requestId: auth.requestId });
}
