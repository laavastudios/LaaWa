import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { prompt?: string; systemInstruction?: string } | null;
  if (!body?.prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: body.prompt,
    config: body.systemInstruction ? { systemInstruction: body.systemInstruction } : undefined,
  });

  return NextResponse.json({ text: response.text ?? "" });
}
