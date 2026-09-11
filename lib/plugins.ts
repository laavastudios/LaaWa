import crypto from "node:crypto";
import { query, withTransaction } from "./db";
import type { ApiPrincipal } from "./api";

export const PLUGIN_EVENTS = [
  "message.received", "message.sent", "conversation.created", "conversation.updated",
  "contact.created", "contact.updated", "broadcast.completed", "broadcast.failed",
  "whatsapp.connected", "whatsapp.disconnected", "webhook.failed",
] as const;
export const PLUGIN_PERMISSIONS = ["messages.read", "messages.write", "contacts.read", "conversations.read", "broadcasts.read", "accounts.read"] as const;
export type PluginEvent = typeof PLUGIN_EVENTS[number];
export type PluginPermission = typeof PLUGIN_PERMISSIONS[number];

type PluginManifest = {
  slug: string; name: string; version: string; description?: string; author?: string; homepageUrl?: string;
  callbackUrl: string; permissions: PluginPermission[]; events: PluginEvent[]; settings?: Record<string, unknown>;
};

type PluginRow = { id: string; slug: string; name: string; version: string; description: string; author: string; homepage_url: string | null; manifest: Record<string, unknown>; enabled: boolean; created_at: Date; updated_at: Date };
type InstallationRow = { id: string; workspace_id: string; plugin_id: string; callback_url: string; secret_ciphertext: string; permissions: PluginPermission[]; events: PluginEvent[]; settings_ciphertext: string; enabled: boolean; last_delivered_at: Date | null; last_error: string | null; failure_count: number; created_at: Date; updated_at: Date };

function cryptoKey() {
  const secret = process.env.PLUGIN_ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("PLUGIN_ENCRYPTION_KEY, INTEGRATION_ENCRYPTION_KEY, or AUTH_SECRET is required.");
  return crypto.createHash("sha256").update(secret).digest();
}
function encrypt(value: unknown) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}
function decrypt<T>(ciphertext: string): T {
  if (!ciphertext) return {} as T;
  const [iv, tag, body] = ciphertext.split(".");
  if (!iv || !tag || !body) throw new Error("Invalid plugin secret configuration.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", cryptoKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8")) as T;
}

export function validatePluginUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Plugin callback URL is required.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Plugin callback URL must be a valid URL."); }
  if (url.protocol !== "https:") throw new Error("Plugin callback URL must use HTTPS.");
  if (url.username || url.password) throw new Error("Plugin callback URL cannot contain credentials.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "0.0.0.0" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".local")) {
    throw new Error("Plugin callback URL cannot target a local hostname.");
  }
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname)) throw new Error("Plugin callback URL cannot target a private network address.");
  return url.toString();
}

function normalizeManifest(input: unknown): PluginManifest {
  if (!input || typeof input !== "object") throw new Error("Plugin manifest must be an object.");
  const raw = input as Record<string, unknown>;
  const slug = String(raw.slug || "").trim().toLowerCase();
  const name = String(raw.name || "").trim();
  const version = String(raw.version || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(slug)) throw new Error("Plugin slug must use 2–64 lowercase URL-safe characters.");
  if (!name || name.length > 100 || !version || version.length > 50) throw new Error("Plugin name and version are required.");
  const permissions = Array.isArray(raw.permissions) ? raw.permissions.filter((v): v is PluginPermission => typeof v === "string" && (PLUGIN_PERMISSIONS as readonly string[]).includes(v)) : [];
  const events = Array.isArray(raw.events) ? raw.events.filter((v): v is PluginEvent => typeof v === "string" && (PLUGIN_EVENTS as readonly string[]).includes(v)) : [];
  if (permissions.length !== (Array.isArray(raw.permissions) ? new Set(raw.permissions).size : 0)) throw new Error("Plugin manifest contains an unsupported or duplicate permission.");
  if (events.length !== (Array.isArray(raw.events) ? new Set(raw.events).size : 0)) throw new Error("Plugin manifest contains an unsupported or duplicate event.");
  return { slug, name, version, description: String(raw.description || "").slice(0, 500), author: String(raw.author || "").slice(0, 100), homepageUrl: raw.homepageUrl ? validatePluginUrl(raw.homepageUrl) : undefined, callbackUrl: validatePluginUrl(raw.callbackUrl), permissions, events, settings: raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings) ? raw.settings as Record<string, unknown> : undefined };
}

export async function pluginWorkspace(principal: ApiPrincipal) {
  if (principal.workspaceId) return principal.workspaceId;
  const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  return result.rows[0]?.id || null;
}

