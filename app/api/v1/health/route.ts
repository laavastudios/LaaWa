import { NextRequest } from "next/server";
import { apiSuccess, getRequestId } from "../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  return apiSuccess(
    {
      status: "healthy",
      service: "laawa",
      version: "v1",
      timestamp: new Date().toISOString(),
    },
    { requestId, headers: { "Cache-Control": "no-store" } },
  );
}
