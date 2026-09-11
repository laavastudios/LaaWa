export type WhatsAppEngineId = "whatsapp-web.js" | "baileys";

export type WhatsAppEngineCapabilities = {
  messaging: boolean;
  media: boolean;
  locations: boolean;
  groups: boolean;
  history: boolean;
  realtime: boolean;
  reactions: boolean;
};

export type WhatsAppEngineDescriptor = {
  id: WhatsAppEngineId;
  label: string;
  version: string;
  mode: "local" | "remote-adapter";
  configured: boolean;
  default: boolean;
  capabilities: WhatsAppEngineCapabilities;
};

const WEB_JS_CAPABILITIES: WhatsAppEngineCapabilities = {
  messaging: true,
  media: true,
  locations: true,
  groups: true,
  history: true,
  realtime: true,
  reactions: true,
};

const BAILEYS_CAPABILITIES: WhatsAppEngineCapabilities = {
  messaging: true,
  media: true,
  locations: true,
  groups: true,
  history: true,
  realtime: true,
  reactions: true,
};

export const WHATSAPP_ENGINES: readonly WhatsAppEngineDescriptor[] = [
  {
    id: "whatsapp-web.js",
    label: "WhatsApp Web.js",
    version: "1.34",
    mode: "local",
    configured: true,
    default: true,
    capabilities: WEB_JS_CAPABILITIES,
  },
  {
    id: "baileys",
    label: "Baileys",
    version: "7.x",
    mode: "remote-adapter",
    configured: Boolean(process.env.BAILEYS_WORKER_URL),
    default: false,
    capabilities: BAILEYS_CAPABILITIES,
  },
];

export function isWhatsAppEngineId(value: unknown): value is WhatsAppEngineId {
  return value === "whatsapp-web.js" || value === "baileys";
}

export function normalizeWhatsAppEngine(value: unknown): WhatsAppEngineId {
  return isWhatsAppEngineId(value) ? value : "whatsapp-web.js";
}

export function getWhatsAppEngine(id: unknown): WhatsAppEngineDescriptor {
  const normalized = normalizeWhatsAppEngine(id);
  return WHATSAPP_ENGINES.find((engine) => engine.id === normalized) || WHATSAPP_ENGINES[0];
}

export function getWhatsAppEngineUrl(id: WhatsAppEngineId): string | null {
  if (id === "whatsapp-web.js") return process.env.WHATSAPP_WORKER_URL || process.env.WHATSAPP_MANAGER_URL || "http://127.0.0.1:3010";
  return process.env.BAILEYS_WORKER_URL || null;
}
