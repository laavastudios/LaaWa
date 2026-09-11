import { createHash, randomBytes } from "node:crypto";
import { query } from "./db";
import type { ApiScope } from "./api";

const KEY_PREFIX = "lwa_live_";
const KEY_BYTES = 32;

export type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiScope[];
  whatsappAccountIds: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export type CreatedApiKey = ApiKeyRecord & { secret: string };

function hashSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function toRecord(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    keyPrefix: String(row.key_prefix),
    scopes: (row.scopes as ApiScope[]) ?? [],
    whatsappAccountIds: (row.whatsapp_account_ids as string[]) ?? [],
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : null,
    lastUsedAt: row.last_used_at ? new Date(String(row.last_used_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function ensureDefaultWorkspace() {
  const existing = await query<{ id: string }>(
    "SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1",
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await query<{ id: string }>(
    "INSERT INTO workspaces (name) VALUES ('LaaWa Workspace') RETURNING id",
  );
  return created.rows[0].id;
}

export async function createApiKey(input: {
  name: string;
  scopes: ApiScope[];
  whatsappAccountIds?: string[];
  expiresAt?: string | null;
}) {
  const workspaceId = await ensureDefaultWorkspace();
  const secret = `${KEY_PREFIX}${randomBytes(KEY_BYTES).toString("base64url")}`;
  const keyPrefix = secret.slice(0, 17);
  const result = await query<Record<string, unknown>>(
    `INSERT INTO api_keys
      (workspace_id, name, key_prefix, key_hash, scopes, whatsapp_account_ids, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7)
     RETURNING id, name, key_prefix, scopes, whatsapp_account_ids, expires_at, revoked_at, last_used_at, created_at`,
    [
      workspaceId,
      input.name,
      keyPrefix,
      hashSecret(secret),
      input.scopes,
      input.whatsappAccountIds ?? [],
      input.expiresAt ?? null,
    ],
  );

  return { ...toRecord(result.rows[0]), secret } satisfies CreatedApiKey;
}

export async function listApiKeys() {
  const workspaceId = await ensureDefaultWorkspace();
  const result = await query<Record<string, unknown>>(
    `SELECT id, name, key_prefix, scopes, whatsapp_account_ids,
            expires_at, revoked_at, last_used_at, created_at
       FROM api_keys
      WHERE workspace_id = $1
      ORDER BY created_at DESC`,
    [workspaceId],
  );
  return result.rows.map(toRecord);
}

export async function revokeApiKey(id: string) {
  const workspaceId = await ensureDefaultWorkspace();
  const result = await query<{ id: string }>(
    `UPDATE api_keys
        SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2
      RETURNING id`,
    [id, workspaceId],
  );
  return Boolean(result.rowCount);
}

export async function authenticateApiKey(secret: string) {
  if (!secret.startsWith(KEY_PREFIX) || secret.length < 40) return null;

  const result = await query<Record<string, unknown>>(
    `SELECT id, workspace_id, scopes, whatsapp_account_ids, expires_at
       FROM api_keys
      WHERE key_hash = $1
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [hashSecret(secret)],
  );
  const row = result.rows[0];
  if (!row) return null;

  void query(
    "UPDATE api_keys SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1",
    [row.id],
  ).catch(() => undefined);

  return {
    type: "api-key" as const,
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    scopes: (row.scopes as ApiScope[]) ?? [],
    whatsappAccountIds: (row.whatsapp_account_ids as string[]) ?? [],
  };
}
