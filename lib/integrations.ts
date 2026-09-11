import crypto from "node:crypto";
import { query } from "./db";
import type { ApiPrincipal } from "./api";

export type IntegrationProvider = "chatwoot" | "wordpress" | "webhook";
export const INTEGRATION_PROVIDERS: Record<IntegrationProvider, { label: string; description: string }> = {
  chatwoot: { label: "Chatwoot", description: "Bridge WhatsApp conversations into a shared support inbox." },
  wordpress: { label: "WordPress", description: "Connect WordPress sites to your messaging API." },
  webhook: { label: "Webhooks", description: "Send signed LaaWa events to any HTTPS endpoint." },
};

type ConnectionRow = { id: string; workspace_id: string; provider: IntegrationProvider; name: string; config_ciphertext: string; enabled: boolean; last_tested_at: string | null; last_error: string | null; created_at: string; updated_at: string };

function key() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("INTEGRATION_ENCRYPTION_KEY or AUTH_SECRET is required.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptIntegrationConfig(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function decryptIntegrationConfig<T>(ciphertext: string): T {
  const [ivRaw, tagRaw, bodyRaw] = ciphertext.split(".");
  if (!ivRaw || !tagRaw || !bodyRaw) throw new Error("Invalid integration configuration.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(bodyRaw, "base64url")), decipher.final()]).toString("utf8")) as T;
}

export async function integrationWorkspace(principal: ApiPrincipal) {
  if (principal.workspaceId) return principal.workspaceId;
  const result = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  return result.rows[0]?.id || null;
}

export async function listIntegrations(principal: ApiPrincipal) {
  const workspaceId = await integrationWorkspace(principal);
  if (!workspaceId) return [];
  const result = await query<ConnectionRow>("SELECT id, workspace_id, provider, name, config_ciphertext, enabled, last_tested_at, last_error, created_at, updated_at FROM integration_connections WHERE workspace_id=$1 ORDER BY provider, name", [workspaceId]);
  return result.rows.map(({ config_ciphertext: _secret, ...item }) => item);
}

export async function getIntegration(principal: ApiPrincipal, id: string) {
  const workspaceId = await integrationWorkspace(principal);
  if (!workspaceId) return null;
  const result = await query<ConnectionRow>("SELECT * FROM integration_connections WHERE id=$1 AND workspace_id=$2 LIMIT 1", [id, workspaceId]);
  return result.rows[0] || null;
}

export function normalizeProvider(value: unknown): IntegrationProvider | null {
  return value === "chatwoot" || value === "wordpress" || value === "webhook" ? value : null;
}

export function redactConfig(provider: IntegrationProvider, config: Record<string, unknown>) {
  const secretKeys = provider === "chatwoot" ? ["apiToken"] : provider === "wordpress" ? ["apiKey", "password"] : ["secret"];
  return Object.fromEntries(Object.entries(config).map(([k, v]) => [k, secretKeys.includes(k) && v ? "••••••••" : v]));
}
