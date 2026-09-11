import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../auth/login/route";
import { query, isDatabaseConfigured } from "../../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function auth() { const store = await cookies(); return verifySession(store.get("laawa_session")?.value); }
async function workspaceId() { const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1"); return result.rows[0]?.id || null; }

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ rules: [], runs: [], configured: false });
  try {
    const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ rules: [], runs: [] });
    const rules = await query(`SELECT id, name, enabled, trigger_type, conditions, actions, created_at, updated_at FROM automation_rules WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspace]);
    const runs = await query(`SELECT ar.id, ar.rule_id, ar.status, ar.result, ar.error, ar.created_at, r.name FROM automation_runs ar JOIN automation_rules r ON r.id = ar.rule_id WHERE r.workspace_id = $1 ORDER BY ar.created_at DESC LIMIT 50`, [workspace]);
    return NextResponse.json({ rules: rules.rows, runs: runs.rows, configured: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load automations." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required for automations." }, { status: 503 });
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim(); const keyword = String(body?.keyword || "").trim(); const reply = String(body?.reply || "").trim(); const match = String(body?.match || "contains").trim();
    if (!name || !keyword || !reply) return NextResponse.json({ error: "Name, keyword and reply are required." }, { status: 400 });
    if (!["exact", "contains", "starts_with"].includes(match)) return NextResponse.json({ error: "Invalid match type." }, { status: 400 });
    const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ error: "Workspace is not initialized." }, { status: 503 });
    const result = await query(`INSERT INTO automation_rules (workspace_id, name, trigger_type, conditions, actions) VALUES ($1, $2, 'message', $3::jsonb, $4::jsonb) RETURNING id, name, enabled, trigger_type, conditions, actions, created_at, updated_at`, [workspace, name, JSON.stringify([{ type: match, value: keyword }]), JSON.stringify([{ type: "reply", body: reply }])]);
    return NextResponse.json({ rule: result.rows[0] }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create automation." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required for automations." }, { status: 503 });
  try {
    const body = await request.json(); const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Rule id is required." }, { status: 400 });
    const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ error: "Workspace is not initialized." }, { status: 503 });
    const result = await query(`UPDATE automation_rules SET enabled = COALESCE($3, enabled), updated_at = NOW() WHERE id = $1 AND workspace_id = $2 RETURNING id, name, enabled, trigger_type, conditions, actions, created_at, updated_at`, [id, workspace, typeof body?.enabled === "boolean" ? body.enabled : null]);
    if (!result.rows[0]) return NextResponse.json({ error: "Automation not found." }, { status: 404 });
    return NextResponse.json({ rule: result.rows[0] });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update automation." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required for automations." }, { status: 503 });
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim(); if (!id) return NextResponse.json({ error: "Rule id is required." }, { status: 400 });
    const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ error: "Workspace is not initialized." }, { status: 503 });
    const result = await query("DELETE FROM automation_rules WHERE id = $1 AND workspace_id = $2", [id, workspace]);
    return NextResponse.json({ deleted: result.rowCount === 1 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete automation." }, { status: 500 }); }
}
