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
  if (!workspaceId) return apiSuccess({ contacts: [] }, { requestId: auth.requestId });
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || url.searchParams.get("search") || "").trim().slice(0, 100);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50) || 50));
  const params: unknown[] = [workspaceId];
  let where = "c.workspace_id=$1";
  if (auth.principal.type === "api-key" && auth.principal.whatsappAccountIds?.length) { params.push(auth.principal.whatsappAccountIds); where += ` AND c.whatsapp_account_id=ANY($${params.length}::uuid[])`; }
  if (q) { params.push(`%${q}%`); where += ` AND (COALESCE(c.name,'') ILIKE $${params.length} OR COALESCE(c.push_name,'') ILIKE $${params.length} OR COALESCE(c.phone,'') ILIKE $${params.length} OR COALESCE(c.email,'') ILIKE $${params.length})`; }
  params.push(limit);
  const result = await query(`SELECT c.id,c.name,c.push_name,c.phone,c.email,c.avatar_url,c.notes,c.metadata,c.whatsapp_account_id AS account_id,c.created_at,c.updated_at FROM contacts c WHERE ${where} ORDER BY c.updated_at DESC LIMIT $${params.length}`, params);
  return apiSuccess({ contacts: result.rows }, { requestId: auth.requestId });
}
