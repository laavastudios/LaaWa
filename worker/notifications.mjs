import pg from "pg";
import nodemailer from "nodemailer";
import webpush from "web-push";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const POLL_MS = Math.max(3000, Number(process.env.NOTIFICATIONS_POLL_MS || 5000));
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: Number(process.env.NOTIFICATIONS_DB_POOL_MAX || 4), connectionTimeoutMillis: 10000, ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false } }) : null;
const browserReady = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
if (browserReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
const emailReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
const transporter = emailReady ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE || "false") === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" } : undefined }) : null;
if (!pool) { console.error("[notifications] DATABASE_URL is required."); process.exit(1); }

async function deliver(row) {
  const prefResult = await pool.query("SELECT browser_enabled,email_enabled,email_address,minimum_severity FROM notification_preferences WHERE workspace_id=$1 LIMIT 1", [row.workspace_id]);
  const prefs = prefResult.rows[0] || { browser_enabled: true, email_enabled: false, email_address: null, minimum_severity: "warning" };
  const rank = { info: 0, warning: 1, critical: 2 };
  if (rank[row.severity] < rank[prefs.minimum_severity]) return;
  const ruleResult = await pool.query("SELECT channels FROM notification_rules WHERE workspace_id=$1 AND event_type=$2 LIMIT 1", [row.workspace_id, row.event_type]);
  const channels = Array.isArray(ruleResult.rows[0]?.channels) ? ruleResult.rows[0].channels : ["browser"];
  let browserDone = Boolean(row.browser_sent_at);
  let emailDone = Boolean(row.email_sent_at);
  const errors = [];

  if (!browserDone && prefs.browser_enabled && channels.includes("browser")) {
    if (!browserReady) browserDone = true;
    else {
      const subs = await pool.query("SELECT id,endpoint,p256dh,auth FROM notification_push_subscriptions WHERE workspace_id=$1", [row.workspace_id]);
      browserDone = true;
      for (const sub of subs.rows) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: row.title, body: row.body, severity: row.severity, eventType: row.event_type, data: row.data || {}, notificationId: row.id }));
        } catch (error) {
          const status = error?.statusCode;
          if (status === 404 || status === 410) await pool.query("DELETE FROM notification_push_subscriptions WHERE id=$1", [sub.id]);
          else errors.push(`Browser push: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    if (browserDone) await pool.query("UPDATE notifications SET browser_sent_at=NOW() WHERE id=$1", [row.id]);
  }

  if (!emailDone && prefs.email_enabled && prefs.email_address && channels.includes("email")) {
    if (!emailReady) errors.push("Email channel is enabled but SMTP is not configured.");
    else {
      try {
        await transporter.sendMail({ from: process.env.SMTP_FROM, to: prefs.email_address, subject: `[LaaWa] ${row.title}`, text: row.body, html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${escapeHtml(row.title)}</h2><p>${escapeHtml(row.body).replace(/\n/g, "<br>")}</p><small>Severity: ${escapeHtml(row.severity)}</small></div>` });
        emailDone = true;
        await pool.query("UPDATE notifications SET email_sent_at=NOW() WHERE id=$1", [row.id]);
      } catch (error) { errors.push(`Email: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }
  if (errors.length) await pool.query("UPDATE notifications SET delivery_error=$2 WHERE id=$1", [row.id, errors.join(" | ").slice(0, 2000)]);
  else await pool.query("UPDATE notifications SET delivery_error=NULL WHERE id=$1", [row.id]);
}
function escapeHtml(value) { return String(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\": "&#92;", "\"": "&quot;" })[char] || char); }
async function tick() {
  const result = await pool.query("SELECT id,workspace_id,event_type,severity,title,body,data,browser_sent_at,email_sent_at FROM notifications WHERE (browser_sent_at IS NULL OR email_sent_at IS NULL) AND created_at > NOW() - INTERVAL '30 days' ORDER BY created_at ASC LIMIT 25");
  for (const row of result.rows) await deliver(row);
}
let stopping = false;
async function shutdown() { if (stopping) return; stopping = true; await pool.end().catch(() => {}); process.exit(0); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
console.log(`[laawa] Notification delivery worker started; polling every ${POLL_MS}ms.`);
while (!stopping) { try { await tick(); } catch (error) { console.error("[notifications] Tick failed:", error instanceof Error ? error.message : String(error)); } await new Promise((resolve) => setTimeout(resolve, POLL_MS)); }
