import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";
import { isDatabaseConfigured, query } from "../../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function auth() { const store = await cookies(); return verifySession(store.get("laawa_session")?.value); }
async function workspaceId() { const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1"); return result.rows[0]?.id || null; }

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ history: [], configured: false });
  try {
    const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ history: [], configured: true });
    const result = await query(`SELECT id, value, updated_at FROM app_settings WHERE workspace_id = $1 AND key = 'ai_history'`, [workspace]);
    return NextResponse.json({ history: result.rows[0]?.value || [], configured: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load AI history." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ saved: false, configured: false });
  try {
    const body = await request.json();
    const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ error: "Workspace is not initialized." }, { status: 503 });
    const entry = { id: crypto.randomUUID(), mode: String(body?.mode || "reply"), prompt: String(body?.prompt || "").slice(0, 4000), output: String(body?.output || "").slice(0, 12000), createdAt: new Date().toISOString() };
    if (!entry.prompt || !entry.output) return NextResponse.json({ error: "Prompt and output are required." }, { status: 400 });
    await query(`INSERT INTO app_settings (workspace_id, key, value) VALUES ($1, 'ai_history', $2::jsonb) ON CONFLICT (workspace_id, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`, [workspace, JSON.stringify(entry)]);
    return NextResponse.json({ saved: true, entry });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save AI history." }, { status: 500 }); }
}
