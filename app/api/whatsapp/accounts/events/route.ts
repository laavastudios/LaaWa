import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../../auth/login/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const managerUrl = process.env.WHATSAPP_MANAGER_URL || "http://127.0.0.1:3020";

export async function GET() {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const upstream = await fetch(`${managerUrl}/events`, { cache: "no-store", headers: process.env.WHATSAPP_WORKER_SECRET ? { Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` } : undefined });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Multi-WhatsApp manager is unavailable." }, { status: 503 });
    return new Response(upstream.body, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate", connection: "keep-alive", "x-accel-buffering": "no" } });
  } catch { return NextResponse.json({ error: "Multi-WhatsApp manager is not running." }, { status: 503 }); }
}
