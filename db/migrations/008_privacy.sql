CREATE TABLE IF NOT EXISTS privacy_policies (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  message_retention_days INTEGER NOT NULL DEFAULT 0 CHECK (message_retention_days >= 0),
  notification_retention_days INTEGER NOT NULL DEFAULT 90 CHECK (notification_retention_days >= 0),
  audit_log_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (audit_log_retention_days >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS privacy_policies_updated_idx ON privacy_policies (updated_at DESC);