export async function listPlugins(principal: ApiPrincipal) {
  const workspaceId = await pluginWorkspace(principal); if (!workspaceId) return [];
  const result = await query<PluginRow & { installation_id: string | null; installation_enabled: boolean | null; events: PluginEvent[] | null; permissions: PluginPermission[] | null; last_delivered_at: Date | null; last_error: string | null }>(
    `SELECT p.*, i.id AS installation_id, i.enabled AS installation_enabled, i.events, i.permissions, i.last_delivered_at, i.last_error
     FROM plugins p LEFT JOIN plugin_installations i ON i.plugin_id=p.id AND i.workspace_id=$1 ORDER BY p.name`, [workspaceId]);
  return result.rows.map(row => ({ id: row.id, slug: row.slug, name: row.name, version: row.version, description: row.description, author: row.author, homepageUrl: row.homepage_url, enabled: row.enabled, installed: Boolean(row.installation_id), installationId: row.installation_id, installationEnabled: row.installation_enabled, events: row.events || [], permissions: row.permissions || [], lastDeliveredAt: row.last_delivered_at?.toISOString() || null, lastError: row.last_error }));
}

export async function getPlugin(principal: ApiPrincipal, id: string) {
  const workspaceId = await pluginWorkspace(principal); if (!workspaceId) return null;
  const result = await query<PluginRow & { installation_id: string | null; installation_enabled: boolean | null; callback_url: string | null; events: PluginEvent[] | null; permissions: PluginPermission[] | null; settings_ciphertext: string | null }>(
    `SELECT p.*, i.id AS installation_id, i.enabled AS installation_enabled, i.callback_url, i.events, i.permissions, i.settings_ciphertext
     FROM plugins p LEFT JOIN plugin_installations i ON i.plugin_id=p.id AND i.workspace_id=$1 WHERE p.id=$2 LIMIT 1`, [workspaceId, id]);
  const row = result.rows[0]; if (!row) return null;
  return { ...row, installation: row.installation_id ? { id: row.installation_id, enabled: row.installation_enabled, callbackUrl: row.callback_url, events: row.events || [], permissions: row.permissions || [], settings: row.settings_ciphertext ? decrypt<Record<string, unknown>>(row.settings_ciphertext) : {} } : null };
}

export async function registerPlugin(principal: ApiPrincipal, manifestInput: unknown) {
  const workspaceId = await pluginWorkspace(principal); if (!workspaceId) throw new Error("No workspace is available.");
  const manifest = normalizeManifest(manifestInput);
  return withTransaction(async client => {
    const existing = await client.query<{ id: string }>("SELECT id FROM plugins WHERE slug=$1 LIMIT 1", [manifest.slug]);
    let pluginId = existing.rows[0]?.id;
    if (pluginId) {
      await client.query(`UPDATE plugins SET name=$2, version=$3, description=$4, author=$5, homepage_url=$6, manifest=$7::jsonb, updated_at=NOW() WHERE id=$1`, [pluginId, manifest.name, manifest.version, manifest.description, manifest.author, manifest.homepageUrl || null, JSON.stringify(manifest)]);
    } else {
      const inserted = await client.query<{ id: string }>(`INSERT INTO plugins (slug,name,version,description,author,homepage_url,manifest) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`, [manifest.slug, manifest.name, manifest.version, manifest.description, manifest.author, manifest.homepageUrl || null, JSON.stringify(manifest)]);
      pluginId = inserted.rows[0].id;
    }
    const secret = crypto.randomBytes(32).toString("base64url");
    await client.query(`INSERT INTO plugin_installations (workspace_id,plugin_id,callback_url,secret_ciphertext,permissions,events,settings_ciphertext) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) ON CONFLICT (workspace_id,plugin_id) DO UPDATE SET callback_url=EXCLUDED.callback_url, permissions=EXCLUDED.permissions, events=EXCLUDED.events, settings_ciphertext=EXCLUDED.settings_ciphertext, enabled=TRUE, updated_at=NOW()`, [workspaceId, pluginId, manifest.callbackUrl, encrypt(secret), JSON.stringify(manifest.permissions), JSON.stringify(manifest.events), encrypt(manifest.settings || {})]);
    return { pluginId, slug: manifest.slug, name: manifest.name, version: manifest.version, secret };
  });
}

