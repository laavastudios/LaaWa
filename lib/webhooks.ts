import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { isDatabaseConfigured, query } from "./db";

const ALGORITHM = "aes-256-gcm";
const EVENT_TIMEOUT_MS = 8_000;
const MAX_BODY = 8_000;
const RETRIES = 3;

function key() {
  const secret = process.env.LAAWA_SESSION_SECRET;
  if (!secret) throw new Error("LAAWA_SESSION_SECRET is required for webhook signing.");
  return createHash("sha256").update(secret).digest();
}

export function encryptWebhookSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptWebhookSecret(value: string) {
  const [ivRaw, tagRaw, dataRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid webhook secret.");
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
}

function allowedUrl(raw: string) {
  const url = new URL(raw);
  return url.protocol === "https:" && !url.username && !url.password;
}

async function deliver(id: string, url: string, secret: string, eventType: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({ id, type: eventType, created_at: new Date().toISOString(), data: payload });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  let lastStatus: number | null = null;
  let lastBody = "";
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EVENT_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "LaaWa-Webhooks/1.0", "x-laawa-event": eventType, "x-laawa-delivery": id, "x-laawa-signature": `sha256=${signature}` },
        body,
        signal: controller.signal,
      });
      lastStatus = response.status;
      lastBody = (await response.text()).slice(0, MAX_BODY);
      if (response.ok) {
        await query("UPDATE webhook_deliveries SET status='delivered', attempts=$2, response_status=$3, response_body=$4, delivered_at=NOW(), next_attempt_at=NULL WHERE id=$1", [id, attempt, response.status, lastBody]);
        return;
      }
    } catch (error) {
      lastBody = error instanceof Error ? error.message : String(error);
    } finally { clearTimeout(timer); }
    if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
  }
  await query("UPDATE webhook_deliveries SET status='failed', attempts=$2, response_status=$3, response_body=$4, next_attempt_at=NOW() + INTERVAL '5 minutes' WHERE id=$1", [id, RETRIES, lastStatus, lastBody]);
}

export async function emitWebhookEvent(workspaceId: string, eventType: string, payload: Record<string, unknown>) {
  if (!isDatabaseConfigured()) return;
  const hooks = await query<{ id: string; url: string; secret_ciphertext: string | null }>("SELECT id,url,secret_ciphertext FROM webhooks WHERE workspace_id=$1 AND enabled=true AND events @> $2::jsonb", [workspaceId, JSON.stringify([eventType])]);
  await Promise.all(hooks.rows.map(async (hook) => {
    if (!hook.secret_ciphertext) return;
    try {
      if (!allowedUrl(hook.url)) throw new Error("Webhook URL must use HTTPS.");
      const delivery = await query<{ id: string }>("INSERT INTO webhook_deliveries (webhook_id,event_type,payload,status,attempts,next_attempt_at) VALUES ($1,$2,$3,'pending',0,NOW()) RETURNING id", [hook.id, eventType, JSON.stringify(payload)]);
      await deliver(delivery.rows[0].id, hook.url, decryptWebhookSecret(hook.secret_ciphertext), eventType, payload);
    } catch (error) {
      console.error("Webhook delivery failed:", error instanceof Error ? error.message : String(error));
    }
  }));
}
