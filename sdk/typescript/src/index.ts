export type LaaWaError = { code?: string; message: string; details?: unknown };
export type MessageInput = { accountId?: string; conversationId?: string; chatId?: string; text?: string; body?: string; action?: "send" | "location" | "contact" | "reply" | "react" | "read"; messageId?: string; reaction?: string; latitude?: number; longitude?: number; description?: string; phone?: string; name?: string; vcard?: string; media?: Record<string, unknown> };
export type RequestOptions = { signal?: AbortSignal };

export class LaaWaApiError extends Error {
  readonly code?: string; readonly status: number; readonly details?: unknown;
  constructor(status: number, error: LaaWaError) { super(error.message); this.name = "LaaWaApiError"; this.status = status; this.code = error.code; this.details = error.details; }
}

export class LaaWaClient {
  private readonly baseUrl: string; private readonly apiKey: string;
  constructor(options: { baseUrl: string; apiKey: string }) { this.baseUrl = options.baseUrl.replace(/\/$/, ""); this.apiKey = options.apiKey; }
  private async request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: options.signal, headers: { Accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), Authorization: `Bearer ${this.apiKey}`, ...init.headers } });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new LaaWaApiError(response.status, body?.error || { message: "LaaWa API request failed." });
    return body.data as T;
  }
  health(options?: RequestOptions) { return this.request<{ status: string }>("/health", {}, options); }
  engines(options?: RequestOptions) { return this.request<{ default: string; engines: unknown[] }>("/engines", {}, options); }
  messages(params: { accountId: string; chatId: string }, options?: RequestOptions) { return this.request<unknown>(`/messages?${new URLSearchParams(params)}`, {}, options); }
  sendMessage(input: MessageInput, options?: RequestOptions) { return this.request<unknown>("/messages", { method: "POST", body: JSON.stringify({ ...input, action: input.action || "send" }) }, options); }
  async events(accountId: string, options: RequestOptions = {}) {
    const response = await fetch(`${this.baseUrl}/events?accountId=${encodeURIComponent(accountId)}`, { headers: { Accept: "text/event-stream", Authorization: `Bearer ${this.apiKey}` }, signal: options.signal });
    if (!response.ok || !response.body) throw new LaaWaApiError(response.status, { message: "Unable to open realtime stream." });
    return response.body;
  }
}
