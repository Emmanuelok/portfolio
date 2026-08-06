import { loadPlatformSidecar } from "@/lib/platform/storage";
import type { PlatformProjectIntelligence } from "@/lib/platform/types";
import {
  WORKSPACE_STORAGE_KEY,
  parseWorkspaceLibrary,
} from "@/lib/workspace/storage";
import type {
  CodeFiles,
  WorkspaceDraft,
  WorkspaceMode,
  WorkspaceProject,
  WorkspaceVersion,
} from "@/lib/workspace/types";

import {
  appendArtifactRevision,
  codeRevisionBody,
  createKingxfordProject,
  hashRevisionBody,
  parseKingxfordProject,
  stableEntityId,
  textRevisionBody,
  upsertProjectNode,
  type ArtifactKind,
  type KingxfordProject,
  type ProjectPhase,
  type RevisionSource,
} from "./project-graph";

export const UNIFIED_MIGRATION_VERSION = 1 as const;

type MigrationStorage = Pick<Storage, "getItem" | "setItem">;

type ModeDescriptor = Readonly<{
  kind: ArtifactKind;
  phase: ProjectPhase;
  label: string;
}>;

const modeDescriptors: Readonly<Record<WorkspaceMode, ModeDescriptor>> = {
  idea: { kind: "idea", phase: "discovery", label: "Idea" },
  mindmap: { kind: "system-map", phase: "systems", label: "System map" },
  prompt: { kind: "prompt", phase: "prototype", label: "Prompt" },
  code: { kind: "code", phase: "prototype", label: "Code prototype" },
  brief: { kind: "brief", phase: "delivery", label: "Delivery brief" },
};

const versionSources: Readonly<Record<WorkspaceVersion["source"], RevisionSource>> = {
  manual: "human",
  run: "local-transform",
  agent: "agent-accepted",
  restored: "restored",
};

function revisionBody(draft: WorkspaceDraft) {
  return draft.mode === "code"
    ? codeRevisionBody(draft.code)
    : textRevisionBody(draft.text);
}

function appendDraft(
  project: KingxfordProject,
  draft: WorkspaceDraft,
  source: RevisionSource,
  createdAt: string,
) {
  const descriptor = modeDescriptors[draft.mode];
  const artifact = project.artifacts.find(
    (candidate) => candidate.kind === descriptor.kind && candidate.phase === descriptor.phase,
  );
  const body = revisionBody(draft);
  const activeRevision = artifact
    ? project.revisions.find(({ id }) => id === artifact.activeRevisionId)
    : undefined;
  if (activeRevision?.contentHash === hashRevisionBody(body)) return project;
  return appendArtifactRevision(project, {
    ...(artifact ? { artifactId: artifact.id } : {}),
    kind: descriptor.kind,
    phase: descriptor.phase,
    title: `${project.title} · ${descriptor.label}`.slice(0, 160),
    body,
    source,
    createdAt,
  });
}

function currentDrafts(project: WorkspaceProject): readonly WorkspaceDraft[] {
  return (["idea", "mindmap", "prompt", "code", "brief"] as const).map((mode) => ({
    mode,
    title: project.title,
    text: mode === "code" ? "" : project.textByMode[mode],
    code: project.code,
  }));
}

function appendLegacyIntelligence(
  projectValue: KingxfordProject,
  intelligence: PlatformProjectIntelligence | undefined,
) {
  if (!intelligence) return projectValue;
  let project = projectValue;

  for (const evidence of intelligence.evidence.slice(0, 48)) {
    const evidenceText = [
      evidence.title,
      evidence.claim,
      evidence.source ? `Source: ${evidence.source}` : "",
    ].filter(Boolean).join("\n\n");
    project = appendArtifactRevision(project, {
      kind: "evidence",
      phase: "evidence",
      title: evidence.title.slice(0, 160),
      body: textRevisionBody(evidenceText),
      source: "human",
      createdAt: evidence.addedAt,
    });
    project = upsertProjectNode(project, {
      key: `unified-evidence:${evidence.id}`,
      kind: "evidence",
      phase: "evidence",
      label: evidence.title,
      statement: evidence.claim || evidenceText,
      status: "known",
      sourceRef: evidence.source || null,
      recordedAt: evidence.addedAt,
    });
  }

  for (const decision of intelligence.decisions.slice(0, 48)) {
    project = upsertProjectNode(project, {
      key: `unified-decision:${decision.id}`,
      kind: decision.status === "accepted" ? "outcome" : "assumption",
      phase: intelligence.phase,
      label: decision.title,
      statement: [decision.decision, decision.rationale].filter(Boolean).join(" — "),
      status: decision.status === "accepted" ? "known" : "unresolved",
      sourceRef: `legacy-decision:${decision.id}`,
      recordedAt: decision.createdAt,
    });
  }

  for (const run of intelligence.agentRuns.slice(0, 48)) {
    project = upsertProjectNode(project, {
      key: `unified-run:${run.id}`,
      kind: "deliverable",
      phase: run.phase,
      label: `${run.role} review`,
      statement: run.summary,
      status: "known",
      sourceRef: `legacy-agent-run:${run.id}`,
      recordedAt: run.acceptedAt,
    });
  }

  return parseKingxfordProject({
    ...project,
    summary: (intelligence.objective || project.summary).slice(0, 1200),
    activePhase: intelligence.phase,
    updatedAt: [project.updatedAt, intelligence.updatedAt].sort().at(-1),
  });
}

