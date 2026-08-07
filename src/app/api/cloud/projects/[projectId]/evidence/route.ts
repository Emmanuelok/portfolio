import { requireCloudContext } from "@/lib/cloud/auth";
import {
  CLOUD_EVIDENCE_MAX_REQUEST_BYTES,
  parseCloudEvidenceArtifactId,
} from "@/lib/cloud/evidence-contracts";
import {
  listCloudEvidence,
  registerCloudEvidence,
  removeCloudEvidenceObject,
  requireCloudEvidenceProject,
  requireCloudEvidenceWriteRole,
  uploadCloudEvidenceObject,
} from "@/lib/cloud/evidence-repository";
import {
  buildCloudEvidencePath,
  validateCloudEvidenceFile,
} from "@/lib/cloud/evidence-validation";
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

function requireBoundedMultipartRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;.*\bboundary=/i.test(contentType)) {
    throw new CloudHttpError(
      415,
      "multipart_form_required",
      "A multipart evidence upload is required.",
    );
  }
  const rawLength = request.headers.get("content-length");
  const contentLength = rawLength ? Number(rawLength) : Number.NaN;
  if (!Number.isSafeInteger(contentLength) || contentLength < 1) {
    throw new CloudHttpError(
      411,
      "content_length_required",
      "Evidence uploads require a valid Content-Length header.",
    );
  }
  if (contentLength > CLOUD_EVIDENCE_MAX_REQUEST_BYTES) {
    throw new CloudHttpError(
      413,
      "evidence_request_too_large",
      "The evidence upload request is too large.",
    );
  }
}

function parseArtifactId(form: FormData) {
  const value = form.get("artifactId");
  if (value instanceof File) {
    throw new CloudHttpError(400, "invalid_artifact_id", "The linked evidence artifact identifier is invalid.");
  }
  try {
    return parseCloudEvidenceArtifactId(value);
  } catch {
    throw new CloudHttpError(400, "invalid_artifact_id", "The linked evidence artifact identifier is invalid.");
  }
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const [context, projectId] = await Promise.all([
      requireCloudContext(request),
      projectIdFrom(routeContext),
    ]);
    await requireCloudEvidenceProject(context, projectId);
    const evidence = await listCloudEvidence(context, projectId);
    return cloudJson({
      ok: true,
      organizationId: context.organizationId,
      role: context.role,
      projectId,
      evidence,
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  let uploadedPath: string | null = null;
  let uploadedPathWasCreated = false;
  try {
    requireCloudMutationRequest(request);
    requireBoundedMultipartRequest(request);
    const [context, projectId] = await Promise.all([
      requireCloudContext(request),
      projectIdFrom(routeContext),
    ]);
    requireCloudEvidenceWriteRole(context);
    const projectRecord = await requireCloudEvidenceProject(context, projectId);
    const idempotencyKey = parseIdempotencyKey(
      request.headers.get("idempotency-key"),
    );

    const form = await request.formData();
    const keys = new Set(form.keys());
    if ([...keys].some((key) => key !== "file" && key !== "artifactId")) {
      throw new CloudHttpError(400, "invalid_evidence_form", "The evidence upload contains unsupported fields.");
    }
    if (form.getAll("file").length !== 1 || form.getAll("artifactId").length > 1) {
      throw new CloudHttpError(400, "invalid_evidence_form", "Upload exactly one evidence file.");
    }
    const artifactId = parseArtifactId(form);
    if (artifactId && !projectRecord.project.artifacts.some(
      (artifact) => artifact.id === artifactId && artifact.kind === "evidence",
    )) {
      throw new CloudHttpError(
        400,
        "evidence_artifact_not_found",
        "The selected evidence artifact does not belong to this project.",
      );
    }
    const file = await validateCloudEvidenceFile(form.get("file"));
    const storagePath = buildCloudEvidencePath({
      organizationId: context.organizationId,
      projectId,
      idempotencyKey,
      sha256: file.sha256,
      extension: file.extension,
    });
    uploadedPath = storagePath;
    const requestHash = requestFingerprint({
      operation: "evidence.upload",
      organizationId: context.organizationId,
      projectId,
      artifactId,
      filename: file.filename,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      sha256: file.sha256,
      storagePath,
    });
    const uploaded = await uploadCloudEvidenceObject({
      storagePath,
      bytes: file.bytes,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      sha256: file.sha256,
    });
    uploadedPathWasCreated = uploaded.created;
    const result = await registerCloudEvidence(context, {
      projectId,
      artifactId,
      storagePath,
      filename: file.filename,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      sha256: file.sha256,
      idempotencyKey,
      requestHash,
    });
    uploadedPath = null;
    return cloudJson({
      ok: true,
      status: "retained",
      replayed: result.replayed,
      evidence: result.evidence,
    }, {
      status: result.replayed ? 200 : 201,
      headers: {
        "Idempotency-Replayed": result.replayed ? "true" : "false",
      },
    });
  } catch (error) {
    const registrationWasDefinitelyRejected = error instanceof CloudHttpError
      && [400, 403, 404, 409].includes(error.status);
    if (uploadedPath && uploadedPathWasCreated && registrationWasDefinitelyRejected) {
      try {
        await removeCloudEvidenceObject(uploadedPath);
      } catch {
        // A deterministic request path lets the next identical request safely
        // reconcile an orphaned object if cleanup is temporarily unavailable.
      }
    }
    return cloudErrorResponse(error);
  }
}
