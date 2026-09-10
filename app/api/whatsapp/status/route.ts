import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../auth/login/route";

const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";

export async function GET(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const requestUrl = new URL(request.url);
    const target = new URL("/status", workerUrl);
    const chatId = requestUrl.searchParams.get("chatId");
    if (chatId) target.searchParams.set("chatId", chatId);
    const response = await fetch(target, { cache: "no-store", headers: process.env.WHATSAPP_WORKER_SECRET ? { Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` } : undefined });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ status: "offline", connected: false, error: "WhatsApp worker is not running." }, { status: 503 });
  }
}
