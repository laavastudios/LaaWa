import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "../login/route";

export async function GET() {
  const store = await cookies();
  return NextResponse.json({ authenticated: verifySession(store.get("laawa_session")?.value) });
}
