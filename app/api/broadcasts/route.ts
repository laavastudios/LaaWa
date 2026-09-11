import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../auth/login/route";
import { isDatabaseConfigured, query, withTransaction } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function auth() { const store = await cookies(); return verifySession(store.get("laawa_session")?.value); }
async function workspaceId() { const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1"); return result.rows[0]?.id || null; }

function render(template: string, contact: { name: string | null; phone: string | null; email: string | null }) {
  return template.replace(/{{\s*name\s*}}/gi, contact.name || "there").replace(/{{\s*phone\s*}}/gi, contact.phone || "").replace(/{{\s*email\s*}}/gi, contact.email || "");
}

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ broadcasts: [], accounts: [], tags: [], configured: false });
  try {
    const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ broadcasts: [], accounts: [], tags: [], configured: true });
    const [broadcasts, accounts, tags] = await Promise.all([
      query("SELECT b.*, wa.name AS account_name, t.name AS template_name FROM broadcasts b LEFT JOIN whatsapp_accounts wa ON wa.id=b.whatsapp_account_id LEFT JOIN templates t ON t.id=b.template_id WHERE b.workspace_id=$1 ORDER BY b.created_at DESC LIMIT 100", [workspace]),
      query("SELECT id,name,session_key FROM whatsapp_accounts WHERE workspace_id=$1 ORDER BY name", [workspace]),
      query("SELECT id,name FROM tags WHERE workspace_id=$1 ORDER BY name", [workspace]),
    ]);
    return NextResponse.json({ broadcasts: broadcasts.rows, accounts: accounts.rows, tags: tags.rows, configured: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load campaigns." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required for campaigns." }, { status: 503 });
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim(); const message = String(body?.body || "").trim(); const accountId = String(body?.whatsappAccountId || "").trim();
    const tagIds = Array.isArray(body?.tagIds) ? body.tagIds.map(String).filter(Boolean) : [];
    const scheduledFor = body?.scheduledFor ? new Date(body.scheduledFor) : null;
    const ratePerMinute = Math.min(60, Math.max(1, Number(body?.ratePerMinute || 20)));
    if (!name || !message || !accountId) return NextResponse.json({ error: "Name, message and WhatsApp account are required." }, { status: 400 });
    if (scheduledFor && (!Number.isFinite(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now())) return NextResponse.json({ error: "Scheduled time must be in the future." }, { status: 400 });
    const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ error: "Workspace is not initialized." }, { status: 503 });
    const result = await withTransaction(async (client) => {
      const account = await client.query("SELECT id FROM whatsapp_accounts WHERE id=$1 AND workspace_id=$2", [accountId, workspace]);
      if (!account.rows[0]) throw new Error("WhatsApp account not found.");
      const validTags = tagIds.length ? await client.query("SELECT id FROM tags WHERE workspace_id=$1 AND id=ANY($2::uuid[])", [workspace, tagIds]) : { rows: [] };
      if (validTags.rows.length !== tagIds.length) throw new Error("One or more audience tags are invalid.");
      const contacts = await client.query(`SELECT c.id,c.name,c.phone,c.email FROM contacts c WHERE c.workspace_id=$1 AND c.whatsapp_account_id=$2 AND COALESCE((c.metadata->>'opted_out'),'false') <> 'true' ${tagIds.length ? "AND c.id IN (SELECT ct.contact_id FROM contact_tags ct WHERE ct.tag_id = ANY($3::uuid[]) GROUP BY ct.contact_id HAVING COUNT(DISTINCT ct.tag_id)=$4)" : ""} ORDER BY c.created_at`, tagIds.length ? [workspace, accountId, tagIds, tagIds.length] : [workspace, accountId]);
      if (!contacts.rows.length) throw new Error("No eligible recipients matched this audience.");
      const start = scheduledFor || new Date();
      const spacing = Math.max(1000, Math.ceil(60000 / ratePerMinute));
      const broadcast = await client.query("INSERT INTO broadcasts (workspace_id,whatsapp_account_id,name,body,status,scheduled_for,total_count,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [workspace, accountId, name, message, scheduledFor ? "queued" : "running", start, contacts.rows.length, JSON.stringify({ ratePerMinute, tagIds, audienceCount: contacts.rows.length })]);
      const broadcastId = broadcast.rows[0].id;
      for (let i=0;i<contacts.rows.length;i++) {
        const contact = contacts.rows[i]; const rendered = render(message, contact); const runAt = new Date(start.getTime() + i * spacing);
        const recipient = await client.query("INSERT INTO broadcast_recipients (broadcast_id,contact_id,chat_id,rendered_body,status) SELECT $1,$2,COALESCE(c.wa_id,c.phone),$3,'queued' FROM contacts c WHERE c.id=$2 RETURNING id,chat_id", [broadcastId, contact.id, rendered]);
        if (!recipient.rows[0]?.chat_id) continue;
        const key = `broadcast:${broadcastId}:${recipient.rows[0].id}`;
        await client.query("INSERT INTO jobs (workspace_id,whatsapp_account_id,type,status,payload,idempotency_key,run_at,max_attempts) VALUES ($1,$2,'broadcast_send','queued',$3,$4,$5,5) ON CONFLICT (workspace_id,idempotency_key) DO NOTHING", [workspace, accountId, JSON.stringify({ broadcastId, recipientId: recipient.rows[0].id, accountId, chatId: recipient.rows[0].chat_id, body: rendered }), key, runAt]);
      }
      return { id: broadcastId, count: contacts.rows.length };
    });
    return NextResponse.json({ broadcast: result }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create campaign." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required." }, { status: 503 });
  try {
    const body = await request.json(); const id = String(body?.id || ""); const action = String(body?.action || ""); const workspace = await workspaceId();
    if (!id || !workspace || !["pause","resume","cancel"].includes(action)) return NextResponse.json({ error: "Invalid campaign action." }, { status: 400 });
    return NextResponse.json(await withTransaction(async (client) => {
      const current = await client.query("SELECT id,status FROM broadcasts WHERE id=$1 AND workspace_id=$2 FOR UPDATE", [id, workspace]);
      if (!current.rows[0]) throw new Error("Campaign not found.");
      if (action === "pause") { await client.query("UPDATE broadcasts SET status='paused',updated_at=NOW() WHERE id=$1", [id]); await client.query("UPDATE jobs SET status='cancelled',updated_at=NOW() WHERE id IN (SELECT id FROM jobs WHERE payload->>'broadcastId'=$1) AND status IN ('queued','scheduled')", [id]); }
      if (action === "cancel") { await client.query("UPDATE broadcasts SET status='cancelled',updated_at=NOW() WHERE id=$1", [id]); await client.query("UPDATE jobs SET status='cancelled',updated_at=NOW() WHERE payload->>'broadcastId'=$1 AND status IN ('queued','scheduled')", [id]); await client.query("UPDATE broadcast_recipients SET status='skipped',updated_at=NOW() WHERE broadcast_id=$1 AND status IN ('pending','queued')", [id]); }
      if (action === "resume") { await client.query("UPDATE broadcasts SET status='running',updated_at=NOW() WHERE id=$1", [id]); await client.query("UPDATE broadcast_recipients SET status='queued',updated_at=NOW() WHERE broadcast_id=$1 AND status='pending'", [id]); }
      return { updated: true, id, action };
    }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update campaign." }, { status: 400 }); }
}
