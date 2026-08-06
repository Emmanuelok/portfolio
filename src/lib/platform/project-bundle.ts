import {
  createPlatformProjectIntelligence,
  validatePlatformSidecar,
} from "@/lib/platform/storage";
import type { PlatformProjectIntelligence } from "@/lib/platform/types";
import {
  importWorkspaceProjectBundle,
  serializeWorkspaceProjectBundle,
  WORKSPACE_BUNDLE_CHARACTER_LIMIT,
  WORKSPACE_BUNDLE_FORMAT,
} from "@/lib/workspace/storage";
import type { WorkspaceProject } from "@/lib/workspace/types";

export const PLATFORM_PROJECT_BUNDLE_FORMAT =
  "kingxford-intelligence-project" as const;
export const PLATFORM_PROJECT_BUNDLE_SCHEMA_VERSION = 1 as const;
export const PLATFORM_PROJECT_BUNDLE_CHARACTER_LIMIT =
  WORKSPACE_BUNDLE_CHARACTER_LIMIT + 1_000_000;

export type PlatformProjectBundle = Readonly<{
  format: typeof PLATFORM_PROJECT_BUNDLE_FORMAT;
  schemaVersion: typeof PLATFORM_PROJECT_BUNDLE_SCHEMA_VERSION;
  exportedAt: string;
  project: WorkspaceProject;
  intelligence: PlatformProjectIntelligence;
}>;

export type ImportedPlatformProjectBundle = Readonly<{
  project: WorkspaceProject;
  intelligence: PlatformProjectIntelligence;
  sourceFormat: "platform" | "legacy-canvas";
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function strictKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
) {
  const actual = Object.keys(value);
  const unexpected = actual.find((key) => !keys.includes(key));
  const missing = keys.find((key) => !(key in value));
  if (unexpected) throw new Error(`${label} contains an unexpected '${unexpected}' field.`);
  if (missing) throw new Error(`${label} is missing its '${missing}' field.`);
}

function parseJson(raw: string): unknown {
  if (raw.length > PLATFORM_PROJECT_BUNDLE_CHARACTER_LIMIT) {
    throw new Error("That Kingxford project bundle exceeds the supported import size.");
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error("That Kingxford project bundle is not valid JSON.", {
      cause: error,
    });
  }
}

function validateIntelligence(
  value: unknown,
  expectedProjectId: string,
): PlatformProjectIntelligence {
  const validated = validatePlatformSidecar({
    schemaVersion: 1,
    revision: 0,
    projects: { [expectedProjectId]: value },
  });
  return validated.projects[expectedProjectId];
}

export function serializePlatformProjectBundle(
  project: WorkspaceProject,
  intelligence: PlatformProjectIntelligence,
): string {
  if (project.id !== intelligence.projectId) {
    throw new Error("Editable source and project intelligence must identify the same project.");
  }

  // Reuse each authority's strict validator before composing the aggregate.
  const validatedProject = (
    JSON.parse(serializeWorkspaceProjectBundle(project)) as { project: WorkspaceProject }
  ).project;
  const validatedIntelligence = validateIntelligence(intelligence, project.id);
  const bundle: PlatformProjectBundle = {
    format: PLATFORM_PROJECT_BUNDLE_FORMAT,
    schemaVersion: PLATFORM_PROJECT_BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project: validatedProject,
    intelligence: validatedIntelligence,
  };
  const serialized = JSON.stringify(bundle);
  if (serialized.length > PLATFORM_PROJECT_BUNDLE_CHARACTER_LIMIT) {
    throw new Error("That Kingxford project bundle exceeds the supported export size.");
  }
  return serialized;
}

export function importPlatformProjectBundle(
  raw: string,
  existingProjectIds: readonly string[] = [],
): ImportedPlatformProjectBundle {
  const parsed = parseJson(raw);
  const root = record(parsed, "Kingxford project bundle");

  if (root.format === WORKSPACE_BUNDLE_FORMAT) {
    const project = importWorkspaceProjectBundle(raw, existingProjectIds);
    return {
      project,
      intelligence: createPlatformProjectIntelligence(project.id, {
        phase: "discovery",
      }),
      sourceFormat: "legacy-canvas",
    };
  }

  strictKeys(
    root,
    ["format", "schemaVersion", "exportedAt", "project", "intelligence"],
    "Kingxford project bundle",
  );
  if (root.format !== PLATFORM_PROJECT_BUNDLE_FORMAT) {
    throw new Error("That file is not a supported Kingxford project bundle.");
  }
  if (root.schemaVersion !== PLATFORM_PROJECT_BUNDLE_SCHEMA_VERSION) {
    throw new Error("That Kingxford project bundle uses an unsupported version.");
  }
  if (
    typeof root.exportedAt !== "string" ||
    Number.isNaN(Date.parse(root.exportedAt))
  ) {
    throw new Error("That Kingxford project bundle has an invalid export timestamp.");
  }

  const sourceProject = record(root.project, "Kingxford project source");
  const sourceProjectId = sourceProject.id;
  if (typeof sourceProjectId !== "string" || !sourceProjectId) {
    throw new Error("That Kingxford project bundle has no valid project identifier.");
  }
  const sourceIntelligence = validateIntelligence(
    root.intelligence,
    sourceProjectId,
  );

  // The mature Canvas importer validates every nested field and always assigns
  // a fresh identifier, preventing an import from overwriting existing work.
  const project = importWorkspaceProjectBundle(
    JSON.stringify({
      format: WORKSPACE_BUNDLE_FORMAT,
      schemaVersion: 1,
      exportedAt: root.exportedAt,
      project: root.project,
    }),
    existingProjectIds,
  );
  const intelligence = validateIntelligence(
    {
      ...sourceIntelligence,
      projectId: project.id,
      updatedAt: new Date().toISOString(),
    },
    project.id,
  );

  return { project, intelligence, sourceFormat: "platform" };
}
