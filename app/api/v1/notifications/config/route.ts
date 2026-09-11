import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || null;
  return apiSuccess({ browserPushConfigured: Boolean(publicKey), vapidPublicKey: publicKey }, { requestId: auth.requestId });
}
