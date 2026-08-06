import { z } from "zod";

import {
  appendArtifactRevision,
  codeRevisionBody,
  createKingxfordProject,
  parseKingxfordProject,
  textRevisionBody,
  type AppendArtifactRevisionInput,
  type ArtifactKind,
  type KingxfordProject,
  type ProjectPhase,
  type RevisionSource,
} from "./project-graph";
import {
  workspaceModes,
  type CodeFiles,
  type WorkspaceDraft,
  type WorkspaceMode,
} from "./types";

export const CANVAS_V1_STORAGE_KEY = "kingxford:canvas:v1" as const;

const codeFilesSchema = z.object({
  html: z.string().max(80_000),
  css: z.string().max(80_000),
  javascript: z.string().max(80_000),
}).strict();

const workspaceDraftSchema = z.object({
  mode: z.enum(workspaceModes),
  title: z.string().max(160),
  text: z.string().max(60_000),
  code: codeFilesSchema,
}).strict();

const workspaceVersionSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(240),
  createdAt: z.string().datetime({ offset: true }),
  source: z.enum(["manual", "run", "agent", "restored"]),
  draft: workspaceDraftSchema,
}).strict();

export const canvasV1Schema = z.object({
  mode: z.enum(workspaceModes),
  title: z.string().max(160),
  textByMode: z.object({
    idea: z.string().max(60_000),
    mindmap: z.string().max(60_000),
    prompt: z.string().max(60_000),
    brief: z.string().max(60_000),
  }).strict(),
  code: codeFilesSchema,
  committedCode: codeFilesSchema,
  versions: z.array(workspaceVersionSchema).max(16),
  reviewHistory: z.array(z.unknown()).max(8).optional(),
  reviewLens: z.string().min(1).max(40).optional(),
  includeKnowledge: z.boolean().optional(),
}).strict();

export type CanvasV1StoredWorkspace = z.infer<typeof canvasV1Schema>;

const modeArtifact: Readonly<Record<WorkspaceMode, Readonly<{
  kind: ArtifactKind;
  phase: ProjectPhase;
  label: string;
}>>> = {
  idea: { kind: "idea", phase: "discovery", label: "Idea" },
  mindmap: { kind: "system-map", phase: "systems", label: "System map" },
  prompt: { kind: "prompt", phase: "prototype", label: "Prompt" },
  code: { kind: "code", phase: "prototype", label: "Code prototype" },
  brief: { kind: "brief", phase: "delivery", label: "Delivery brief" },
};

function sourceForVersion(
  source: CanvasV1StoredWorkspace["versions"][number]["source"],
): RevisionSource {
  if (source === "agent") return "agent-proposal";
  if (source === "run") return "local-transform";
  if (source === "restored") return "restored";
  return "human";
}

function revisionInput(
  draft: WorkspaceDraft,
  title: string,
  source: RevisionSource,
  createdAt: string,
  artifactId?: string,
): AppendArtifactRevisionInput {
  const descriptor = modeArtifact[draft.mode];
  return {
    ...(artifactId ? { artifactId } : {}),
    kind: descriptor.kind,
    phase: descriptor.phase,
    title: `${title || "Untitled project"} · ${descriptor.label}`,
    body: draft.mode === "code"
      ? codeRevisionBody(draft.code)
      : textRevisionBody(draft.text),
    source,
    createdAt,
  };
}

export function parseCanvasV1(value: unknown): CanvasV1StoredWorkspace {
  return canvasV1Schema.parse(value);
}

export function safeParseCanvasV1(value: unknown):
  | Readonly<{ success: true; data: CanvasV1StoredWorkspace }>
  | Readonly<{ success: false; error: Error }> {
  try {
    return { success: true, data: parseCanvasV1(value) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error("Invalid Canvas v1 workspace."),
    };
  }
}

export function canvasV1CurrentDraft(
  canvas: CanvasV1StoredWorkspace,
  mode: WorkspaceMode,
): WorkspaceDraft {
  return {
    mode,
    title: canvas.title,
    text: mode === "code" ? "" : canvas.textByMode[mode],
    code: { ...canvas.code },
  };
}

export type MigrateCanvasV1Options = Readonly<{
  migratedAt?: string;
  idSeed?: string;
}>;

export function migrateCanvasV1ToProject(
  value: unknown,
  options: MigrateCanvasV1Options = {},
): KingxfordProject {
  const canvas = parseCanvasV1(value);
  const migratedAt = options.migratedAt ?? new Date().toISOString();
  const orderedVersions = [...canvas.versions].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const createdAt = orderedVersions[0]?.createdAt ?? migratedAt;
  const title = canvas.title.trim() || "Migrated Canvas project";
  let project = createKingxfordProject({
    title,
    summary: "Migrated from the private Canvas v1 workspace on this device.",
    activePhase: modeArtifact[canvas.mode].phase,
    createdAt,
    idSeed: options.idSeed ?? `canvas-v1:${title}`,
    origin: {
      kind: "canvas-v1-migration",
      sourceProjectId: null,
      sourceSnapshotIds: [],
      recordedAt: migratedAt,
    },
  });

  const artifactIds = new Map<WorkspaceMode, string>();
  for (const version of orderedVersions) {
    const mode = version.draft.mode;
    project = appendArtifactRevision(
      project,
      revisionInput(
        version.draft,
        title,
        sourceForVersion(version.source),
        version.createdAt,
        artifactIds.get(mode),
      ),
    );
    artifactIds.set(mode, project.activeArtifactId!);
  }

  const modesInMigrationOrder = workspaceModes
    .filter((mode) => mode !== canvas.mode)
    .concat(canvas.mode);
  for (const mode of modesInMigrationOrder) {
    const currentDraft = canvasV1CurrentDraft(canvas, mode);
    project = appendArtifactRevision(
      project,
      revisionInput(
        currentDraft,
        title,
        "canvas-v1-migration",
        migratedAt,
        artifactIds.get(mode),
      ),
    );
    artifactIds.set(mode, project.activeArtifactId!);
  }

  return parseKingxfordProject(project);
}

export function tryMigrateCanvasV1ToProject(
  value: unknown,
  options: MigrateCanvasV1Options = {},
): KingxfordProject | null {
  try {
    return migrateCanvasV1ToProject(value, options);
  } catch {
    return null;
  }
}

export function draftToProjectRevision(
  project: KingxfordProject,
  draft: WorkspaceDraft,
  options: Readonly<{
    artifactId?: string;
    source?: RevisionSource;
    createdAt?: string;
  }> = {},
) {
  return appendArtifactRevision(
    project,
    revisionInput(
      draft,
      project.title,
      options.source ?? "human",
      options.createdAt ?? new Date().toISOString(),
      options.artifactId,
    ),
  );
}

export function revisionBodyToCanvasDraft(
  title: string,
  mode: WorkspaceMode,
  body: ReturnType<typeof textRevisionBody> | ReturnType<typeof codeRevisionBody>,
): WorkspaceDraft {
  const emptyCode: CodeFiles = { html: "", css: "", javascript: "" };
  return {
    mode,
    title,
    text: body.type === "text" ? body.text : "",
    code: body.type === "code" ? { ...body } : emptyCode,
  };
}
