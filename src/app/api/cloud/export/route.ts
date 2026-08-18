import { requireCloudContext } from "@/lib/cloud/auth";
import { cloudErrorResponse, cloudJson, CloudHttpError } from "@/lib/cloud/http";
import { requireCloudRequestAllowance } from "@/lib/cloud/request-security";
import { createServiceCloudClient } from "@/lib/cloud/service";

export const runtime = "nodejs";

const EXPORT_ALLOWANCE = {
  limit: 3,
  windowSeconds: 900,
} as const;

const EXPORT_ROW_LIMITS = {
  memberships: 1_000,
  projects: 500,
  revisions: 5_000,
  intelligenceRuns: 5_000,
  evidenceObjects: 5_000,
  usageRecords: 10_000,
  auditEvents: 10_000,
} as const;

type PageResult = Readonly<{
  data: readonly unknown[] | null;
  error: unknown;
}>;

type BoundedExportRows = Readonly<{
  records: readonly unknown[];
  truncated: boolean;
}>;

async function collectExportRows(
  label: string,
  load: (from: number, to: number) => PromiseLike<PageResult>,
  maximumRecords = 50_000,
): Promise<BoundedExportRows> {
  const pageSize = 500;
  const records: unknown[] = [];
  const failed = () =>
    new CloudHttpError(503, "cloud_export_failed", `${label} could not be included in the cloud export.`);

  for (let from = 0; from < maximumRecords; from += pageSize) {
    const to = Math.min(from + pageSize, maximumRecords) - 1;
    const { data, error } = await load(from, to);
    if (error || !Array.isArray(data)) throw failed();
    records.push(...data);
    if (data.length < to - from + 1) return { records, truncated: false };
  }

  const beyondLimit = await load(maximumRecords, maximumRecords);
  if (beyondLimit.error || !Array.isArray(beyondLimit.data)) throw failed();
  return { records, truncated: beyondLimit.data.length > 0 };
}

export async function GET(request: Request) {
  try {
    const context = await requireCloudContext(request);
    await requireCloudRequestAllowance(
      {
        scope: "cloud-export",
        identity: context.user.id,
        limit: EXPORT_ALLOWANCE.limit,
        windowSeconds: EXPORT_ALLOWANCE.windowSeconds,
      },
      {
        rateLimited:
          "This organization export was requested too many times. Wait for the retry interval before exporting again.",
        unavailable:
          "Export protection is not available on this deployment, so the export was not prepared.",
      },
    );
    const organizationRequest = context.client
      .from("organizations")
      .select("id, name, slug, created_at, updated_at")
      .eq("id", context.organizationId)
      .single();
    const [organization, memberships, projects, revisions, runs, evidence, usage, audit] = await Promise.all([
      organizationRequest,
      collectExportRows("Organization memberships", (from, to) => context.client
        .from("organization_members")
        .select("user_id, role, joined_at")
        .eq("organization_id", context.organizationId)
        .range(from, to), EXPORT_ROW_LIMITS.memberships),
      collectExportRows("Projects", (from, to) => context.client
        .from("projects")
        .select("id, title, summary, active_phase, document, version, content_hash, created_at, updated_at")
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .range(from, to), EXPORT_ROW_LIMITS.projects),
      collectExportRows("Project revisions", (from, to) => context.client
        .from("project_revisions")
        .select("id, project_id, project_version, content_hash, document, actor_user_id, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to), EXPORT_ROW_LIMITS.revisions),
      collectExportRows("Intelligence runs", (from, to) => context.client
        .from("intelligence_runs")
        .select("id, project_id, request_id, workflow_run_id, mode, status, provider, model, result, created_at, completed_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to), EXPORT_ROW_LIMITS.intelligenceRuns),
      collectExportRows("Evidence records", (from, to) => context.client
        .from("evidence_objects")
        .select("id, project_id, artifact_id, storage_path, filename, mime_type, byte_size, sha256, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to), EXPORT_ROW_LIMITS.evidenceObjects),
      collectExportRows("Usage records", (from, to) => context.client
        .from("usage_records")
        .select("id, user_id, feature, provider, model, input_tokens, output_tokens, cost_microunits, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to), EXPORT_ROW_LIMITS.usageRecords),
      collectExportRows("Audit events", (from, to) => context.client
        .from("audit_events")
        .select("id, actor_user_id, action, target_type, target_id, request_id, metadata, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to), EXPORT_ROW_LIMITS.auditEvents),
    ]);

    if (organization.error) {
      throw new CloudHttpError(503, "cloud_export_failed", "The complete cloud export could not be prepared.");
    }

    const collections = {
      memberships,
      projects,
      revisions,
      intelligenceRuns: runs,
      evidenceObjects: evidence,
      usageRecords: usage,
      auditEvents: audit,
    };
    const truncatedCollections = Object.entries(collections)
      .filter(([, rows]) => rows.truncated)
      .map(([name]) => name);

    const serviceClient = createServiceCloudClient();
    if (serviceClient) {
      await serviceClient.from("audit_events").insert({
        organization_id: context.organizationId,
        actor_user_id: context.user.id,
        action: "organization.exported",
        target_type: "organization",
        target_id: context.organizationId,
        request_id: crypto.randomUUID(),
        metadata: {
          format: "kingxford-cloud-export",
          version: 1,
          truncatedCollections,
        },
      });
    }

    const exportedAt = new Date().toISOString();
    const date = exportedAt.slice(0, 10);
    return cloudJson(
      {
        schema: "kingxford-cloud-export",
        schemaVersion: 1,
        exportedAt,
        exportedBy: context.user.id,
        organization: organization.data,
        membershipRole: context.role,
        memberships: memberships.records,
        projects: projects.records,
        revisions: revisions.records,
        intelligenceRuns: runs.records,
        evidenceObjects: evidence.records,
        usageRecords: usage.records,
        auditEvents: audit.records,
        bounds: {
          complete: truncatedCollections.length === 0,
          truncatedCollections,
          rowLimits: EXPORT_ROW_LIMITS,
          ...(truncatedCollections.length === 0
            ? {}
            : {
                note: "The listed collections reached the bounded self-service export size and stop at their row limit. Contact the operator for an assisted export.",
              }),
        },
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="kingxford-cloud-export-${date}.json"`,
        },
      },
    );
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
