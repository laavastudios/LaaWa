import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../auth/login/route";
import { persistWorkerMessages } from "../../../../lib/messaging";
import { evaluateAutomations } from "../../../../lib/automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";
const workerHeaders = (): Record<string, string> => { const secret = process.env.WHATSAPP_WORKER_SECRET; return secret ? { Authorization: `Bearer ${secret}` } : {}; };

export async function GET(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const target = new URL("/messages", workerUrl);
  const chatId = url.searchParams.get("chatId");
  if (chatId) target.searchParams.set("chatId", chatId);
  try {
    const response = await fetch(target, { cache: "no-store", headers: workerHeaders() });
    const data = await response.json();
    if (response.ok && Array.isArray(data.messages)) {
      try {
        await persistWorkerMessages(data.messages);
        for (const message of data.messages) await evaluateAutomations(message);
      } catch (error) { console.error("Automation evaluation skipped:", error instanceof Error ? error.message : String(error)); }
    }
    return NextResponse.json(data, { status: response.status });
  } catch { return NextResponse.json({ error: "WhatsApp worker is not running." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const contentType = request.headers.get("content-type") || "";
    let payload: { chatId?: string; body?: string; media?: { data: string; mimetype: string; filename: string; kind: string; voice?: boolean } } | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file selected." }, { status: 400 });
      if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "File is larger than 25 MB." }, { status: 413 });
      const bytes = Buffer.from(await file.arrayBuffer());
      payload = { chatId: String(form.get("chatId") || ""), body: String(form.get("body") || ""), media: { data: bytes.toString("base64"), mimetype: file.type || "application/octet-stream", filename: file.name || "file", kind: String(form.get("kind") || "document"), voice: String(form.get("voice") || "false") === "true" } };
    } else payload = await request.json().catch(() => null);
    if (!payload?.chatId?.trim() || (!payload.body?.trim() && !payload.media?.data)) return NextResponse.json({ error: "Chat and message are required." }, { status: 400 });
    const response = await fetch(`${workerUrl}/send`, { method: "POST", headers: { "content-type": "application/json", ...workerHeaders() }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (response.ok && payload.chatId) {
      try {
        const statusResponse = await fetch(`${workerUrl}/messages?chatId=${encodeURIComponent(payload.chatId)}`, { cache: "no-store", headers: workerHeaders() });
        const statusData = await statusResponse.json();
        if (statusResponse.ok && Array.isArray(statusData.messages)) await persistWorkerMessages(statusData.messages.slice(-1));
      } catch (error) { console.error("Sent message persistence skipped:", error instanceof Error ? error.message : String(error)); }
    }
    return NextResponse.json(data, { status: response.status });
  } catch { return NextResponse.json({ error: "WhatsApp worker is not running." }, { status: 503 }); }
}
