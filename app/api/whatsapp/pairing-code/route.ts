import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../auth/login/route";

const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { phoneNumber?: string } | null;
  if (!body?.phoneNumber?.trim()) return NextResponse.json({ error: "Phone number is required." }, { status: 400 });

  try {
    const response = await fetch(`${workerUrl}/pairing-code`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.WHATSAPP_WORKER_SECRET ? { Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` } : {}),
      },
      body: JSON.stringify({ phoneNumber: body.phoneNumber }),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "WhatsApp worker is not running." }, { status: 503 });
  }
}
