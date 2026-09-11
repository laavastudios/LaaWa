import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../auth/login/route";
import { isDatabaseConfigured, query, withTransaction } from "../../../lib/db";
import { encryptWebhookSecret, emitWebhookEvent } from "../../../lib/webhooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function auth() { const store = await cookies(); return verifySession(store.get("laawa_session")?.value); }
async function workspaceId() { const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1"); return result.rows[0]?.id || null; }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ configured: false, accounts: [], keys: [], webhooks: [], deliveries: [], audit: [], jobs: [] });
  try {
    const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ configured: true, accounts: [], keys: [], webhooks: [], deliveries: [], audit: [], jobs: [] });
    const [accounts, keys, webhooks, deliveries, audit, jobs] = await Promise.all([
      query(`SELECT id, name, engine, phone_number, status, last_connected_at, created_at, updated_at FROM whatsapp_accounts WHERE workspace_id = $1 ORDER BY created_at ASC`, [workspace]),
      query(`SELECT id, name, key_prefix, scopes, expires_at, last_used_at, revoked_at, created_at FROM api_keys WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspace]),
      query(`SELECT id, name, url, events, enabled, created_at, updated_at FROM webhooks WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspace]),
      query(`SELECT d.id, d.webhook_id, w.name AS webhook_name, d.event_type, d.status, d.attempts, d.response_status, d.created_at, d.delivered_at FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id WHERE w.workspace_id=$1 ORDER BY d.created_at DESC LIMIT 30`, [workspace]),
      query(`SELECT id, action, resource_type, resource_id, actor_type, created_at FROM audit_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 30`, [workspace]),
      query(`SELECT 'scheduled' AS kind, id, status, run_at AS at, body FROM schedules WHERE workspace_id = $1 ORDER BY run_at ASC LIMIT 20`, [workspace]),
    ]);
    return NextResponse.json({ configured: true, accounts: accounts.rows, keys: keys.rows, webhooks: webhooks.rows, deliveries: deliveries.rows, audit: audit.rows, jobs: jobs.rows });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load platform." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required for Platform." }, { status: 503 });
  try {
    const body = await request.json(); const action = String(body?.action || ""); const workspace = await workspaceId();
    if (!workspace) return NextResponse.json({ error: "Workspace is not initialized." }, { status: 503 });
    if (action === "api-key") {
      const name = String(body?.name || "Platform key").trim().slice(0, 80); const scopes = Array.isArray(body?.scopes) ? body.scopes.map(String).slice(0, 30) : ["messages:read"]; const expiresDays = Number(body?.expiresDays || 0);
      const raw = `lwa_${randomBytes(24).toString("hex")}`; const prefix = raw.slice(0, 12); const expiresAt = expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null;
      const result = await withTransaction(async (client) => { const key = await client.query(`INSERT INTO api_keys (workspace_id, name, key_prefix, key_hash, scopes, expires_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING id,name,key_prefix,scopes,expires_at,created_at`, [workspace, name || "Platform key", prefix, hash(raw), JSON.stringify(scopes), expiresAt]); await client.query(`INSERT INTO audit_logs (workspace_id, action, resource_type, resource_id, metadata) VALUES ($1,'api_key.created','api_key',$2,$3::jsonb)`, [workspace, key.rows[0].id, JSON.stringify({ scopes })]); return key.rows[0]; });
      return NextResponse.json({ key: raw, metadata: result }, { status: 201 });
    }
    if (action === "webhook") {
      const name = String(body?.name || "Webhook").trim().slice(0, 80); const url = String(body?.url || "").trim();
      if (!name || !/^https:\/\//i.test(url)) return NextResponse.json({ error: "Webhook URL must use HTTPS." }, { status: 400 });
      try { const parsed = new URL(url); if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(); } catch { return NextResponse.json({ error: "Webhook URL must be a valid HTTPS URL without embedded credentials." }, { status: 400 }); }
      const events = Array.isArray(body?.events) ? body.events.map(String).slice(0, 30) : ["message.received"]; const secret = `whsec_${randomBytes(18).toString("hex")}`;
      const result = await withTransaction(async (client) => { const hook = await client.query(`INSERT INTO webhooks (workspace_id,name,url,secret_hash,secret_ciphertext,events) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id,name,url,events,enabled,created_at`, [workspace, name, url, hash(secret), encryptWebhookSecret(secret), JSON.stringify(events)]); await client.query(`INSERT INTO audit_logs (workspace_id,action,resource_type,resource_id,metadata) VALUES ($1,'webhook.created','webhook',$2,$3::jsonb)`, [workspace, hook.rows[0].id, JSON.stringify({ events })]); return hook.rows[0]; });
      return NextResponse.json({ webhook: result, secret }, { status: 201 });
    }
    if (action === "webhook-test") {
      const id = String(body?.id || "").trim();
      const hook = await query<{ id:string }>("SELECT id FROM webhooks WHERE id=$1 AND workspace_id=$2 AND enabled=true", [id, workspace]);
      if (!hook.rows[0]) return NextResponse.json({ error: "Webhook not found or disabled." }, { status: 404 });
      const result = await emitWebhookEvent(workspace, "webhook.test", { webhook_id: id, message: "LaaWa webhook test" }, id);
      return NextResponse.json(result, { status: result.failed ? 502 : 200 });
    }
    return NextResponse.json({ error: "Unknown platform action." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Platform action failed." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is required for Platform." }, { status: 503 });
  try {
    const body = await request.json(); const workspace = await workspaceId(); const id = String(body?.id || "").trim(); const resource = String(body?.resource || "");
    if (!workspace || !id) return NextResponse.json({ error: "Resource id is required." }, { status: 400 });
    if (resource === "api-key") { const result = await query(`UPDATE api_keys SET revoked_at = NOW() WHERE id=$1 AND workspace_id=$2 AND revoked_at IS NULL RETURNING id`, [id, workspace]); if (!result.rows[0]) return NextResponse.json({ error: "API key not found or already revoked." }, { status: 404 }); await query(`INSERT INTO audit_logs (workspace_id, action, resource_type, resource_id) VALUES ($1,'api_key.revoked','api_key',$2)`, [workspace, id]); return NextResponse.json({ updated: true }); }
    if (resource === "webhook") { const enabled = Boolean(body?.enabled); const result = await query(`UPDATE webhooks SET enabled=$1, updated_at=NOW() WHERE id=$2 AND workspace_id=$3 RETURNING id,enabled`, [enabled, id, workspace]); if (!result.rows[0]) return NextResponse.json({ error: "Webhook not found." }, { status: 404 }); await query(`INSERT INTO audit_logs (workspace_id,action,resource_type,resource_id,metadata) VALUES ($1,'webhook.updated','webhook',$2,$3::jsonb)`, [workspace, id, JSON.stringify({ enabled })]); return NextResponse.json({ updated: true, webhook: result.rows[0] }); }
    return NextResponse.json({ error: "Unknown platform resource." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Platform update failed." }, { status: 500 }); }
}
