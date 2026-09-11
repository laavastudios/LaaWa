import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";
import { isDatabaseConfigured, query } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function workspace() {
  const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  return result.rows[0]?.id;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ configured: false }, { status: 503 });

  const wid = await workspace();
  const { id } = await params;
  if (!wid) return NextResponse.json({ error: "Workspace is not configured." }, { status: 409 });

  const contact = await query(
    `SELECT c.id,c.name,c.push_name,c.phone,c.email,c.notes,c.metadata,c.created_at,c.updated_at,
      wa.name account_name,COALESCE(c.metadata->>'stage','new') stage,
      CASE WHEN c.metadata->>'value'~'^[0-9]+(\\.[0-9]+)?$' THEN (c.metadata->>'value')::numeric ELSE 0 END::float8 value
     FROM contacts c LEFT JOIN whatsapp_accounts wa ON wa.id=c.whatsapp_account_id
     WHERE c.id=$1 AND c.workspace_id=$2 LIMIT 1`,
    [id, wid],
  );
  if (!contact.rows[0]) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.trim() || "";

  const tags = await query(
    `SELECT t.id,t.name FROM tags t
     JOIN contact_tags ct ON ct.tag_id=t.id
     WHERE ct.contact_id=$1 AND t.workspace_id=$2 ORDER BY t.name`,
    [id, wid],
  );

  const conversations = await query<{ id: string } & Record<string, unknown>>(
    `SELECT v.id,v.chat_id,v.title,v.status,v.unread_count,v.last_message_at,v.last_message_preview,v.created_at,
      COUNT(m.id)::int message_count
     FROM conversations v
     LEFT JOIN messages m ON m.conversation_id=v.id
     WHERE v.contact_id=$1 AND v.workspace_id=$2
     GROUP BY v.id
     ORDER BY v.last_message_at DESC NULLS LAST
     LIMIT 20`,
    [id, wid],
  );

  if (conversationId && !conversations.rows.some((item) => item.id === conversationId)) {
    return NextResponse.json({ error: "Conversation not found for this contact." }, { status: 404 });
  }

  const messageParams: unknown[] = [id, wid];
  let conversationClause = "";
  if (conversationId) {
    messageParams.push(conversationId);
    conversationClause = "AND v.id=$3";
  }

  const messages = await query(
    `SELECT * FROM (
       SELECT m.id,m.conversation_id,m.direction,m.message_type,m.body,m.status,m.created_at,m.external_timestamp
       FROM messages m
       JOIN conversations v ON v.id=m.conversation_id
       WHERE v.contact_id=$1 AND v.workspace_id=$2 ${conversationClause}
       ORDER BY m.created_at DESC
       LIMIT 100
     ) recent
     ORDER BY recent.created_at ASC`,
    messageParams,
  );

  return NextResponse.json({
    configured: true,
    contact: contact.rows[0],
    tags: tags.rows,
    conversations: conversations.rows,
    messages: messages.rows,
    selectedConversationId: conversationId || null,
  });
}
