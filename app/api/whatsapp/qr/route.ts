import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../auth/login/route";
import QRCode from "qrcode";

const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";

export async function GET() {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await fetch(`${workerUrl}/status`, {
      cache: "no-store",
      headers: process.env.WHATSAPP_WORKER_SECRET ? { Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` } : undefined,
    });
    const data = await response.json();
    if (!data.qr) return NextResponse.json({ qr: null, status: data.status, connected: data.connected });
    return NextResponse.json({ qr: await QRCode.toDataURL(data.qr, { margin: 1, width: 320 }), status: data.status, connected: false });
  } catch {
    return NextResponse.json({ error: "WhatsApp worker is not running." }, { status: 503 });
  }
}
