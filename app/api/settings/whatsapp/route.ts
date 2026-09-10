import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../../auth/login/route";
import { decryptSecret, encryptSecret } from "@/lib/secret-store";

const TOKEN_COOKIE = "laawa_whatsapp_token";
const PHONE_COOKIE = "laawa_whatsapp_phone";
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

function authorized(store: Awaited<ReturnType<typeof cookies>>) {
  return verifySession(store.get("laawa_session")?.value);
}

function mask(value: string) {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

async function checkWhatsApp(phoneNumberId: string, accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || "WhatsApp rejected the connection details.";
    throw new Error(message);
  }
  return data as { display_phone_number?: string; verified_name?: string };
}

export async function GET() {
  const store = await cookies();
  if (!authorized(store)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = decryptSecret(store.get(TOKEN_COOKIE)?.value || "");
  const phoneNumberId = decryptSecret(store.get(PHONE_COOKIE)?.value || "");
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const activeToken = token || envToken;
  const activePhone = phoneNumberId || envPhone;

  return NextResponse.json({
    configured: Boolean(activeToken && activePhone),
    source: token && phoneNumberId ? "dashboard" : activeToken && activePhone ? "environment" : null,
    phoneNumberId: activePhone ? mask(activePhone) : null,
  });
}

export async function POST(request: Request) {
  const store = await cookies();
  if (!authorized(store)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { accessToken?: string; phoneNumberId?: string } | null;
  const accessToken = body?.accessToken?.trim();
  const phoneNumberId = body?.phoneNumberId?.trim();

  if (!accessToken || !phoneNumberId) {
    return NextResponse.json({ error: "WhatsApp access token and phone number ID are required." }, { status: 400 });
  }

  try {
    const account = await checkWhatsApp(phoneNumberId, accessToken);
    const response = NextResponse.json({
      ok: true,
      configured: true,
      phoneNumberId: mask(phoneNumberId),
      displayPhoneNumber: account.display_phone_number || null,
      verifiedName: account.verified_name || null,
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    };

    response.cookies.set(TOKEN_COOKIE, encryptSecret(accessToken), cookieOptions);
    response.cookies.set(PHONE_COOKIE, encryptSecret(phoneNumberId), cookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "WhatsApp connection failed." }, { status: 400 });
  }
}

export async function DELETE() {
  const store = await cookies();
  if (!authorized(store)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  const expired = { httpOnly: true, expires: new Date(0), path: "/" };
  response.cookies.set(TOKEN_COOKIE, "", expired);
  response.cookies.set(PHONE_COOKIE, "", expired);
  return response;
}
