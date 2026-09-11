ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS secret_ciphertext TEXT;
CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_created_idx ON webhook_deliveries (webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_status_idx ON webhook_deliveries (webhook_id, status, created_at DESC);
