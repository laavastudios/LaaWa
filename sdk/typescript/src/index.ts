export type LaaWaError = { code?: string; message: string; details?: unknown };
export type LaaWaResponse<T> = { ok: true; data: T; meta?: { apiVersion?: string; requestId?: string } };
export type MessageInput = { accountId?: string; conversationId?: string; chatId?: string; text?: string; body?: string; action?: "send" | "location" | "contact" | "reply" | "react" | "read"; messageId?: string; reaction?: string; latitude?: number; longitude?: number; description?: string; phone?: string; name?: string; vcard?: string; media?: Record<string, unknown> };
export type RequestOptions = { signal?: AbortSignal };

export class LaaWaApiError extends Error {
  readonly code?: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(status: number, error: LaaWaError) { super(error.message); this.name = "LaaWaApiError"; this.status = status; this.code = error.code; this.details = error.details; }
}

export class LaaWaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  constructor(options: { baseUrl: string; apiKey: string }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }
  private async request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: options.signal, headers: { Accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), Authorization: `Bearer ${this.apiKey}`, ...init.headers } });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new LaaWaApiError(response.status, body?.error || { message: "LaaWa API request failed." });
    return body.data as T;
  }
  health(options?: RequestOptions) { return this.request<{ status: string }>("/health", {}, options); }
  engines(options?: RequestOptions) { return this.request<{ default: string; engines: unknown[] }>("/engines", {}, options); }
  messages(params: { accountId: string; chatId: string }, options?: RequestOptions) { const q = new URLSearchParams(params); return this.request<unknown>(`/messages?${q}`, {}, options); }
  sendMessage(input: MessageInput, options?: RequestOptions) { return this.request<unknown>("/messages", { method: "POST", body: JSON.stringify({ ...input, action: input.action || "send" }) }, options); }
  events(accountId: string, options?: { onEvent?: (event: MessageEvent<string>) => void; signal?: AbortSignal }) {
    if (typeof EventSource === "undefined") throw new Error("EventSource is not available in this runtime.");
    const url = new URL(`${this.baseUrl}/events`); url.searchParams.set("accountId", accountId);
    const source = new EventSource(url.toString());
    if (options?.onEvent) source.onmessage = options.onEvent;
    if (options?.signal) options.signal.addEventListener("abort", () => source.close(), { once: true });
    return source;
  }
}
