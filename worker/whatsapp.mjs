import http from "node:http";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;

const PORT = Number(process.env.WHATSAPP_WORKER_PORT || 3010);
const SECRET = process.env.WHATSAPP_WORKER_SECRET || "";

let state = { status: "starting", qr: null, pairingCode: null, phone: null, name: null, error: null };

function authorized(req) {
  return !SECRET || req.headers.authorization === `Bearer ${SECRET}`;
}

function writeJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: process.env.WHATSAPP_AUTH_PATH || "./.whatsapp-session" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
});

client.on("qr", (qr) => {
  state = { ...state, status: "qr", qr, pairingCode: null, error: null };
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  state = { ...state, status: "authenticated", qr: null, pairingCode: null, error: null };
});

client.on("ready", async () => {
  const info = client.info;
  state = { ...state, status: "connected", qr: null, pairingCode: null, phone: info?.wid?.user || null, name: info?.pushname || null, error: null };
});

client.on("auth_failure", (message) => {
  state = { ...state, status: "error", error: message, qr: null, pairingCode: null };
});

client.on("disconnected", (reason) => {
  state = { ...state, status: "disconnected", qr: null, pairingCode: null, error: String(reason || "Disconnected") };
});

client.on("change_state", (next) => {
  if (state.status !== "connected") state = { ...state, status: String(next).toLowerCase() };
});

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) return writeJson(res, 401, { error: "Unauthorized" });

  if (req.method === "GET" && req.url === "/status") {
    return writeJson(res, 200, { ...state, qr: state.qr, connected: state.status === "connected" });
  }

  if (req.method === "POST" && req.url === "/pairing-code") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let phoneNumber;
    try { phoneNumber = JSON.parse(body || "{}").phoneNumber; } catch { return writeJson(res, 400, { error: "Invalid JSON." }); }
    const clean = String(phoneNumber || "").replace(/\D/g, "");
    if (!clean) return writeJson(res, 400, { error: "Phone number is required." });
    try {
      const code = await client.requestPairingCode(clean);
      state = { ...state, status: "pairing", pairingCode: code, qr: null, phone: clean, error: null };
      return writeJson(res, 200, { ok: true, code });
    } catch (error) {
      state = { ...state, status: "error", error: error instanceof Error ? error.message : "Could not create pairing code." };
      return writeJson(res, 400, { error: state.error });
    }
  }

  if (req.method === "POST" && req.url === "/logout") {
    try {
      await client.logout();
      state = { status: "disconnected", qr: null, pairingCode: null, phone: null, name: null, error: null };
      return writeJson(res, 200, { ok: true });
    } catch (error) {
      return writeJson(res, 400, { error: error instanceof Error ? error.message : "Could not disconnect." });
    }
  }

  return writeJson(res, 404, { error: "Not found." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`LaaWa WhatsApp worker listening on http://127.0.0.1:${PORT}`);
  client.initialize().catch((error) => {
    state = { ...state, status: "error", error: error instanceof Error ? error.message : String(error) };
  });
});
