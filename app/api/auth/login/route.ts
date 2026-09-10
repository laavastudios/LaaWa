import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const COOKIE = "laawa_session";

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = process.env.LAAWA_OWNER_USERNAME;
  const password = process.env.LAAWA_OWNER_PASSWORD;
  const secret = process.env.LAAWA_SESSION_SECRET;

  if (!username || !password || !secret) {
    return NextResponse.json({ error: "Owner credentials are not configured. Add LAAWA_OWNER_USERNAME, LAAWA_OWNER_PASSWORD and LAAWA_SESSION_SECRET." }, { status: 503 });
  }

  if (body?.username !== username || body?.password !== password) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = `${username}.${Date.now()}`;
  const signature = sign(token, secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, `${token}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}

export function verifySession(cookie: string | undefined) {
  const secret = process.env.LAAWA_SESSION_SECRET;
  if (!secret || !cookie) return false;
  const parts = cookie.split(".");
  if (parts.length < 3) return false;
  const signature = parts.pop()!;
  const token = parts.join(".");
  const expected = sign(token, secret);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
