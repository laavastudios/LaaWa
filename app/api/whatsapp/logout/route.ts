import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../auth/login/route";

const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";

export async function POST() {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await fetch(`${workerUrl}/logout`, {
      method: "POST",
      headers: process.env.WHATSAPP_WORKER_SECRET ? { Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` } : undefined,
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "WhatsApp worker is not running." }, { status: 503 });
  }
}
