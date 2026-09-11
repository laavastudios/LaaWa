import { NextRequest } from "next/server";
import { apiError, apiSuccess, requireApiAuth } from "../../../../lib/api";
import {
  eraseWorkspaceData,
  getPrivacyPolicy,
  getPrivacySummary,
  privacyWorkspace,
  runPrivacyRetention,
  updatePrivacyPolicy,
} from "../../../../lib/privacy";

export const runtime = "nodejs";

async function workspaceOrError(auth: Awaited<ReturnType<typeof requireApiAuth>>) {
  if ("response" in auth) return { workspaceId: null as string | null, response: auth.response };
  const workspaceId = await privacyWorkspace(auth.principal.workspaceId);
  if (!workspaceId) return { workspaceId: null as string | null, response: apiError({ status: 400, code: "WORKSPACE_REQUIRED", message: "No workspace is available.", requestId: auth.requestId }) };
  return { workspaceId, response: null };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request, "read");
  if ("response" in auth) return auth.response;
  const resolved = await workspaceOrError(auth);
  if (!resolved.workspaceId) return resolved.response;
  try {
    const [policy, summary] = await Promise.all([getPrivacyPolicy(resolved.workspaceId), getPrivacySummary(resolved.workspaceId)]);
    return apiSuccess({ policy, summary }, { requestId: auth.requestId });
  } catch (error) {
    return apiError({ status: 503, code: "PRIVACY_UNAVAILABLE", message: error instanceof Error ? error.message : "Privacy controls are unavailable.", requestId: auth.requestId });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const resolved = await workspaceOrError(auth);
  if (!resolved.workspaceId) return resolved.response;
  let body: { messageRetentionDays?: unknown; notificationRetentionDays?: unknown; auditLogRetentionDays?: unknown };
  try { body = await request.json(); } catch { return apiError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON.", requestId: auth.requestId }); }

  const input = {
    ...(body.messageRetentionDays === undefined ? {} : { messageRetentionDays: Number(body.messageRetentionDays) }),
    ...(body.notificationRetentionDays === undefined ? {} : { notificationRetentionDays: Number(body.notificationRetentionDays) }),
    ...(body.auditLogRetentionDays === undefined ? {} : { auditLogRetentionDays: Number(body.auditLogRetentionDays) }),
  };
  if (Object.values(input).some((value) => !Number.isInteger(value) || value < 0 || value > 3650)) {
    return apiError({ status: 400, code: "INVALID_RETENTION", message: "Retention values must be whole days from 0 to 3650. Use 0 to disable automatic cleanup for that data class.", requestId: auth.requestId });
  }
  try {
    const policy = await updatePrivacyPolicy(resolved.workspaceId, input);
    return apiSuccess(policy, { requestId: auth.requestId });
  } catch (error) {
    return apiError({ status: 400, code: "INVALID_RETENTION", message: error instanceof Error ? error.message : "Unable to update the privacy policy.", requestId: auth.requestId });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const resolved = await workspaceOrError(auth);
  if (!resolved.workspaceId) return resolved.response;
  let body: { action?: unknown; confirmation?: unknown };
  try { body = await request.json(); } catch { return apiError({ status: 400, code: "INVALID_JSON", message: "Request body must be valid JSON.", requestId: auth.requestId }); }

  if (body.action === "retention") {
    try {
      return apiSuccess(await runPrivacyRetention(resolved.workspaceId), { requestId: auth.requestId });
    } catch (error) {
      return apiError({ status: 503, code: "RETENTION_FAILED", message: error instanceof Error ? error.message : "Retention cleanup failed.", requestId: auth.requestId });
    }
  }

  if (body.action === "erase") {
    const summary = await getPrivacySummary(resolved.workspaceId);
    const expected = `ERASE ${summary.workspaceName}`;
    if (body.confirmation !== expected) {
      return apiError({ status: 400, code: "ERASURE_CONFIRMATION_REQUIRED", message: `Type '${expected}' exactly to erase workspace data.`, requestId: auth.requestId });
    }
    try {
      const result = await eraseWorkspaceData(resolved.workspaceId, auth.principal.id);
      return apiSuccess(result, { requestId: auth.requestId });
    } catch (error) {
      return apiError({ status: 503, code: "ERASURE_FAILED", message: error instanceof Error ? error.message : "Workspace data erasure failed.", requestId: auth.requestId });
    }
  }

  return apiError({ status: 400, code: "UNKNOWN_ACTION", message: "Supported actions are 'retention' and 'erase'.", requestId: auth.requestId });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(request, "admin");
  if ("response" in auth) return auth.response;
  const resolved = await workspaceOrError(auth);
  if (!resolved.workspaceId) return resolved.response;
  return apiError({ status: 405, code: "CONFIRMATION_REQUIRED", message: "Use POST with action 'erase' and the exact workspace confirmation phrase.", requestId: auth.requestId, headers: { Allow: "GET, PATCH, POST" } });
}
