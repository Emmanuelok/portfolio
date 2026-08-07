import { z } from "zod";

import { requireCloudContext, requireCloudUser } from "@/lib/cloud/auth";
import {
  parseIdempotencyKey,
  parseOrganizationId,
  requestFingerprint,
} from "@/lib/cloud/contracts";
import {
  cloudErrorResponse,
  cloudJson,
  CloudHttpError,
  parseBoundedJsonRequest,
} from "@/lib/cloud/http";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";
import { removeCloudEvidenceObjects } from "@/lib/cloud/evidence-repository";
import { createServiceCloudClient } from "@/lib/cloud/service";

export const runtime = "nodejs";

const deletionSchema = z.object({
  confirmation: z.literal("DELETE MY CLOUD DATA"),
  organizationId: z.string().uuid(),
}).strict();

function storagePathsFromDeletion(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const paths = (value as { storagePaths?: unknown }).storagePaths;
  if (!Array.isArray(paths) || paths.some((path) => typeof path !== "string")) {
    return [];
  }
  return paths as string[];
}

function publicDeletionResult(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const result = { ...(value as Record<string, unknown>) };
  delete result.storagePaths;
  return result;
}

async function completeEvidenceCleanup(value: unknown) {
  const paths = storagePathsFromDeletion(value);
  for (let index = 0; index < paths.length; index += 100) {
    try {
      await removeCloudEvidenceObjects(paths.slice(index, index + 100));
    } catch {
      throw new CloudHttpError(
        503,
        "evidence_cleanup_pending",
        "Cloud records were removed, but private evidence cleanup is pending. Retry this deletion request.",
      );
    }
  }
  return paths.length;
}

export async function GET(request: Request) {
  try {
    const context = await requireCloudContext(request);
    const { data, error } = await context.client
      .from("organizations")
      .select("id, name, slug, created_at")
      .eq("id", context.organizationId)
      .single();
    if (error) {
      throw new CloudHttpError(503, "cloud_account_unavailable", "Cloud account information could not be loaded.");
    }
    return cloudJson({
      ok: true,
      user: {
        id: context.user.id,
        email: context.user.email ?? null,
      },
      organization: data,
      role: context.role,
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireCloudMutationRequest(request, { json: true });
    const rawBody = await parseBoundedJsonRequest(request, 1024);
    const body = deletionSchema.parse(rawBody);
    const organizationId = parseOrganizationId(body.organizationId);
    if (request.headers.get("x-kingxford-organization-id") !== organizationId) {
      throw new CloudHttpError(
        400,
        "organization_binding_required",
        "Cloud data deletion must be bound to the selected organization.",
      );
    }
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const cloudUser = await requireCloudUser();
    const requestHash = requestFingerprint({
      operation: "account.cloud-data-delete",
      organizationId,
      userId: cloudUser.user.id,
      confirmation: body.confirmation,
    });
    const { data: replay, error: replayError } = await cloudUser.client.rpc(
      "replay_kingxford_cloud_data_deletion",
      {
        p_organization_id: organizationId,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
      },
    );
    if (replayError) {
      if (replayError.code === "KX409") {
        throw new CloudHttpError(409, "idempotency_conflict", "The idempotency key was already used for another deletion request.");
      }
      throw new CloudHttpError(503, "cloud_delete_replay_unavailable", "Cloud data deletion could not be verified.");
    }
    if (replay) {
      const evidenceFilesDeleted = await completeEvidenceCleanup(replay);
      await cloudUser.client.auth.signOut({ scope: "local" });
      return cloudJson({
        ok: true,
        status: "deleted",
        evidenceFilesDeleted,
        result: publicDeletionResult(replay),
        replayed: true,
      });
    }

    const context = await requireCloudContext(request);
    if (context.organizationId !== organizationId) {
      throw new CloudHttpError(403, "organization_access_denied", "You do not have access to this organization.");
    }
    if (context.role === "owner") {
      const [members, evidence] = await Promise.all([
        context.client
          .from("organization_members")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", context.organizationId),
        context.client
          .from("evidence_objects")
          .select("storage_path")
          .eq("organization_id", context.organizationId),
      ]);
      if (members.error || evidence.error) {
        throw new CloudHttpError(503, "cloud_delete_preflight_failed", "Cloud data could not be prepared for deletion.");
      }
      if ((members.count ?? 0) > 1) {
        throw new CloudHttpError(
          409,
          "ownership_transfer_required",
          "Transfer organization ownership before deleting your cloud data.",
        );
      }
      const paths = (evidence.data ?? []).flatMap((record) =>
        typeof record.storage_path === "string" ? [record.storage_path] : [],
      );
      if (paths.length > 0 && !createServiceCloudClient()) {
        throw new CloudHttpError(
          503,
          "evidence_cleanup_unavailable",
          "Private evidence cleanup is not configured. No organization records were removed.",
        );
      }
    }
    const { data, error } = await context.client.rpc("delete_my_kingxford_cloud_data", {
      p_organization_id: context.organizationId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) {
      if (error.code === "KX403") {
        throw new CloudHttpError(403, "cloud_data_delete_denied", "Cloud data could not be deleted for this organization role.");
      }
      throw new CloudHttpError(503, "cloud_data_delete_failed", "Cloud data could not be deleted.");
    }
    const evidenceFilesDeleted = await completeEvidenceCleanup(data);
    await context.client.auth.signOut({ scope: "local" });
    return cloudJson({
      ok: true,
      status: "deleted",
      evidenceFilesDeleted,
      result: publicDeletionResult(data),
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
