import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "../../auth/login/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const managerUrl = process.env.WHATSAPP_MANAGER_URL || "http://127.0.0.1:3020";
const headers = (): Record<string, string> => process.env.WHATSAPP_WORKER_SECRET
  ? { Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` }
  : {};

async function manager(path: string, init: RequestInit = {}) {
  const requestHeaders: Record<string, string> = { ...headers() };
  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => { requestHeaders[key] = value; });
  } else if (Array.isArray(init.headers)) {
    for (const [key, value] of init.headers) requestHeaders[key] = value;
  } else if (init.headers) {
    Object.assign(requestHeaders, init.headers);
  }
  return fetch(`${managerUrl}${path}`, { ...init, cache: "no-store", headers: requestHeaders });
}
export async function GET() {
  const store = await cookies(); if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const response = await manager("/accounts"); return NextResponse.json(await response.json(), { status: response.status }); }
  catch { return NextResponse.json({ error: "Multi-WhatsApp manager is not running." }, { status: 503 }); }
}
export async function POST(request: Request) {
  const store = await cookies(); if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const body = await request.json(); const response = await manager("/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return NextResponse.json(await response.json(), { status: response.status }); }
  catch { return NextResponse.json({ error: "Multi-WhatsApp manager is not running." }, { status: 503 }); }
}
export async function PATCH(request: Request) {
  const store = await cookies(); if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json(); const id = encodeURIComponent(String(body.id || "")); const action = body.action === "stop" ? "stop" : "restart";
    if (!id) return NextResponse.json({ error: "Account id is required." }, { status: 400 });
    const response = await manager(`/accounts/${id}/${action}`, { method: "POST" }); return NextResponse.json(await response.json(), { status: response.status });
  } catch { return NextResponse.json({ error: "Multi-WhatsApp manager is not running." }, { status: 503 }); }
}
export async function DELETE(request: Request) {
  const store = await cookies(); if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = encodeURIComponent(new URL(request.url).searchParams.get("id") || ""); if (!id) return NextResponse.json({ error: "Account id is required." }, { status: 400 });
    const response = await manager(`/accounts/${id}`, { method: "DELETE" }); return NextResponse.json(await response.json(), { status: response.status });
  } catch { return NextResponse.json({ error: "Multi-WhatsApp manager is not running." }, { status: 503 }); }
}
