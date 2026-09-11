import { NextRequest } from "next/server";
import { apiError, apiSuccess, getRequestId } from "../../../lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  return apiSuccess(
    {
      name: "LaaWa API",
      version: "v1",
      status: "ready",
      capabilities: {
        authentication: "session + api-key",
        apiKeys: true,
        webhooks: true,
        realtime: "coming-soon",
      },
    },
    { requestId },
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  return apiError({
    status: 405,
    code: "METHOD_NOT_ALLOWED",
    message: "This API root is read-only.",
    requestId,
    headers: { Allow: "GET" },
  });
}
