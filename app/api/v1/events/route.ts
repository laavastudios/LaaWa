import { NextRequest } from "next/server";
import { apiError, requireApiAuth, API_SCOPES } from "../../../../lib/api";
import { accountFor } from "../../../../lib/api-messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, API_SCOPES.read);
  if ("response" in auth) return auth.response;

  const accountId = new URL(request.url).searchParams.get("accountId")?.trim() || "";
  if (!accountId) return apiError({ status: 400, code: "INVALID_REQUEST", message: "accountId is required.", requestId: auth.requestId });

  const account = await accountFor(auth.principal, accountId);
  if (!account) return apiError({ status: 404, code: "ACCOUNT_NOT_FOUND", message: "WhatsApp account not found or not permitted for this API key.", requestId: auth.requestId });

  const workerUrl = process.env.WHATSAPP_WORKER_URL || "http://127.0.0.1:3010";
  const managerUrl = process.env.WHATSAPP_MANAGER_URL || "";
  const base = managerUrl ? `${managerUrl}/accounts/${encodeURIComponent(account.session_key)}` : workerUrl;
  const secret = process.env.WHATSAPP_WORKER_SECRET;

  try {
    const upstream = await fetch(`${base}/events`, {
      cache: "no-store",
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) return apiError({ status: upstream.status || 503, code: "WORKER_UNAVAILABLE", message: "Realtime event stream is unavailable.", requestId: auth.requestId });

    const headers = new Headers({
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-request-id": auth.requestId,
      "x-laawa-api-version": "v1",
    });
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return apiError({ status: 503, code: "WORKER_UNAVAILABLE", message: "Realtime event stream is unavailable.", requestId: auth.requestId });
  }
}
