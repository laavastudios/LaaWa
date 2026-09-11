import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../auth/login/route";
import { isDatabaseConfigured, query } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function auth() { const store = await cookies(); return verifySession(store.get("laawa_session")?.value); }
async function workspaceId() { const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1"); return result.rows[0]?.id || null; }

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ leads: [], configured: false });
  try {
    const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ leads: [], configured: true });
    const result = await query(`
      SELECT c.id, c.wa_id, c.phone, COALESCE(c.name, c.push_name, c.phone, 'Unknown') AS name,
             c.notes, COALESCE(c.metadata->>'stage', 'new') AS stage,
             COALESCE(c.metadata->>'value', '0')::numeric AS value,
             c.updated_at,
             COALESCE(cv.last_message_preview, '') AS last_message
      FROM contacts c
      LEFT JOIN LATERAL (
        SELECT last_message_preview FROM conversations
        WHERE contact_id = c.id ORDER BY updated_at DESC LIMIT 1
      ) cv ON TRUE
      WHERE c.workspace_id = $1
      ORDER BY c.updated_at DESC
      LIMIT 250`, [workspace]);
    const leads = result.rows.map((lead) => ({ ...lead, value: Number(lead.value || 0) }));
    const stages = ["new", "qualified", "proposal", "won", "lost"];
    const summary = stages.reduce<Record<string, number>>((acc, stage) => { acc[stage] = leads.filter((lead) => lead.stage === stage).length; return acc; }, {});
    const pipelineValue = leads.filter((lead) => !["lost", "won"].includes(lead.stage)).reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const wonValue = leads.filter((lead) => lead.stage === "won").reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    return NextResponse.json({ leads, summary, pipelineValue, wonValue, configured: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load business workspace." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required for Business." }, { status: 503 });
  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const stage = String(body?.stage || "").trim();
    const value = Number(body?.value ?? 0);
    if (!id || !["new", "qualified", "proposal", "won", "lost"].includes(stage) || !Number.isFinite(value) || value < 0) return NextResponse.json({ error: "Invalid lead update." }, { status: 400 });
    const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ error: "Workspace is not initialized." }, { status: 503 });
    const result = await query(`UPDATE contacts SET metadata = jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{stage}', to_jsonb($3::text)), '{value}', to_jsonb($4::numeric)), updated_at = NOW() WHERE id = $1 AND workspace_id = $2 RETURNING id, metadata`, [id, workspace, stage, value]);
    if (!result.rows[0]) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    return NextResponse.json({ updated: true, id, stage, value });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update lead." }, { status: 500 }); }
}
