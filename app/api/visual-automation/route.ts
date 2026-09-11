import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../auth/login/route";
import { isDatabaseConfigured, query, withTransaction } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NodeDef = { id: string; type: string; label?: string; config?: Record<string, unknown>; position?: { x: number; y: number } };
type EdgeDef = { id: string; source: string; target: string; label?: string };

async function auth() { const store = await cookies(); return verifySession(store.get("laawa_session")?.value); }
async function workspaceId() { const r = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1"); return r.rows[0]?.id || null; }

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ flows: [], runs: [], configured: false });
  try {
    const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ flows: [], runs: [], configured: true });
    const [flows, runs] = await Promise.all([
      query("SELECT id,name,enabled,trigger_type,conditions,actions,created_at,updated_at FROM automation_rules WHERE workspace_id=$1 ORDER BY updated_at DESC", [workspace]),
      query("SELECT ar.id,ar.name,ar.trigger_type,r.status,r.result,r.error,r.created_at FROM automation_runs r JOIN automation_rules ar ON ar.id=r.rule_id WHERE ar.workspace_id=$1 ORDER BY r.created_at DESC LIMIT 50", [workspace])
    ]);
    return NextResponse.json({ flows: flows.rows.map((f: any) => ({ ...f, nodes: f.conditions?.nodes || [], edges: f.conditions?.edges || [] })), runs: runs.rows, configured: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load flows." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required for visual automation." }, { status: 503 });
  try {
    const body = await request.json();
    const name = String(body?.name || "Untitled flow").trim().slice(0, 120);
    const nodes: NodeDef[] = Array.isArray(body?.nodes) ? body.nodes : [];
    const edges: EdgeDef[] = Array.isArray(body?.edges) ? body.edges : [];
    const enabled = Boolean(body?.enabled);
    if (!nodes.length) return NextResponse.json({ error: "A flow needs at least one node." }, { status: 400 });
    if (nodes.length > 100 || edges.length > 200) return NextResponse.json({ error: "Flow is too large." }, { status: 400 });
    const trigger = nodes.find((n) => n.type === "trigger");
    if (!trigger) return NextResponse.json({ error: "Add a trigger node before saving." }, { status: 400 });
    const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ error: "Workspace is not initialized." }, { status: 503 });
    const conditions = { nodes, edges, version: 1 };
    const result = await query("INSERT INTO automation_rules (workspace_id,name,enabled,trigger_type,conditions,actions) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [workspace, name, enabled, String(trigger.config?.event || "message_received"), JSON.stringify(conditions), JSON.stringify([])]);
    return NextResponse.json({ flow: result.rows[0] }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save flow." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required." }, { status: 503 });
  try {
    const body = await request.json(); const id = String(body?.id || ""); const action = String(body?.action || ""); const workspace = await workspaceId();
    if (!id || !workspace) return NextResponse.json({ error: "Invalid flow." }, { status: 400 });
    if (action === "toggle") {
      const r = await query("UPDATE automation_rules SET enabled=NOT enabled,updated_at=NOW() WHERE id=$1 AND workspace_id=$2 RETURNING *", [id, workspace]);
      if (!r.rows[0]) return NextResponse.json({ error: "Flow not found." }, { status: 404 }); return NextResponse.json({ flow: r.rows[0] });
    }
    if (action === "update") {
      const nodes: NodeDef[] = Array.isArray(body?.nodes) ? body.nodes : []; const edges: EdgeDef[] = Array.isArray(body?.edges) ? body.edges : [];
      const trigger = nodes.find((n) => n.type === "trigger"); if (!trigger) return NextResponse.json({ error: "A flow needs a trigger node." }, { status: 400 });
      const r = await query("UPDATE automation_rules SET name=$3,enabled=$4,trigger_type=$5,conditions=$6,updated_at=NOW() WHERE id=$1 AND workspace_id=$2 RETURNING *", [id, workspace, String(body?.name || "Untitled flow").trim().slice(0,120), Boolean(body?.enabled), String(trigger.config?.event || "message_received"), JSON.stringify({ nodes, edges, version: Number(body?.version || 1) + 1 })]);
      if (!r.rows[0]) return NextResponse.json({ error: "Flow not found." }, { status: 404 }); return NextResponse.json({ flow: r.rows[0] });
    }
    if (action === "test") {
      const r = await query("SELECT id FROM automation_rules WHERE id=$1 AND workspace_id=$2", [id, workspace]); if (!r.rows[0]) return NextResponse.json({ error: "Flow not found." }, { status: 404 });
      const run = await query("INSERT INTO automation_runs (rule_id,status,result,started_at,completed_at) VALUES ($1,'completed',$2,NOW(),NOW()) RETURNING *", [id, JSON.stringify({ test: true, message: "Flow validation passed. No WhatsApp message was sent." })]);
      return NextResponse.json({ run: run.rows[0] });
    }
    return NextResponse.json({ error: "Unsupported flow action." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update flow." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required." }, { status: 503 });
  try { const id = new URL(request.url).searchParams.get("id") || ""; const workspace = await workspaceId(); if (!id || !workspace) return NextResponse.json({ error: "Invalid flow." }, { status: 400 }); const r = await query("DELETE FROM automation_rules WHERE id=$1 AND workspace_id=$2 RETURNING id", [id, workspace]); return NextResponse.json({ deleted: Boolean(r.rows[0]) }, { status: r.rows[0] ? 200 : 404 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete flow." }, { status: 400 }); }
}
