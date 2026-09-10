import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "LaaWa", timestamp: new Date().toISOString() });
}
