import { requireCloudContext } from "@/lib/cloud/auth";
import { cloudErrorResponse, cloudJson, CloudHttpError } from "@/lib/cloud/http";
import { createServiceCloudClient } from "@/lib/cloud/service";

export const runtime = "nodejs";

type PageResult = Readonly<{
  data: readonly unknown[] | null;
  error: unknown;
}>;

async function collectExportRows(
  label: string,
  load: (from: number, to: number) => PromiseLike<PageResult>,
  maximumRecords = 50_000,
) {
  const pageSize = 500;
  const records: unknown[] = [];
  for (let from = 0; from < maximumRecords; from += pageSize) {
    const { data, error } = await load(from, from + pageSize - 1);
    if (error || !Array.isArray(data)) {
      throw new CloudHttpError(503, "cloud_export_failed", `${label} could not be included in the cloud export.`);
    }
    records.push(...data);
    if (data.length < pageSize) return records;
  }
  throw new CloudHttpError(
    413,
    "cloud_export_too_large",
    `${label} exceed the bounded self-service export size. Contact the operator for an assisted export.`,
  );
}

export async function GET(request: Request) {
  try {
    const context = await requireCloudContext(request);
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
        .range(from, to)),
      collectExportRows("Projects", (from, to) => context.client
        .from("projects")
        .select("id, title, summary, active_phase, document, version, content_hash, created_at, updated_at")
        .eq("organization_id", context.organizationId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .range(from, to)),
      collectExportRows("Project revisions", (from, to) => context.client
        .from("project_revisions")
        .select("id, project_id, project_version, content_hash, document, actor_user_id, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to)),
      collectExportRows("Intelligence runs", (from, to) => context.client
        .from("intelligence_runs")
        .select("id, project_id, request_id, workflow_run_id, mode, status, provider, model, result, created_at, completed_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to)),
      collectExportRows("Evidence records", (from, to) => context.client
        .from("evidence_objects")
        .select("id, project_id, artifact_id, storage_path, filename, mime_type, byte_size, sha256, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to)),
      collectExportRows("Usage records", (from, to) => context.client
        .from("usage_records")
        .select("id, user_id, feature, provider, model, input_tokens, output_tokens, cost_microunits, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to)),
      collectExportRows("Audit events", (from, to) => context.client
        .from("audit_events")
        .select("id, actor_user_id, action, target_type, target_id, request_id, metadata, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: true })
        .range(from, to)),
    ]);

    if (organization.error) {
      throw new CloudHttpError(503, "cloud_export_failed", "The complete cloud export could not be prepared.");
    }

    const serviceClient = createServiceCloudClient();
    if (serviceClient) {
      await serviceClient.from("audit_events").insert({
        organization_id: context.organizationId,
        actor_user_id: context.user.id,
        action: "organization.exported",
        target_type: "organization",
        target_id: context.organizationId,
        request_id: crypto.randomUUID(),
        metadata: { format: "kingxford-cloud-export", version: 1 },
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
        memberships,
        projects,
        revisions,
        intelligenceRuns: runs,
        evidenceObjects: evidence,
        usageRecords: usage,
        auditEvents: audit,
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