export function migrateUnifiedWorkspaceProject(
  legacy: WorkspaceProject,
  intelligence?: PlatformProjectIntelligence,
) {
  let project = createKingxfordProject({
    title: legacy.title || "Untitled project",
    summary: legacy.textByMode.idea.slice(0, 1200),
    activePhase: modeDescriptors[legacy.mode].phase,
    createdAt: legacy.createdAt,
    idSeed: `canvas-v2:${legacy.id}`,
    origin: {
      kind: "import-clone",
      sourceProjectId: stableEntityId("project", "canvas-v2-source", legacy.id),
      sourceSnapshotIds: [],
      recordedAt: legacy.createdAt,
    },
  });

  for (const version of [...legacy.versions].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt))) {
    project = appendDraft(
      project,
      version.draft,
      versionSources[version.source],
      version.createdAt,
    );
  }
  for (const draft of currentDrafts(legacy)) {
    project = appendDraft(project, draft, "human", legacy.updatedAt);
  }

  const activeDescriptor = modeDescriptors[legacy.mode];
  const activeArtifact = project.artifacts.find(
    (artifact) => artifact.kind === activeDescriptor.kind
      && artifact.phase === activeDescriptor.phase,
  );
  project = parseKingxfordProject({
    ...project,
    activePhase: activeDescriptor.phase,
    activeArtifactId: activeArtifact?.id ?? project.activeArtifactId,
    updatedAt: legacy.updatedAt,
  });
  return appendLegacyIntelligence(project, intelligence);
}

export type UnifiedMigrationResult = Readonly<{
  projects: readonly KingxfordProject[];
  sourceProjectCount: number;
  warnings: readonly string[];
}>;

/**
 * Reads—but never deletes or mutates—the unified-create-system stores. The
 * repository layer persists the returned projects only after all validation
 * succeeds, leaving the original records available for recovery.
 */
export function readUnifiedCreateSystemProjects(
  storage: MigrationStorage,
  occupiedProjectIds: ReadonlySet<string> = new Set(),
): UnifiedMigrationResult {
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) return { projects: [], sourceProjectCount: 0, warnings: [] };

  const warnings: string[] = [];
  let library;
  try {
    library = parseWorkspaceLibrary(raw);
  } catch (error) {
    return {
      projects: [],
      sourceProjectCount: 0,
      warnings: [error instanceof Error ? error.message : "Canvas v2 could not be migrated."],
    };
  }

  const platform = loadPlatformSidecar(storage);
  const sidecar = platform.status === "error" ? null : platform.sidecar;
  if (platform.status === "error") warnings.push(platform.error.message);

  const projects: KingxfordProject[] = [];
  for (const legacy of library.projects) {
    try {
      const project = migrateUnifiedWorkspaceProject(
        legacy,
        sidecar?.projects[legacy.id],
      );
      if (!occupiedProjectIds.has(project.id)) projects.push(project);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `${legacy.title || legacy.id}: ${error.message}`
          : `${legacy.title || legacy.id}: migration failed.`,
      );
    }
  }
  return {
    projects,
    sourceProjectCount: library.projects.length,
    warnings,
  };
}

export function legacyCodeFiles(code: CodeFiles): CodeFiles {
  return { html: code.html, css: code.css, javascript: code.javascript };
}
