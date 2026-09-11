import { NextRequest } from "next/server";
import { apiSuccess, getRequestId, requireApiAuth } from "../../../../../lib/api";
import { WHATSAPP_ENGINES } from "../../../../../lib/whatsapp/engines";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const principal = await requireApiAuth(request, "read");
  if (!principal.ok) return principal.response;

  return apiSuccess(
    {
      default: "whatsapp-web.js",
      engines: WHATSAPP_ENGINES,
    },
    { requestId },
  );
}
