CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  whatsapp_account_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (cardinality(scopes) > 0),
  CHECK (scopes <@ ARRAY['read','write','admin']::TEXT[])
);

CREATE INDEX IF NOT EXISTS api_keys_workspace_created_idx
  ON api_keys (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_keys_active_idx
  ON api_keys (workspace_id, revoked_at, expires_at);
