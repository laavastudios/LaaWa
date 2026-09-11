import { NextRequest } from "next/server";
import { apiError, requireApiAuth, API_SCOPES } from "../../../../lib/api";
import { accountFor } from "../../../../lib/api-messaging";
import { getWhatsAppEngineUrl } from "../../../../lib/whatsapp/engines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, API_SCOPES.read);
  if ("response" in auth) return auth.response;

  const accountId = new URL(request.url).searchParams.get("accountId")?.trim() || "";
  if (!accountId) return apiError({ status: 400, code: "INVALID_REQUEST", message: "accountId is required.", requestId: auth.requestId });

  const account = await accountFor(auth.principal, accountId);
  if (!account) return apiError({ status: 404, code: "ACCOUNT_NOT_FOUND", message: "WhatsApp account not found or not permitted for this API key.", requestId: auth.requestId });

  const engineBase = getWhatsAppEngineUrl(account.engine);
  if (!engineBase) return apiError({ status: 503, code: "ENGINE_NOT_CONFIGURED", message: `${account.engine} realtime engine is not configured.`, requestId: auth.requestId });

  const isManager = account.engine === "whatsapp-web.js" && Boolean(process.env.WHATSAPP_MANAGER_URL);
  const base = isManager
    ? `${process.env.WHATSAPP_MANAGER_URL}/accounts/${encodeURIComponent(account.session_key)}`
    : account.engine === "whatsapp-web.js"
      ? engineBase.replace(/\/$/, "")
      : `${engineBase.replace(/\/$/, "")}/accounts/${encodeURIComponent(account.session_key)}`;
  const secret = process.env.WHATSAPP_WORKER_SECRET;

  try {
    const upstream = await fetch(`${base}/events`, {
      cache: "no-store",
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) return apiError({ status: upstream.status || 503, code: "ENGINE_UNAVAILABLE", message: `${account.engineDescriptor.label} realtime stream is unavailable.`, requestId: auth.requestId });

    const headers = new Headers({
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-request-id": auth.requestId,
      "x-laawa-api-version": "v1",
      "x-laawa-engine": account.engine,
    });
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return apiError({ status: 503, code: "ENGINE_UNAVAILABLE", message: `${account.engineDescriptor.label} realtime stream is unavailable.`, requestId: auth.requestId });
  }
}
