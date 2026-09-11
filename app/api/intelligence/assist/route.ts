import { GoogleGenAI } from "@google/genai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";
import { isDatabaseConfigured, query } from "../../../../lib/db";
import { decryptSecret, GEMINI_COOKIE } from "../../../../lib/secret-store";
import { clientKey, rateLimit } from "../../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MessageRow = { direction: "inbound" | "outbound"; body: string | null; created_at: string };

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySession(store.get("laawa_session")?.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = rateLimit(`intelligence-assist:${clientKey(request)}`, 20);
  if (!limit.ok) return NextResponse.json({ error: "Too many copilot requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { conversationId?: string; task?: string } | null;
  if (!body?.conversationId?.trim()) return NextResponse.json({ error: "Conversation is required." }, { status: 400 });
  const task = body.task?.trim() || "Draft a concise, helpful reply to the latest customer message.";

  const workspace = await query<{ id: string }>("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1");
  const wid = workspace.rows[0]?.id;
  if (!wid) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  const conversation = await query<{ id: string; name: string | null; phone: string | null }>(
    `SELECT c.id, COALESCE(ct.name, ct.push_name) name, ct.phone
     FROM conversations c LEFT JOIN contacts ct ON ct.id=c.contact_id
     WHERE c.id=$1 AND c.workspace_id=$2 LIMIT 1`,
    [body.conversationId.trim(), wid]
  );
  if (!conversation.rows[0]) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const messages = await query<MessageRow>(
    `SELECT direction, body, created_at FROM messages
     WHERE conversation_id=$1 AND body IS NOT NULL
     ORDER BY created_at DESC LIMIT 40`,
    [conversation.rows[0].id]
  );
  if (!messages.rows.length) return NextResponse.json({ error: "No text messages are available for this conversation." }, { status: 422 });

  const transcript = [...messages.rows].reverse().map((m) => `[${m.direction}] ${m.body}`).join("\n");
  const apiKey = decryptSecret(store.get(GEMINI_COOKIE)?.value || "") || process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Connect a Gemini API key in Settings first." }, { status: 503 });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: `You are the conversation copilot for a WhatsApp business inbox. Analyze only the supplied transcript. Do not invent customer facts, promises, prices, policies, or context.\n\nTask: ${task}\n\nConversation with ${conversation.rows[0].name || conversation.rows[0].phone || "the customer"}:\n${transcript}`,
      config: {
        systemInstruction: "Return a practical answer for a business operator. If drafting a reply, write only the reply text unless the task asks for analysis. Keep it natural and concise.",
      },
    });
    return NextResponse.json({ text: response.text ?? "", conversationId: conversation.rows[0].id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gemini request failed." }, { status: 400 });
  }
}
