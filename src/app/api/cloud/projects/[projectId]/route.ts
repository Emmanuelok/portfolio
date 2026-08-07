import { requireCloudContext } from "@/lib/cloud/auth";
import {
  parseCloudProjectEtag,
  parseCloudProjectId,
  parseCloudProjectWrite,
  parseIdempotencyKey,
  matchesIfMatch,
  requestFingerprint,
} from "@/lib/cloud/contracts";
import {
  CloudHttpError,
  cloudErrorResponse,
  cloudJson,
  parseBoundedJsonRequest,
} from "@/lib/cloud/http";
import {
  deleteCloudProject,
  getCloudProject,
  mutateCloudProject,
} from "@/lib/cloud/repository";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";
import { removeCloudEvidenceObjects } from "@/lib/cloud/evidence-repository";

export const runtime = "nodejs";

type RouteContext = Readonly<{
  params: Promise<{ projectId: string }>;
}>;

async function projectIdFrom(context: RouteContext) {
  const { projectId } = await context.params;
  try {
    return parseCloudProjectId(projectId);
  } catch {
    throw new CloudHttpError(400, "invalid_project_id", "The project identifier is invalid.");
  }
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const [context, projectId] = await Promise.all([
      requireCloudContext(request),
      projectIdFrom(routeContext),
    ]);
    const record = await getCloudProject(context, projectId);
    if (!record) {
      throw new CloudHttpError(404, "project_not_found", "The cloud project was not found.");
    }
    if (matchesIfMatch(request.headers.get("if-none-match"), record.summary.etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          "Cache-Control": "private, no-store",
          ETag: record.summary.etag,
          Vary: "Cookie, X-Kingxford-Organization-Id",
        },
      });
    }
    return cloudJson(
      {
        ok: true,
        organizationId: context.organizationId,
        project: record.project,
        cloud: record.summary,
      },
      { headers: { ETag: record.summary.etag } },
    );
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function PUT(request: Request, routeContext: RouteContext) {
  try {
    requireCloudMutationRequest(request, { json: true });
    const [context, projectId, body] = await Promise.all([
      requireCloudContext(request),
      projectIdFrom(routeContext),
      parseBoundedJsonRequest(request),
    ]);
    const write = parseCloudProjectWrite(body);
    if (write.project.id !== projectId) {
      throw new CloudHttpError(400, "project_id_mismatch", "The route and project identifiers must match.");
    }

    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const ifMatchHeader = request.headers.get("if-match");
    const ifNoneMatchHeader = request.headers.get("if-none-match");
    if (ifMatchHeader && ifNoneMatchHeader) {
      throw new CloudHttpError(400, "conflicting_preconditions", "Use either If-Match or If-None-Match, not both.");
    }
    if (ifNoneMatchHeader && ifNoneMatchHeader.trim() !== "*") {
      throw new CloudHttpError(400, "invalid_if_none_match", "Creating a cloud project accepts only If-None-Match: *.");
    }
    const expected = parseCloudProjectEtag(ifMatchHeader);
    if (ifMatchHeader && !expected) {
      throw new CloudHttpError(400, "invalid_if_match", "If-Match must contain a Kingxford cloud project ETag.");
    }
    if (write.expectedVersion !== null && !expected) {
      throw new CloudHttpError(428, "etag_required", "Updating a cloud project requires its current ETag.");
    }
    if (
      expected
      && write.expectedVersion !== null
      && write.expectedVersion !== expected.version
    ) {
      throw new CloudHttpError(400, "version_etag_mismatch", "The expected version does not match If-Match.");
    }

    const expectedVersion = expected?.version ?? null;
    const expectedContentHash = expected?.contentHash ?? null;
    const requestHash = requestFingerprint({
      operation: "project.upsert",
      organizationId: context.organizationId,
      project: write.project,
      expectedVersion,
      expectedContentHash,
      createOnly: ifNoneMatchHeader === "*",
    });
    const result = await mutateCloudProject(context, write, {
      idempotencyKey,
      requestHash,
      expectedVersion,
      expectedContentHash,
    });

    if (result.status === "conflict") {
      const etag = result.version && result.contentHash
        ? `"kxcloud-v${result.version}-${result.contentHash}"`
        : undefined;
      throw new CloudHttpError(
        409,
        "project_version_conflict",
        "The cloud project changed after this copy was loaded. Review the latest version before saving again.",
        {
          details: {
            projectId,
            currentVersion: result.version,
            currentEtag: etag ?? null,
            updatedAt: result.updatedAt,
          },
          headers: etag ? { ETag: etag } : undefined,
        },
      );
    }

    const record = await getCloudProject(context, projectId);
    if (!record) {
      throw new CloudHttpError(502, "cloud_write_not_visible", "The saved cloud project could not be verified.");
    }
    return cloudJson(
      {
        ok: true,
        status: result.status,
        replayed: result.replayed,
        project: record.project,
        cloud: record.summary,
      },
      {
        status: result.status === "created" ? 201 : 200,
        headers: {
          ETag: record.summary.etag,
          "Idempotency-Replayed": result.replayed ? "true" : "false",
        },
      },
    );
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  try {
    requireCloudMutationRequest(request);
    const [context, projectId] = await Promise.all([
      requireCloudContext(request),
      projectIdFrom(routeContext),
    ]);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const expected = parseCloudProjectEtag(request.headers.get("if-match"));
    if (!expected) {
      throw new CloudHttpError(428, "etag_required", "Deleting a cloud project requires its current ETag.");
    }
    const requestHash = requestFingerprint({
      operation: "project.delete",
      organizationId: context.organizationId,
      projectId,
      expected,
    });
    const result = await deleteCloudProject(context, projectId, {
      idempotencyKey,
      requestHash,
      expectedVersion: expected.version,
      expectedContentHash: expected.contentHash,
    });
    if (result.status === "conflict") {
      const etag = result.version && result.contentHash
        ? `"kxcloud-v${result.version}-${result.contentHash}"`
        : undefined;
      throw new CloudHttpError(
        409,
        "project_version_conflict",
        "The cloud project changed before it could be deleted.",
        {
          details: { currentVersion: result.version, currentEtag: etag ?? null },
          headers: etag ? { ETag: etag } : undefined,
        },
      );
    }
    if (result.status !== "deleted") {
      throw new CloudHttpError(404, "project_not_found", "The cloud project was not found.");
    }
    if (result.storagePaths.length > 0) {
      try {
        await removeCloudEvidenceObjects(result.storagePaths);
      } catch {
        throw new CloudHttpError(
          503,
          "evidence_cleanup_pending",
          "The project record was deleted, but its private evidence files still require cleanup. Retry this request with the same idempotency key.",
        );
      }
    }
    return cloudJson({
      ok: true,
      status: "deleted",
      projectId,
      replayed: result.replayed,
      evidenceFilesDeleted: result.storagePaths.length,
    }, {
      headers: { "Idempotency-Replayed": result.replayed ? "true" : "false" },
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
