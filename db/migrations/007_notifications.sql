CREATE TABLE IF NOT EXISTS notification_preferences (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  browser_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_address TEXT,
  minimum_severity TEXT NOT NULL DEFAULT 'warning' CHECK (minimum_severity IN ('info','warning','critical')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  channels JSONB NOT NULL DEFAULT '["browser"]'::jsonb,
  cooldown_seconds INTEGER NOT NULL DEFAULT 300 CHECK (cooldown_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, event_type)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  browser_sent_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  delivery_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_workspace_created_idx ON notifications (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_pending_delivery_idx ON notifications (created_at) WHERE browser_sent_at IS NULL OR email_sent_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  principal_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, endpoint)
);
CREATE INDEX IF NOT EXISTS notification_push_workspace_idx ON notification_push_subscriptions (workspace_id);

INSERT INTO notification_rules (workspace_id, event_type, severity, channels, cooldown_seconds)
SELECT w.id, e.event_type, e.severity, e.channels::jsonb, e.cooldown
FROM workspaces w
CROSS JOIN (VALUES
  ('whatsapp.connection','critical','["browser","email"]',60),
  ('broadcast.failure','critical','["browser","email"]',300),
  ('worker.failure','critical','["browser","email"]',300),
  ('webhook.failure','warning','["browser"]',300)
) AS e(event_type,severity,channels,cooldown)
ON CONFLICT (workspace_id,event_type) DO NOTHING;
