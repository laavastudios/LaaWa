import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth, MessageMedia } = pkg;
const PORT = Number(process.env.WHATSAPP_WORKER_PORT || process.env.PORT || 3010);
const HOST = process.env.WHATSAPP_WORKER_HOST || "127.0.0.1";
const SECRET = process.env.WHATSAPP_WORKER_SECRET || "";
const AUTH_PATH = process.env.WHATSAPP_AUTH_PATH || "./.whatsapp-session";
const MESSAGE_FILE = path.join(path.resolve(AUTH_PATH), "messages.json");
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

let state = { status: "starting", connected: false, qr: null, pairingCode: null, phone: null, name: null, error: null };
let messages = loadMessages();
const subscribers = new Set();
let historySyncRunning = false;

function loadMessages() { try { const value = JSON.parse(fs.readFileSync(MESSAGE_FILE, "utf8")); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveMessages() { fs.mkdirSync(path.dirname(MESSAGE_FILE), { recursive: true }); const temp = `${MESSAGE_FILE}.tmp`; fs.writeFileSync(temp, JSON.stringify(messages.slice(-5000)), "utf8"); fs.renameSync(temp, MESSAGE_FILE); }
function authorized(req) { return !SECRET || req.headers.authorization === `Bearer ${SECRET}`; }
function writeJson(res, status, body) { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(body)); }
function cleanPhone(value) { return String(value || "").replace(/\D/g, ""); }
function emit(type, payload = {}) { const packet = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`; for (const res of subscribers) { try { res.write(packet); } catch { subscribers.delete(res); } } }

async function contactMeta(chatId, fallback = {}) {
  const meta = { ...fallback, chatId };
  try {
    if (!chatId || chatId.includes("@newsletter") || chatId.includes("@broadcast")) return meta;
    const contact = await client.getContactById(chatId);
    if (contact) {
      meta.name = contact.pushname || contact.name || contact.shortName || meta.name || "Unknown";
      meta.phone = cleanPhone(contact.number || contact.id?.user || meta.phone || chatId);
      try { meta.avatar = await contact.getProfilePicUrl(); } catch {}
      meta.isBusiness = Boolean(contact.isBusiness);
    }
  } catch {}
  return meta;
}

async function captureMessage(message, chatMeta = null, announce = true) {
  try {
    const rawChatId = chatMeta?.id?._serialized || (message.fromMe ? message.to : message.from);
    const chatId = String(rawChatId || "").trim();
    if (!chatId || chatId === "status@broadcast") return null;
    const basePhone = chatMeta?.id?.user || message?._data?.from || message?._data?.to || cleanPhone(chatId);
    const fallback = {
      name: chatMeta?.name || message?._data?.notifyName || message?._data?.pushname || basePhone || "Unknown",
      phone: cleanPhone(basePhone),
      avatar: chatMeta?.profilePicUrl || chatMeta?.avatar || null,
    };
    const meta = chatMeta ? fallback : await contactMeta(chatId, fallback);
    return upsertMessage({
      id: message?.id?._serialized || `${chatId}-${message.timestamp}-${message.fromMe ? "out" : "in"}-${message.body || ""}`,
      chatId,
      body: String(message.body || ""),
      timestamp: Number(message.timestamp || Math.floor(Date.now() / 1000)),
      fromMe: Boolean(message.fromMe),
      name: meta.name || "Unknown",
      phone: cleanPhone(meta.phone),
      avatar: meta.avatar || null,
      isBusiness: Boolean(meta.isBusiness),
      type: String(message.type || "chat"),
      hasMedia: Boolean(message.hasMedia),
      media: null,
      read: Boolean(message.fromMe),
    }, announce);
  } catch (error) { console.error("Could not store WhatsApp message:", error instanceof Error ? error.message : String(error)); return null; }
}

function upsertMessage(record, announce = true) {
  if (!record.id || !record.chatId) return null;
  const index = messages.findIndex((item) => item.id === record.id);
  if (index >= 0) messages[index] = { ...messages[index], ...record, media: record.media ?? messages[index].media ?? null };
  else messages.push(record);
  messages.sort((a, b) => a.timestamp - b.timestamp);
  saveMessages();
  const saved = messages[index >= 0 ? index : messages.length - 1];
  if (announce) emit("message", { message: saved });
  return saved;
}

async function syncHistory() {
  if (historySyncRunning) return;
  historySyncRunning = true;
  try {
    const chats = await client.getChats();
    const usable = chats.filter((chat) => chat?.id?._serialized && chat.id._serialized !== "status@broadcast").filter((chat) => !chat.isGroup).slice(0, 40);
    let imported = 0;
    for (const chat of usable) {
      try {
        const meta = await contactMeta(chat.id._serialized, { name: chat.name, phone: chat.id.user, avatar: null });
        const history = await chat.fetchMessages({ limit: 30 });
        for (const message of history) if (await captureMessage(message, { id: chat.id, name: meta.name, profilePicUrl: meta.avatar }, false)) imported += 1;
      } catch (error) { console.error(`Could not sync chat ${chat?.id?._serialized || "unknown"}:`, error instanceof Error ? error.message : String(error)); }
    }
    emit("sync", { imported, chats: usable.length });
    console.log(`WhatsApp inbox history synced: ${imported} messages from ${usable.length} chats.`);
  } catch (error) { console.error("Could not sync WhatsApp inbox history:", error instanceof Error ? error.message : String(error)); }
  finally { historySyncRunning = false; }
}

function conversations() {
  const map = new Map();
  for (const message of messages) {
    const current = map.get(message.chatId);
    if (!current || message.timestamp >= current.timestamp) map.set(message.chatId, {
      chatId: message.chatId, name: message.name || message.phone || "Unknown", phone: message.phone || "", avatar: message.avatar || null,
      isBusiness: Boolean(message.isBusiness), lastMessage: message.body || (message.hasMedia ? `[${message.type || "media"}]` : "[message]"), timestamp: message.timestamp, unread: 0,
    });
  }
  for (const message of messages) if (!message.fromMe && !message.read && map.has(message.chatId)) map.get(message.chatId).unread += 1;
  return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
}

const client = new Client({ authStrategy: new LocalAuth({ dataPath: AUTH_PATH }), puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] } });
client.on("qr", (qr) => { state = { ...state, status: "qr", connected: false, qr, pairingCode: null, error: null }; emit("state", state); console.log("\nWhatsApp QR code ready — scan it from Linked Devices.\n"); qrcode.generate(qr, { small: true }); });
client.on("authenticated", () => { state = { ...state, status: "authenticated", qr: null, pairingCode: null, error: null }; emit("state", state); console.log("WhatsApp authenticated."); });
client.on("ready", async () => { const info = client.info; state = { ...state, status: "connected", connected: true, qr: null, pairingCode: null, phone: info?.wid?.user || null, name: info?.pushname || null, error: null }; emit("state", state); console.log(`WhatsApp connected${state.phone ? `: ${state.phone}` : ""}`); void syncHistory(); });
client.on("message_create", (message) => { void captureMessage(message); });
client.on("auth_failure", (message) => { state = { ...state, status: "error", connected: false, error: String(message), qr: null }; emit("state", state); console.error("WhatsApp authentication failed:", message); });
client.on("disconnected", (reason) => { state = { ...state, status: "disconnected", connected: false, qr: null, pairingCode: null, error: String(reason || "Disconnected") }; emit("state", state); console.log("WhatsApp disconnected:", reason); });
client.on("change_state", (next) => { if (!state.connected) { state = { ...state, status: String(next).toLowerCase() }; emit("state", state); } });

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) return writeJson(res, 401, { error: "Unauthorized" });
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate", "connection": "keep-alive", "x-accel-buffering": "no" });
    res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`); res.write(`event: snapshot\ndata: ${JSON.stringify({ conversations: conversations() })}\n\n`); subscribers.add(res);
    const heartbeat = setInterval(() => { try { res.write(": keepalive\n\n"); } catch {} }, 15000);
    req.on("close", () => { clearInterval(heartbeat); subscribers.delete(res); });
    return;
  }
  if (req.method === "GET" && url.pathname === "/status") {
    const chatId = url.searchParams.get("chatId");
    if (chatId) { const selected = messages.filter((message) => message.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp); let changed = false; for (const message of selected) if (!message.fromMe && !message.read) { message.read = true; changed = true; } if (changed) saveMessages(); return writeJson(res, 200, { ...state, messages: selected }); }
    return writeJson(res, 200, { ...state, conversations: conversations() });
  }
  if (req.method === "GET" && url.pathname === "/messages") {
    const chatId = url.searchParams.get("chatId");
    if (!chatId) return writeJson(res, 200, { conversations: conversations() });
    const selected = messages.filter((message) => message.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp); let changed = false; for (const message of selected) if (!message.fromMe && !message.read) { message.read = true; changed = true; } if (changed) saveMessages(); return writeJson(res, 200, { messages: selected });
  }
  if (req.method === "POST" && url.pathname === "/send") {
    let body = ""; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > MAX_UPLOAD_BYTES + 1024 * 1024) return writeJson(res, 413, { error: "Upload is too large." }); }
    let payload; try { payload = JSON.parse(body || "{}"); } catch { return writeJson(res, 400, { error: "Invalid JSON." }); }
    const chatId = String(payload.chatId || "").trim(); const text = String(payload.body || "").trim();
    if (!client.info?.wid) return writeJson(res, 409, { error: "WhatsApp is not connected." });
    if (!chatId || (!text && !payload.media)) return writeJson(res, 400, { error: "Chat and message are required." });
    if (text.length > 4096) return writeJson(res, 400, { error: "Message is too long." });
    try {
      let sent;
      if (payload.media?.data) {
        const data = String(payload.media.data);
        const size = Math.floor((data.length * 3) / 4);
        if (size > MAX_UPLOAD_BYTES) return writeJson(res, 413, { error: "File is larger than 25 MB." });
        const media = new MessageMedia(String(payload.media.mimetype || "application/octet-stream"), data, String(payload.media.filename || "file"));
        const type = String(payload.media.kind || "document");
        const options = { caption: text || undefined, sendAudioAsVoice: type === "audio" && Boolean(payload.media.voice) };
        sent = await client.sendMessage(chatId, media, options);
      } else {
        sent = await client.sendMessage(chatId, text);
      }
      await captureMessage(sent, null, true);
      return writeJson(res, 200, { ok: true, id: sent?.id?._serialized || null });
    } catch (error) { return writeJson(res, 400, { error: error instanceof Error ? error.message : "Could not send message." }); }
  }
  if (req.method === "POST" && url.pathname === "/pairing-code") {
    let body = ""; for await (const chunk of req) body += chunk; let phone; try { phone = JSON.parse(body || "{}").phoneNumber; } catch { return writeJson(res, 400, { error: "Invalid JSON." }); }
    const clean = cleanPhone(phone); if (!/^\d{8,15}$/.test(clean)) return writeJson(res, 400, { error: "Enter a valid international mobile number." });
    try { if (client.info?.wid) return writeJson(res, 409, { error: "WhatsApp is already connected." }); state = { ...state, status: "pairing", pairingCode: null, qr: null, phone: clean, error: null }; emit("state", state); const code = await client.requestPairingCode(clean); state = { ...state, status: "pairing", pairingCode: String(code).toUpperCase() }; emit("state", state); return writeJson(res, 200, { ok: true, code: state.pairingCode }); }
    catch (error) { state = { ...state, status: "error", error: error instanceof Error ? error.message : "Could not create pairing code." }; emit("state", state); return writeJson(res, 400, { error: state.error }); }
  }
  if (req.method === "POST" && url.pathname === "/logout") {
    try { await client.logout(); state = { status: "logged_out", connected: false, qr: null, pairingCode: null, phone: null, name: null, error: null }; emit("state", state); return writeJson(res, 200, { ok: true }); }
    catch (error) { return writeJson(res, 400, { error: error instanceof Error ? error.message : "Could not disconnect." }); }
  }
  return writeJson(res, 404, { error: "Not found." });
});

server.listen(PORT, HOST, () => { console.log(`LaaWa WhatsApp worker listening on http://${HOST}:${PORT}`); client.initialize().catch((error) => { state = { ...state, status: "error", error: error instanceof Error ? error.message : String(error) }; emit("state", state); console.error("WhatsApp initialization failed:", error); }); });