import http from "node:http";
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;
const PORT = Number(process.env.WHATSAPP_WORKER_PORT || process.env.PORT || 3010);
const HOST = process.env.WHATSAPP_WORKER_HOST || "127.0.0.1";
const SECRET = process.env.WHATSAPP_WORKER_SECRET || "";
const AUTH_PATH = process.env.WHATSAPP_AUTH_PATH || "./.whatsapp-session";

let state = {
  status: "starting",
  connected: false,
  qr: null,
  pairingCode: null,
  phone: null,
  name: null,
  error: null,
};

function authorized(req) {
  return !SECRET || req.headers.authorization === `Bearer ${SECRET}`;
}

function writeJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
});

client.on("qr", (qr) => {
  state = { ...state, status: "qr", connected: false, qr, pairingCode: null, error: null };
  console.log("\nWhatsApp QR code ready — scan it from Linked Devices.\n");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  state = { ...state, status: "authenticated", qr: null, pairingCode: null, error: null };
  console.log("WhatsApp authenticated.");
});

client.on("ready", () => {
  const info = client.info;
  state = {
    ...state,
    status: "connected",
    connected: true,
    qr: null,
    pairingCode: null,
    phone: info?.wid?.user || null,
    name: info?.pushname || null,
    error: null,
  };
  console.log(`WhatsApp connected${state.phone ? `: ${state.phone}` : ""}`);
});

client.on("auth_failure", (message) => {
  state = { ...state, status: "error", connected: false, error: String(message), qr: null };
  console.error("WhatsApp authentication failed:", message);
});

client.on("disconnected", (reason) => {
  state = {
    ...state,
    status: "disconnected",
    connected: false,
    qr: null,
    pairingCode: null,
    error: String(reason || "Disconnected"),
  };
  console.log("WhatsApp disconnected:", reason);
});

client.on("change_state", (next) => {
  if (!state.connected) state = { ...state, status: String(next).toLowerCase() };
});

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) return writeJson(res, 401, { error: "Unauthorized" });

  if (req.method === "GET" && req.url === "/status") {
    return writeJson(res, 200, state);
  }

  if (req.method === "POST" && req.url === "/pairing-code") {
    let body = "";
    for await (const chunk of req) body += chunk;

    let phone;
    try {
      phone = JSON.parse(body || "{}").phoneNumber;
    } catch {
      return writeJson(res, 400, { error: "Invalid JSON." });
    }

    const clean = cleanPhone(phone);
    if (!/^\d{8,15}$/.test(clean)) {
      return writeJson(res, 400, { error: "Enter a valid international mobile number." });
    }

    try {
      if (client.info?.wid) return writeJson(res, 409, { error: "WhatsApp is already connected." });
      state = { ...state, status: "pairing", pairingCode: null, qr: null, phone: clean, error: null };
      const code = await client.requestPairingCode(clean);
      state = { ...state, status: "pairing", pairingCode: String(code).toUpperCase() };
      return writeJson(res, 200, { ok: true, code: state.pairingCode });
    } catch (error) {
      state = { ...state, status: "error", error: error instanceof Error ? error.message : "Could not create pairing code." };
      return writeJson(res, 400, { error: state.error });
    }
  }

  if (req.method === "POST" && req.url === "/logout") {
    try {
      await client.logout();
      state = { status: "logged_out", connected: false, qr: null, pairingCode: null, phone: null, name: null, error: null };
      return writeJson(res, 200, { ok: true });
    } catch (error) {
      return writeJson(res, 400, { error: error instanceof Error ? error.message : "Could not disconnect." });
    }
  }

  return writeJson(res, 404, { error: "Not found." });
});

server.listen(PORT, HOST, () => {
  console.log(`LaaWa WhatsApp worker listening on http://${HOST}:${PORT}`);
  client.initialize().catch((error) => {
    state = { ...state, status: "error", error: error instanceof Error ? error.message : String(error) };
    console.error("WhatsApp initialization failed:", error);
  });
});
