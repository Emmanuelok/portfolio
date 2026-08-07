import { requireCloudContext } from "@/lib/cloud/auth";
import { parseCloudEvidenceId } from "@/lib/cloud/evidence-contracts";
import {
  completeCloudEvidenceDeletion,
  deleteCloudEvidenceRecord,
  downloadCloudEvidenceObject,
  getCloudEvidence,
  removeCloudEvidenceObject,
  requireCloudEvidenceProject,
  requireCloudEvidenceWriteRole,
} from "@/lib/cloud/evidence-repository";
import {
  parseCloudProjectId,
  parseIdempotencyKey,
  requestFingerprint,
} from "@/lib/cloud/contracts";
import {
  CloudHttpError,
  cloudErrorResponse,
  cloudJson,
} from "@/lib/cloud/http";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";

export const runtime = "nodejs";

type RouteContext = Readonly<{
  params: Promise<{ projectId: string; evidenceId: string }>;
}>;

async function routeIdsFrom(context: RouteContext) {
  const { projectId, evidenceId } = await context.params;
  try {
    return {
      projectId: parseCloudProjectId(projectId),
      evidenceId: parseCloudEvidenceId(evidenceId),
    };
  } catch {
    throw new CloudHttpError(400, "invalid_evidence_route", "The project or evidence identifier is invalid.");
  }
}

function contentDisposition(filename: string) {
  const ascii = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 180) || "evidence-file";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const [context, ids] = await Promise.all([
      requireCloudContext(request),
      routeIdsFrom(routeContext),
    ]);
    await requireCloudEvidenceProject(context, ids.projectId);
    const record = await getCloudEvidence(context, ids.projectId, ids.evidenceId);
    if (!record) {
      throw new CloudHttpError(404, "evidence_not_found", "The retained evidence file was not found.");
    }
    const bytes = await downloadCloudEvidenceObject(record);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(record.evidence.filename),
        "Content-Length": String(record.evidence.byteSize),
        "Content-Security-Policy": "sandbox",
        "Content-Type": record.evidence.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  try {
    requireCloudMutationRequest(request);
    const [context, ids] = await Promise.all([
      requireCloudContext(request),
      routeIdsFrom(routeContext),
    ]);
    requireCloudEvidenceWriteRole(context);
    await requireCloudEvidenceProject(context, ids.projectId);
    const idempotencyKey = parseIdempotencyKey(
      request.headers.get("idempotency-key"),
    );
    const requestHash = requestFingerprint({
      operation: "evidence.delete",
      organizationId: context.organizationId,
      projectId: ids.projectId,
      evidenceId: ids.evidenceId,
    });
    const prepared = await deleteCloudEvidenceRecord(context, {
      projectId: ids.projectId,
      evidenceId: ids.evidenceId,
      idempotencyKey,
      requestHash,
    });
    if (prepared.status === "not_found" || !prepared.storagePath) {
      throw new CloudHttpError(404, "evidence_not_found", "The retained evidence file was not found.");
    }
    await removeCloudEvidenceObject(prepared.storagePath);
    const result = await completeCloudEvidenceDeletion(context, {
      projectId: ids.projectId,
      evidenceId: ids.evidenceId,
      idempotencyKey,
      requestHash,
    });
    return cloudJson({
      ok: true,
      status: "deleted",
      projectId: ids.projectId,
      evidenceId: ids.evidenceId,
      replayed: result.replayed,
    }, {
      headers: {
        "Idempotency-Replayed": result.replayed ? "true" : "false",
      },
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
