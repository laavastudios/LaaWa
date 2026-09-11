import { NextResponse } from "next/server";
import { isDatabaseConfigured, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "not_configured" | "error" = "not_configured";

  if (isDatabaseConfigured()) {
    try {
      await query("SELECT 1");
      database = "ok";
    } catch {
      database = "error";
    }
  }

  const healthy = database !== "error";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "laawa-web",
      database,
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
