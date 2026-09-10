import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;
const PORT = Number(process.env.WHATSAPP_WORKER_PORT || process.env.PORT || 3010);
const HOST = process.env.WHATSAPP_WORKER_HOST || "127.0.0.1";
const SECRET = process.env.WHATSAPP_WORKER_SECRET || "";
const AUTH_PATH = process.env.WHATSAPP_AUTH_PATH || "./.whatsapp-session";
const MESSAGE_FILE = path.join(path.resolve(AUTH_PATH), "messages.json");

let state = { status: "starting", connected: false, qr: null, pairingCode: null, phone: null, name: null, error: null };
let messages = loadMessages();

function loadMessages() {
  try {
    const value = JSON.parse(fs.readFileSync(MESSAGE_FILE, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function saveMessages() {
  fs.mkdirSync(path.dirname(MESSAGE_FILE), { recursive: true });
  const temp = `${MESSAGE_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(messages.slice(-2000)), "utf8");
  fs.renameSync(temp, MESSAGE_FILE);
}

function authorized(req) { return !SECRET || req.headers.authorization === `Bearer ${SECRET}`; }
function writeJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function cleanPhone(value) { return String(value || "").replace(/\D/g, ""); }

function upsertMessage(record) {
  if (!record.id || !record.chatId) return;
  const index = messages.findIndex((item) => item.id === record.id);
  if (index >= 0) messages[index] = { ...messages[index], ...record };
  else messages.push(record);
  messages.sort((a, b) => a.timestamp - b.timestamp);
  saveMessages();
}

async function captureMessage(message) {
  try {
    const chat = await message.getChat();
    const chatId = chat?.id?._serialized || (message.fromMe ? message.to : message.from);
    const phone = chat?.id?.user || cleanPhone(chatId);
    const name = chat?.name || message?._data?.notifyName || phone || "Unknown";
    upsertMessage({
      id: message?.id?._serialized || `${chatId}-${message.timestamp}-${Math.random()}`,
      chatId,
      body: String(message.body || ""),
      timestamp: Number(message.timestamp || Math.floor(Date.now() / 1000)),
      fromMe: Boolean(message.fromMe),
      name,
      phone,
      read: Boolean(message.fromMe),
    });
  } catch (error) { console.error("Could not store WhatsApp message:", error); }
}

async function syncHistory() {
  try {
    const chats = await client.getChats();
    const usable = chats.filter((chat) => chat?.id?._serialized && chat.id._serialized !== "status@broadcast").slice(0, 100);
    let imported = 0;
    for (const chat of usable) {
      try {
        const history = await chat.fetchMessages({ limit: 50 });
        for (const message of history) {
          await captureMessage(message);
          imported += 1;
        }
      } catch (error) {
        console.error(`Could not sync chat ${chat?.id?._serialized || "unknown"}:`, error?.message || error);
      }
    }
    console.log(`WhatsApp inbox history synced: ${imported} messages from ${usable.length} chats.`);
  } catch (error) {
    console.error("Could not sync WhatsApp inbox history:", error?.message || error);
  }
}

function conversations() {
  const map = new Map();
  for (const message of messages) {
    const current = map.get(message.chatId);
    if (!current || message.timestamp >= current.timestamp) {
      map.set(message.chatId, {
        chatId: message.chatId,
        name: message.name || message.phone || "Unknown",
        phone: message.phone || "",
        lastMessage: message.body || "[media/message]",
        timestamp: message.timestamp,
        unread: 0,
      });
    }
  }
  for (const message of messages) if (!message.fromMe && !message.read && map.has(message.chatId)) map.get(message.chatId).unread += 1;
  return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
  puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] },
});

client.on("qr", (qr) => {
  state = { ...state, status: "qr", connected: false, qr, pairingCode: null, error: null };
  console.log("\nWhatsApp QR code ready — scan it from Linked Devices.\n");
  qrcode.generate(qr, { small: true });
});
client.on("authenticated", () => { state = { ...state, status: "authenticated", qr: null, pairingCode: null, error: null }; console.log("WhatsApp authenticated."); });
client.on("ready", async () => {
  const info = client.info;
  state = { ...state, status: "connected", connected: true, qr: null, pairingCode: null, phone: info?.wid?.user || null, name: info?.pushname || null, error: null };
  console.log(`WhatsApp connected${state.phone ? `: ${state.phone}` : ""}`);
  await syncHistory();
});
client.on("message_create", captureMessage);
client.on("auth_failure", (message) => { state = { ...state, status: "error", connected: false, error: String(message), qr: null }; console.error("WhatsApp authentication failed:", message); });
client.on("disconnected", (reason) => { state = { ...state, status: "disconnected", connected: false, qr: null, pairingCode: null, error: String(reason || "Disconnected") }; console.log("WhatsApp disconnected:", reason); });
client.on("change_state", (next) => { if (!state.connected) state = { ...state, status: String(next).toLowerCase() }; });

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) return writeJson(res, 401, { error: "Unauthorized" });
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/status") {
    const chatId = url.searchParams.get("chatId");
    if (chatId) {
      const selected = messages.filter((message) => message.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp);
      let changed = false;
      for (const message of selected) if (!message.fromMe && !message.read) { message.read = true; changed = true; }
      if (changed) saveMessages();
      return writeJson(res, 200, { ...state, messages: selected });
    }
    return writeJson(res, 200, { ...state, conversations: conversations() });
  }

  if (req.method === "GET" && url.pathname === "/messages") {
    const chatId = url.searchParams.get("chatId");
    if (!chatId) return writeJson(res, 200, { conversations: conversations() });
    const selected = messages.filter((message) => message.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp);
    let changed = false;
    for (const message of selected) if (!message.fromMe && !message.read) { message.read = true; changed = true; }
    if (changed) saveMessages();
    return writeJson(res, 200, { messages: selected });
  }

  if (req.method === "POST" && url.pathname === "/send") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body || "{}");
    const chatId = String(payload.chatId || "").trim();
    const text = String(payload.body || "").trim();
    if (!client.info?.wid) return writeJson(res, 409, { error: "WhatsApp is not connected." });
    if (!chatId || !text) return writeJson(res, 400, { error: "Chat and message are required." });
    if (text.length > 4096) return writeJson(res, 400, { error: "Message is too long." });
    try {
      const sent = await client.sendMessage(chatId, text);
      await captureMessage(sent);
      return writeJson(res, 200, { ok: true, id: sent?.id?._serialized || null });
    } catch (error) { return writeJson(res, 400, { error: error instanceof Error ? error.message : "Could not send message." }); }
  }

  if (req.method === "POST" && url.pathname === "/pairing-code") {
    let body = ""; for await (const chunk of req) body += chunk;
    let phone;
    try { phone = JSON.parse(body || "{}").phoneNumber; } catch { return writeJson(res, 400, { error: "Invalid JSON." }); }
    const clean = cleanPhone(phone);
    if (!/^\d{8,15}$/.test(clean)) return writeJson(res, 400, { error: "Enter a valid international mobile number." });
    try {
      if (client.info?.wid) return writeJson(res, 409, { error: "WhatsApp is already connected." });
      state = { ...state, status: "pairing", pairingCode: null, qr: null, phone: clean, error: null };
      const code = await client.requestPairingCode(clean);
      state = { ...state, status: "pairing", pairingCode: String(code).toUpperCase() };
      return writeJson(res, 200, { ok: true, code: state.pairingCode });
    } catch (error) { state = { ...state, status: "error", error: error instanceof Error ? error.message : "Could not create pairing code." }; return writeJson(res, 400, { error: state.error }); }
  }

  if (req.method === "POST" && url.pathname === "/logout") {
    try { await client.logout(); state = { status: "logged_out", connected: false, qr: null, pairingCode: null, phone: null, name: null, error: null }; return writeJson(res, 200, { ok: true }); }
    catch (error) { return writeJson(res, 400, { error: error instanceof Error ? error.message : "Could not disconnect." }); }
  }
  return writeJson(res, 404, { error: "Not found." });
});

server.listen(PORT, HOST, () => {
  console.log(`LaaWa WhatsApp worker listening on http://${HOST}:${PORT}`);
  client.initialize().catch((error) => { state = { ...state, status: "error", error: error instanceof Error ? error.message : String(error) }; console.error("WhatsApp initialization failed:", error); });
});
