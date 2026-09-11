CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('chatwoot','wordpress','webhook')),
  name TEXT NOT NULL,
  config_ciphertext TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_connections_workspace_provider_name_idx ON integration_connections (workspace_id, provider, name);
CREATE INDEX IF NOT EXISTS integration_connections_workspace_provider_idx ON integration_connections (workspace_id, provider, enabled);
