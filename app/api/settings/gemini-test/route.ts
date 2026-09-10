import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = String(body?.apiKey ?? "").trim();

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Enter a Gemini API key." }, { status: 400 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with exactly: LaaWa Gemini connection OK" }] }],
          generationConfig: { maxOutputTokens: 30 },
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message = data?.error?.message || `Gemini returned HTTP ${response.status}`;
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Gemini API key is working." });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not test the Gemini API key." }, { status: 500 });
  }
}
