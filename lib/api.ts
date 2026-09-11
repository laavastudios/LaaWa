import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./auth/session";
import { authenticateApiKey } from "./api-keys";

export const API_VERSION = "v1" as const;
export const API_PREFIX = `/api/${API_VERSION}` as const;

export const API_SCOPES = {
  read: "read",
  write: "write",
  admin: "admin",
} as const;

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];

export type ApiPrincipal = {
  type: "session" | "api-key";
  id: string;
  scopes: readonly ApiScope[];
  workspaceId?: string;
  whatsappAccountIds?: readonly string[];
};

type ApiSuccessOptions = {
  status?: number;
  requestId?: string;
  headers?: HeadersInit;
};

type ApiErrorOptions = ApiSuccessOptions & {
  code: string;
  message: string;
  details?: unknown;
};

export function getRequestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  if (supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
}

function withRequestId(headers: HeadersInit | undefined, requestId: string) {
  const result = new Headers(headers);
  result.set("x-request-id", requestId);
  result.set("x-laawa-api-version", API_VERSION);
  result.set("Cache-Control", "no-store");
  return result;
}

export function apiSuccess<T>(data: T, options: ApiSuccessOptions = {}) {
  const requestId = options.requestId ?? crypto.randomUUID();
  return NextResponse.json(
    { ok: true, data, meta: { apiVersion: API_VERSION, requestId } },
    { status: options.status ?? 200, headers: withRequestId(options.headers, requestId) },
  );
}

export function apiError(options: ApiErrorOptions) {
  const requestId = options.requestId ?? crypto.randomUUID();
  return NextResponse.json(
    {
      ok: false,
      error: { code: options.code, message: options.message, ...(options.details === undefined ? {} : { details: options.details }) },
      meta: { apiVersion: API_VERSION, requestId },
    },
    { status: options.status ?? 500, headers: withRequestId(options.headers, requestId) },
  );
}

export async function authenticateApiRequest(request: NextRequest): Promise<ApiPrincipal | null> {
  const authorization = request.headers.get("authorization")?.trim();
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (bearer) {
    const principal = await authenticateApiKey(bearer);
    if (!principal) return null;
    return principal;
  }

  if (verifySession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return { type: "session", id: "owner-session", scopes: [API_SCOPES.read, API_SCOPES.write, API_SCOPES.admin] };
  }

  return null;
}

export function hasScope(principal: ApiPrincipal, required: ApiScope) {
  return principal.scopes.includes(API_SCOPES.admin) || principal.scopes.includes(required);
}

export async function requireApiAuth(
  request: NextRequest,
  requiredScope: ApiScope = API_SCOPES.read,
): Promise<{ principal: ApiPrincipal; requestId: string } | { response: NextResponse; requestId: string }> {
  const requestId = getRequestId(request);
  const principal = await authenticateApiRequest(request);

  if (!principal) {
    return { requestId, response: apiError({ status: 401, code: "AUTH_REQUIRED", message: "Authentication is required for this API resource.", requestId }) };
  }

  if (!hasScope(principal, requiredScope)) {
    return { requestId, response: apiError({ status: 403, code: "INSUFFICIENT_SCOPE", message: `The '${requiredScope}' scope is required for this resource.`, requestId }) };
  }

  return { principal, requestId };
}
