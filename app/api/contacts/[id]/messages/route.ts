import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../../auth/login/route";
import { isDatabaseConfigured, query } from "../../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth() {
  const store = await cookies();
  return verifySession(store.get("laawa_session")?.value);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const { id } = await params;
  const workspace = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  const wid = workspace.rows[0]?.id;
  if (!wid) return NextResponse.json({ error: "Workspace is not configured." }, { status: 409 });
  const body = await request.json().catch(() => null) as { conversationId?: string; message?: string } | null;
  const conversationId = String(body?.conversationId || "").trim();
  const message = String(body?.message || "").trim().slice(0, 4000);
  if (!conversationId || !message) return NextResponse.json({ error: "Conversation and message are required." }, { status: 400 });
  const result = await query<{ chat_id: string }>(
    `SELECT v.chat_id FROM conversations v JOIN contacts c ON c.id=v.contact_id WHERE v.id=$1 AND v.contact_id=$2 AND v.workspace_id=$3 LIMIT 1`,
    [conversationId, id, wid],
  );
  if (!result.rows[0]) return NextResponse.json({ error: "Conversation not found for this customer." }, { status: 404 });
  return NextResponse.json({ chatId: result.rows[0].chat_id, message });
}
