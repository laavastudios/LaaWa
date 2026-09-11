import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../lib/api";
import { createApiKey, listApiKeys } from "../../../../lib/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedScopes = new Set(["read", "write", "admin"]);

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;

  try {
    return apiSuccess(await listApiKeys(), { requestId: auth.requestId });
  } catch {
    return apiError({ status: 500, code: "KEYS_LIST_FAILED", message: "Unable to load API keys.", requestId: auth.requestId });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    scopes?: unknown;
    whatsappAccountIds?: unknown;
    expiresAt?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const scopes = Array.isArray(body?.scopes) ? body.scopes.filter((scope): scope is string => typeof scope === "string") : [];
  const accountIds = Array.isArray(body?.whatsappAccountIds)
    ? body.whatsappAccountIds.filter((id): id is string => typeof id === "string" && validUuid(id))
    : [];

  if (name.length < 2 || name.length > 80) {
    return apiError({ status: 400, code: "INVALID_NAME", message: "API key name must be between 2 and 80 characters.", requestId: auth.requestId });
  }
  if (!scopes.length || scopes.some((scope) => !allowedScopes.has(scope))) {
    return apiError({ status: 400, code: "INVALID_SCOPES", message: "Use one or more supported scopes: read, write, admin.", requestId: auth.requestId });
  }
  if (scopes.includes("admin") && !scopes.includes("read")) scopes.push("read");
  if (scopes.includes("write") && !scopes.includes("read")) scopes.push("read");

  let expiresAt: string | null = null;
  if (body?.expiresAt !== undefined && body?.expiresAt !== null && body.expiresAt !== "") {
    if (typeof body.expiresAt !== "string" || Number.isNaN(Date.parse(body.expiresAt)) || new Date(body.expiresAt).getTime() <= Date.now()) {
      return apiError({ status: 400, code: "INVALID_EXPIRATION", message: "Expiration must be a valid future date.", requestId: auth.requestId });
    }
    expiresAt = new Date(body.expiresAt).toISOString();
  }

  try {
    const created = await createApiKey({ name, scopes: scopes as ("read" | "write" | "admin")[], whatsappAccountIds: accountIds, expiresAt });
    return apiSuccess(created, { status: 201, requestId: auth.requestId });
  } catch {
    return apiError({ status: 500, code: "KEY_CREATE_FAILED", message: "Unable to create the API key.", requestId: auth.requestId });
  }
}
