import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../auth/login/route";
import { isDatabaseConfigured, query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth() {
  const c = await cookies();
  return verifySession(c.get("laawa_session")?.value);
}

export async function GET(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ configured: false, days: 30 });
  const url = new URL(req.url);
  const requestedDays = Number(url.searchParams.get("days") || 30);
  const days = Number.isFinite(requestedDays) ? Math.min(90, Math.max(7, Math.trunc(requestedDays))) : 30;
  try {
    const workspace = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
    const wid = workspace.rows[0]?.id;
    if (!wid) return NextResponse.json({ configured: true, days, empty: true });
    const since = `NOW() - ($2::int * INTERVAL '1 day')`;
    const [messages, daily, accounts, contacts, conversations, broadcasts, automation, jobs, events] = await Promise.all([
      query<any>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE direction='inbound')::int inbound, COUNT(*) FILTER (WHERE direction='outbound')::int outbound, COUNT(*) FILTER (WHERE status='failed')::int failed, COUNT(*) FILTER (WHERE status IN ('sent','delivered','read'))::int delivered FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1 AND m.created_at >= ${since}`, [wid, days]),
      query<any>(`SELECT to_char(date_trunc('day',m.created_at),'YYYY-MM-DD') day, COUNT(*)::int total, COUNT(*) FILTER (WHERE m.direction='inbound')::int inbound, COUNT(*) FILTER (WHERE m.direction='outbound')::int outbound FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.workspace_id=$1 AND m.created_at >= ${since} GROUP BY 1 ORDER BY 1`, [wid, days]),
      query<any>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='connected')::int connected, COUNT(*) FILTER (WHERE status IN ('connecting','qr','reconnecting'))::int attention FROM whatsapp_accounts WHERE workspace_id=$1`, [wid]),
      query<any>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE created_at >= ${since})::int created, COUNT(*) FILTER (WHERE metadata->>'stage'='won' AND updated_at >= ${since})::int won, COALESCE(SUM(CASE WHEN metadata->>'stage'='won' AND metadata->>'value' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (metadata->>'value')::numeric ELSE 0 END),0)::numeric pipeline_won FROM contacts WHERE workspace_id=$1`, [wid, days]),
      query<any>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='open')::int open, COUNT(*) FILTER (WHERE last_message_at >= ${since})::int active FROM conversations WHERE workspace_id=$1`, [wid, days]),
      query<any>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='running')::int running, COUNT(*) FILTER (WHERE status='completed')::int completed, COUNT(*) FILTER (WHERE status='failed')::int failed, COALESCE(SUM(total_count),0)::int recipients, COALESCE(SUM(sent_count),0)::int sent FROM broadcasts WHERE workspace_id=$1 AND created_at >= ${since}`, [wid, days]),
      query<any>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE ar.status='completed')::int completed, COUNT(*) FILTER (WHERE ar.status='failed')::int failed, COUNT(*) FILTER (WHERE ar.status='queued')::int queued FROM automation_runs ar JOIN automation_rules r ON r.id=ar.rule_id WHERE r.workspace_id=$1 AND ar.created_at >= ${since}`, [wid, days]),
      query<any>(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status IN ('queued','running'))::int active, COUNT(*) FILTER (WHERE status='completed')::int completed, COUNT(*) FILTER (WHERE status='failed')::int failed FROM jobs WHERE workspace_id=$1 AND created_at >= ${since}`, [wid, days]),
      query<any>(`SELECT id, action, resource_type, resource_id, created_at FROM audit_logs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 12`, [wid])
    ]);
    return NextResponse.json({ configured: true, days, metrics: { messages: messages.rows[0], accounts: accounts.rows[0], contacts: contacts.rows[0], conversations: conversations.rows[0], broadcasts: broadcasts.rows[0], automation: automation.rows[0], jobs: jobs.rows[0] }, daily: daily.rows, events: events.rows });
  } catch (error) {
    console.error("Analytics query failed", error);
    return NextResponse.json({ configured: true, days, error: "Analytics data is temporarily unavailable. Check the database connection and migrations." }, { status: 503 });
  }
}