export async function updatePluginInstallation(principal: ApiPrincipal, id: string, input: { enabled?: boolean; events?: unknown; permissions?: unknown; settings?: Record<string, unknown>; callbackUrl?: unknown }) {
  const workspaceId = await pluginWorkspace(principal); if (!workspaceId) return null;
  const current = await query<InstallationRow>("SELECT * FROM plugin_installations WHERE id=$1 AND workspace_id=$2 LIMIT 1", [id, workspaceId]);
  const row = current.rows[0]; if (!row) return null;
  const events = input.events === undefined ? row.events : Array.isArray(input.events) ? input.events.filter((v): v is PluginEvent => typeof v === "string" && (PLUGIN_EVENTS as readonly string[]).includes(v)) : (()=>{throw new Error("events must be an array.")})();
  const permissions = input.permissions === undefined ? row.permissions : Array.isArray(input.permissions) ? input.permissions.filter((v): v is PluginPermission => typeof v === "string" && (PLUGIN_PERMISSIONS as readonly string[]).includes(v)) : (()=>{throw new Error("permissions must be an array.")})();
  const callbackUrl = input.callbackUrl === undefined ? row.callback_url : validatePluginUrl(input.callbackUrl);
  await query(`UPDATE plugin_installations SET enabled=$2, events=$3::jsonb, permissions=$4::jsonb, settings_ciphertext=$5, callback_url=$6, updated_at=NOW() WHERE id=$1 AND workspace_id=$7`, [id, input.enabled ?? row.enabled, JSON.stringify(events), JSON.stringify(permissions), input.settings === undefined ? row.settings_ciphertext : encrypt(input.settings), callbackUrl, workspaceId]);
  return { id, enabled: input.enabled ?? row.enabled, events, permissions, callbackUrl };
}

export async function uninstallPlugin(principal: ApiPrincipal, id: string) {
  const workspaceId = await pluginWorkspace(principal); if (!workspaceId) return false;
  const result = await query("DELETE FROM plugin_installations WHERE id=$1 AND workspace_id=$2", [id, workspaceId]); return Boolean(result.rowCount);
}

export async function dispatchPluginEvent(workspaceId: string, eventType: PluginEvent, payload: Record<string, unknown>) {
  const installations = await query<{ id: string; callback_url: string; secret_ciphertext: string }>(`SELECT id, callback_url, secret_ciphertext FROM plugin_installations i JOIN plugins p ON p.id=i.plugin_id WHERE i.workspace_id=$1 AND i.enabled=TRUE AND p.enabled=TRUE AND i.events @> $2::jsonb`, [workspaceId, JSON.stringify([eventType])]);
  const created: string[] = [];
  for (const item of installations.rows) {
    const body = JSON.stringify({ id: crypto.randomUUID(), apiVersion: "v1", type: eventType, createdAt: new Date().toISOString(), data: payload });
    const secret = decrypt<string>(item.secret_ciphertext);
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const delivery = await query<{ id: string }>(`INSERT INTO plugin_deliveries (installation_id,event_type,payload,status,next_attempt_at) VALUES ($1,$2,$3::jsonb,'pending',NOW()) RETURNING id`, [item.id, eventType, body]);
    created.push(delivery.rows[0].id);
    try {
      const response = await fetch(item.callback_url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "LaaWa-Plugin-Gateway/1.0", "x-laawa-event": eventType, "x-laawa-signature": `sha256=${signature}` }, body, cache: "no-store", signal: AbortSignal.timeout(8000) });
      const responseBody = await response.text();
      await query(`UPDATE plugin_deliveries SET status=$2,response_status=$3,response_body=$4,attempts=attempts+1,delivered_at=CASE WHEN $2='delivered' THEN NOW() ELSE delivered_at END WHERE id=$1`, [delivery.rows[0].id, response.ok ? "delivered" : "failed", response.status, responseBody.slice(0, 2000)]);
      await query(`UPDATE plugin_installations SET last_delivered_at=CASE WHEN $2='delivered' THEN NOW() ELSE last_delivered_at END,last_error=CASE WHEN $2='failed' THEN $3 ELSE NULL END,failure_count=CASE WHEN $2='failed' THEN failure_count+1 ELSE 0 END,updated_at=NOW() WHERE id=$1`, [item.id, response.ok ? "delivered" : "failed", response.ok ? null : `HTTP ${response.status}`]);
    } catch (error) {
      await query("UPDATE plugin_deliveries SET status='failed', attempts=attempts+1, response_body=$2 WHERE id=$1", [delivery.rows[0].id, error instanceof Error ? error.message : "Delivery failed"]);
      await query("UPDATE plugin_installations SET last_error=$2, failure_count=failure_count+1, updated_at=NOW() WHERE id=$1", [item.id, error instanceof Error ? error.message : "Delivery failed"]);
    }
  }
  return { eventType, deliveries: created.length, deliveryIds: created };
}

export async function testPlugin(principal: ApiPrincipal, installationId: string) {
  const workspaceId = await pluginWorkspace(principal); if (!workspaceId) return null;
  const result = await query<{ plugin_id: string }>("SELECT plugin_id FROM plugin_installations WHERE id=$1 AND workspace_id=$2 LIMIT 1", [installationId, workspaceId]);
  if (!result.rows[0]) return null;
  return dispatchPluginEvent(workspaceId, "message.received", { test: true, installationId });
}
