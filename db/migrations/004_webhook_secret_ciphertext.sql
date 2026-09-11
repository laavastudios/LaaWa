ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS secret_ciphertext TEXT;

UPDATE webhooks
SET secret_ciphertext = NULL
WHERE secret_ciphertext IS NULL;

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_created_idx
  ON webhook_deliveries (webhook_id, created_at DESC);
