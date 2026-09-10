import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";
const workerHeaders = process.env.WHATSAPP_WORKER_SECRET ? { Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` } : {};

export async function GET() {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const upstream = await fetch(`${workerUrl}/events`, { cache: "no-store", headers: workerHeaders });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "WhatsApp live stream unavailable." }, { status: 503 });
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-store, must-revalidate",
        "connection": "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ error: "WhatsApp worker is not running." }, { status: 503 });
  }
}
