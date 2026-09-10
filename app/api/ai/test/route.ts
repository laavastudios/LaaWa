import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { apiKey?: string } | null;
  const apiKey = body?.apiKey?.trim();
  if (!apiKey) return NextResponse.json({ error: "API key is required." }, { status: 400 });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({ model: process.env.GEMINI_MODEL || "gemini-3.8-flash", contents: "Reply exactly: LaaWa OK" });
    return NextResponse.json({ ok: Boolean(result.text?.trim()), response: result.text?.trim() || "No response" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gemini request failed." }, { status: 400 });
  }
}
