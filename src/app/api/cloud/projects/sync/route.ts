import { requireCloudContext } from "@/lib/cloud/auth";
import {
  parseCloudSyncWrite,
  parseIdempotencyKey,
  requestFingerprint,
} from "@/lib/cloud/contracts";
import {
  cloudErrorResponse,
  cloudJson,
  parseBoundedJsonRequest,
} from "@/lib/cloud/http";
import { mutateCloudProject } from "@/lib/cloud/repository";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireCloudMutationRequest(request, { json: true });
    const [context, body] = await Promise.all([
      requireCloudContext(request),
      parseBoundedJsonRequest(request),
    ]);
    const { projects } = parseCloudSyncWrite(body);
    const batchKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const results = [];

    // Project RPCs are individually atomic and idempotent. Sequential execution
    // preserves a deterministic result order and avoids burst writes per user.
    for (const [index, write] of projects.entries()) {
      const requestHash = requestFingerprint({
        operation: "project.sync",
        organizationId: context.organizationId,
        project: write.project,
        expectedVersion: write.expectedVersion,
      });
      const idempotencyKey = `${batchKey.slice(0, 110)}:${index}:${requestHash.slice(-32)}`;
      const result = await mutateCloudProject(context, write, {
        idempotencyKey,
        requestHash,
        expectedVersion: write.expectedVersion,
        expectedContentHash: null,
      });
      results.push(result);
    }

    const hasConflicts = results.some(({ status }) => status === "conflict");
    return cloudJson({
      ok: !hasConflicts,
      organizationId: context.organizationId,
      status: hasConflicts ? "conflicts" : "synchronized",
      results,
    }, {
      status: hasConflicts ? 409 : 200,
      headers: {
        "Idempotency-Replayed": results.every(({ replayed }) => replayed)
          ? "true"
          : "false",
      },
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
