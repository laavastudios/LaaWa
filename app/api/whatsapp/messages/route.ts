import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../auth/login/route";

const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";
const headers = () => process.env.WHATSAPP_WORKER_SECRET ? { Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` } : undefined;

export async function GET(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const target = new URL("/messages", workerUrl);
  const chatId = url.searchParams.get("chatId");
  if (chatId) target.searchParams.set("chatId", chatId);
  try {
    const response = await fetch(target, { cache: "no-store", headers: headers() });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "WhatsApp worker is not running." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { chatId?: string; body?: string } | null;
  if (!body?.chatId?.trim() || !body.body?.trim()) return NextResponse.json({ error: "Chat and message are required." }, { status: 400 });
  try {
    const response = await fetch(`${workerUrl}/send`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(headers() || {}) },
      body: JSON.stringify({ chatId: body.chatId, body: body.body }),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "WhatsApp worker is not running." }, { status: 503 });
  }
}
