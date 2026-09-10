import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";
import { decryptSecret, encryptSecret, GEMINI_COOKIE } from "@/lib/secret-store";

function authorized(store: Awaited<ReturnType<typeof cookies>>) {
  return verifySession(store.get("laawa_session")?.value);
}

function mask(key: string) {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

async function verifyGemini(apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: "Reply with exactly: LaaWa OK",
  });
  return Boolean(result.text?.trim());
}

export async function GET() {
  const store = await cookies();
  if (!authorized(store)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const saved = decryptSecret(store.get(GEMINI_COOKIE)?.value || "");
  const fallback = process.env.GEMINI_API_KEY || "";
  const active = saved || fallback;
  return NextResponse.json({ configured: Boolean(active), source: saved ? "dashboard" : fallback ? "environment" : null, maskedKey: active ? mask(active) : null });
}

export async function POST(request: Request) {
  const store = await cookies();
  if (!authorized(store)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { apiKey?: string } | null;
  const apiKey = body?.apiKey?.trim();
  if (!apiKey) return NextResponse.json({ error: "Gemini API key is required." }, { status: 400 });
  try {
    await verifyGemini(apiKey);
    const response = NextResponse.json({ ok: true, configured: true, maskedKey: mask(apiKey), message: "Gemini API key is valid and has been saved." });
    response.cookies.set(GEMINI_COOKIE, encryptSecret(apiKey), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini rejected the request.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const store = await cookies();
  if (!authorized(store)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const response = NextResponse.json({ ok: true, message: "Dashboard Gemini key removed." });
  response.cookies.set(GEMINI_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
