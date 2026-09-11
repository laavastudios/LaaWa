import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";
import { decryptSecret, GEMINI_COOKIE } from "@/lib/secret-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dashboardKey = decryptSecret(store.get(GEMINI_COOKIE)?.value || "");
  const apiKey = dashboardKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Connect a Gemini API key in Settings first." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { prompt?: string; systemInstruction?: string } | null;
  if (!body?.prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: body.prompt.trim(),
      config: body.systemInstruction?.trim() ? { systemInstruction: body.systemInstruction.trim() } : undefined,
    });
    return NextResponse.json({ text: response.text ?? "" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gemini request failed." }, { status: 400 });
  }
}
