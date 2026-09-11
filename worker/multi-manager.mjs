import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = Number(process.env.WHATSAPP_MANAGER_PORT || 3020);
const HOST = process.env.WHATSAPP_MANAGER_HOST || "127.0.0.1";
const SECRET = process.env.WHATSAPP_WORKER_SECRET || "";
const CONFIG_FILE = path.resolve(process.env.WHATSAPP_ACCOUNTS_FILE || "./.whatsapp-accounts.json");
const WORKER_FILE = path.resolve("./worker/whatsapp.mjs");
const BASE_PORT = Number(process.env.WHATSAPP_WORKER_PORT || 3010);
const BASE_AUTH = path.resolve(process.env.WHATSAPP_AUTH_PATH || "./.whatsapp-session");
const MAX_ACCOUNTS = 10;
let accounts = loadAccounts();
const children = new Map(); const subscribers = new Set();
function cleanId(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48); }
function loadAccounts() { try { const value = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); if (!Array.isArray(value) || !value.length) throw new Error(); return value.filter((x) => x?.id && Number(x?.port) && x?.authPath).slice(0, MAX_ACCOUNTS); } catch { return [{ id: "default", name: "Primary WhatsApp", port: BASE_PORT, authPath: BASE_AUTH }]; } }
function saveAccounts() { fs.writeFileSync(CONFIG_FILE, JSON.stringify(accounts, null, 2), "utf8"); }
function authorized(req) { return !SECRET || req.headers.authorization === `Bearer ${SECRET}`; }
function json(res, status, body) { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(body)); }
function emit(type, payload) { const packet = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`; for (const res of subscribers) { try { res.write(packet); } catch { subscribers.delete(res); } } }
function accountFor(id) { return accounts.find((account) => account.id === id); }
function childEnv(account) { return { ...process.env, WHATSAPP_WORKER_PORT: String(account.port), WHATSAPP_WORKER_HOST: "127.0.0.1", WHATSAPP_AUTH_PATH: account.authPath, WHATSAPP_ACCOUNT_SESSION_KEY: account.id }; }
function start(account) { if (children.has(account.id)) return; const child = spawn(process.execPath, [WORKER_FILE], { env: childEnv(account), stdio: "inherit", windowsHide: false }); children.set(account.id, child); child.on("error", (error) => { console.error(`[whatsapp:${account.id}] ${error.message}`); emit("account", { id: account.id, status: "error", error: error.message }); }); child.on("exit", (code, signal) => { children.delete(account.id); emit("account", { id: account.id, status: code === 0 ? "stopped" : "error", code, signal }); }); emit("account", { id: account.id, status: "starting" }); }
function stop(account) { const child = children.get(account.id); if (!child) return; try { child.kill(); } catch {} children.delete(account.id); emit("account", { id: account.id, status: "stopped" }); }
async function workerRequest(account, pathname, options = {}) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 3500); try { const response = await fetch(`http://127.0.0.1:${account.port}${pathname}`, { ...options, cache: "no-store", signal: controller.signal, headers: { ...(options.headers || {}), ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}) } }); return { status: response.status, data: await response.json().catch(() => ({})) }; } catch { return { status: 503, data: { status: "offline", connected: false, error: "Worker unavailable" } }; } finally { clearTimeout(timer); } }
async function snapshot() { return Promise.all(accounts.map(async (account) => { const response = await workerRequest(account, "/status"); return { ...account, status: response.data.status || "offline", connected: Boolean(response.data.connected), phone: response.data.phone || null, profileName: response.data.name || null, error: response.data.error || null, process: children.has(account.id) ? "running" : "stopped" }; })); }
for (const account of accounts) start(account);
const server = http.createServer(async (req, res) => {
  if (!authorized(req)) return json(res, 401, { error: "Unauthorized" });
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (req.method === "GET" && url.pathname === "/events") { res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate", connection: "keep-alive", "x-accel-buffering": "no" }); res.write(`event: snapshot\ndata: ${JSON.stringify({ accounts: await snapshot() })}\n\n`); subscribers.add(res); const timer = setInterval(async () => { try { res.write(`event: snapshot\ndata: ${JSON.stringify({ accounts: await snapshot() })}\n\n`); } catch {} }, 5000); req.on("close", () => { clearInterval(timer); subscribers.delete(res); }); return; }
  if (req.method === "GET" && url.pathname === "/accounts") return json(res, 200, { accounts: await snapshot(), limit: MAX_ACCOUNTS });
  if (req.method === "POST" && url.pathname === "/accounts") { if (accounts.length >= MAX_ACCOUNTS) return json(res, 409, { error: `Maximum of ${MAX_ACCOUNTS} WhatsApp accounts reached.` }); let body = ""; for await (const chunk of req) body += chunk; let payload; try { payload = JSON.parse(body || "{}"); } catch { return json(res, 400, { error: "Invalid JSON." }); } const id = cleanId(payload.id || payload.name); if (!id) return json(res, 400, { error: "Account id is required." }); if (accountFor(id)) return json(res, 409, { error: "That account id already exists." }); const usedPorts = new Set(accounts.map((account) => Number(account.port))); let port = BASE_PORT + 1; while (usedPorts.has(port)) port += 1; const account = { id, name: String(payload.name || id).trim().slice(0, 80) || id, port, authPath: path.resolve(`./.whatsapp-session-${id}`) }; accounts.push(account); saveAccounts(); start(account); return json(res, 201, { account: { ...account, status: "starting", connected: false, process: "running" } }); }
  const match = url.pathname.match(/^\/accounts\/([^/]+)(?:\/(restart|stop|status))?$/); const account = match ? accountFor(cleanId(match[1])) : null;
  if (req.method === "DELETE" && match) { if (!account) return json(res, 404, { error: "WhatsApp account not found." }); if (account.id === "default") return json(res, 400, { error: "The primary account cannot be removed." }); stop(account); accounts = accounts.filter((item) => item.id !== account.id); saveAccounts(); return json(res, 200, { ok: true }); }
  if (match) { if (!account) return json(res, 404, { error: "WhatsApp account not found." }); const action = match[2] || "status"; if (action === "restart") { stop(account); start(account); return json(res, 202, { ok: true, id: account.id, status: "starting" }); } if (action === "stop") { stop(account); return json(res, 200, { ok: true, id: account.id, status: "stopped" }); } return json(res, 200, (await workerRequest(account, "/status")).data); }
  return json(res, 404, { error: "Not found." });
});
server.listen(PORT, HOST, () => console.log(`[laawa] Multi-WhatsApp manager listening on http://${HOST}:${PORT} (${accounts.length} account${accounts.length === 1 ? "" : "s"})`));
function shutdown() { for (const account of accounts) stop(account); try { server.close(); } catch {} process.exit(0); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);