import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../../lib/api";
import { revokeApiKey } from "../../../../../lib/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return apiError({ status: 400, code: "INVALID_KEY_ID", message: "Invalid API key identifier.", requestId: auth.requestId });
  }

  try {
    const revoked = await revokeApiKey(id);
    if (!revoked) return apiError({ status: 404, code: "KEY_NOT_FOUND", message: "API key not found.", requestId: auth.requestId });
    return apiSuccess({ revoked: true, id }, { requestId: auth.requestId });
  } catch {
    return apiError({ status: 500, code: "KEY_REVOKE_FAILED", message: "Unable to revoke the API key.", requestId: auth.requestId });
  }
}
