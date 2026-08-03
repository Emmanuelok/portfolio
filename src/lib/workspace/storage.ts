import { z } from "zod";

import type {
  CodeFiles,
  TextByMode,
  WorkspaceDraft,
  WorkspaceLibraryV2,
  WorkspaceProject,
  WorkspaceProjectBundle,
  WorkspaceProjectContent,
  WorkspaceVersion,
} from "@/lib/workspace/types";
import { workspaceModes } from "@/lib/workspace/types";

export const LEGACY_WORKSPACE_STORAGE_KEY = "kingxford:canvas:v1";
export const WORKSPACE_STORAGE_KEY = "kingxford:canvas:v2";
export const WORKSPACE_SCHEMA_VERSION = 2 as const;
export const WORKSPACE_BUNDLE_FORMAT = "kingxford-canvas-project" as const;
export const WORKSPACE_BUNDLE_SCHEMA_VERSION = 1 as const;

export const WORKSPACE_PROJECT_LIMIT = 20;
export const WORKSPACE_VERSION_LIMIT = 16;
export const WORKSPACE_TITLE_LIMIT = 120;
export const WORKSPACE_TEXT_LIMIT = 250_000;
export const WORKSPACE_CODE_FILE_LIMIT = 500_000;
export const WORKSPACE_LIBRARY_CHARACTER_LIMIT = 4_000_000;
export const WORKSPACE_BUNDLE_CHARACTER_LIMIT = 4_000_000;

export type WorkspaceStorageErrorCode =
  | "invalid-json"
  | "invalid-data"
  | "unsupported-version"
  | "too-large"
  | "project-limit"
  | "quota-exceeded"
  | "storage-unavailable";

export class WorkspaceStorageError extends Error {
  readonly code: WorkspaceStorageErrorCode;

  constructor(code: WorkspaceStorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkspaceStorageError";
    this.code = code;
  }
}

export type WorkspaceStorageLike = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}>;

export type WorkspaceLoadResult =
  | Readonly<{
      status: "ready";
      source: "v2" | "v1-migration";
      library: WorkspaceLibraryV2;
      needsPersistence: boolean;
    }>
  | Readonly<{ status: "empty" }>
  | Readonly<{
      status: "error";
      source: "v2" | "v1" | "storage";
      error: WorkspaceStorageError;
    }>;

export type WorkspaceSaveResult =
  | Readonly<{ ok: true; serializedCharacters: number }>
  | Readonly<{ ok: false; error: WorkspaceStorageError }>;

const identifierSchema = z.string().trim().min(1).max(200);
const titleSchema = z.string().max(WORKSPACE_TITLE_LIMIT);
const sourceSchema = z.string().max(WORKSPACE_TEXT_LIMIT);
const codeSourceSchema = z.string().max(WORKSPACE_CODE_FILE_LIMIT);
const isoTimestampSchema = z.string().datetime({ offset: true });
const workspaceModeSchema = z.enum(workspaceModes);

const codeFilesSchema = z.object({
  html: codeSourceSchema,
  css: codeSourceSchema,
  javascript: codeSourceSchema,
}).strict();

const textByModeSchema = z.object({
  idea: sourceSchema,
  mindmap: sourceSchema,
  prompt: sourceSchema,
  brief: sourceSchema,
}).strict();

const workspaceDraftSchema = z.object({
  mode: workspaceModeSchema,
  title: titleSchema,
  text: sourceSchema,
  code: codeFilesSchema,
}).strict();

const workspaceVersionSchema = z.object({
  id: identifierSchema,
  name: z.string().max(240),
  createdAt: isoTimestampSchema,
  source: z.enum(["manual", "run", "agent", "restored"]),
  draft: workspaceDraftSchema,
}).strict();

const workspaceProjectContentSchema = z.object({
  mode: workspaceModeSchema,
  title: titleSchema,
  textByMode: textByModeSchema,
  code: codeFilesSchema,
  committedCode: codeFilesSchema,
  versions: z.array(workspaceVersionSchema).max(WORKSPACE_VERSION_LIMIT),
}).strict();

const workspaceProjectSchema = workspaceProjectContentSchema.extend({
  id: identifierSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}).strict().superRefine((project, context) => {
  const versionIds = new Set<string>();
  for (const [index, version] of project.versions.entries()) {
    if (versionIds.has(version.id)) {
      context.addIssue({
        code: "custom",
        path: ["versions", index, "id"],
        message: "Version identifiers must be unique within a project.",
      });
    }
    versionIds.add(version.id);
  }
});

const workspaceLibrarySchema = z.object({
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  revision: z.number().int().nonnegative().safe(),
  activeProjectId: identifierSchema,
  projects: z.array(workspaceProjectSchema)
    .min(1)
    .max(WORKSPACE_PROJECT_LIMIT),
}).strict().superRefine((library, context) => {
  const projectIds = new Set<string>();
  for (const [index, project] of library.projects.entries()) {
    if (projectIds.has(project.id)) {
      context.addIssue({
        code: "custom",
        path: ["projects", index, "id"],
        message: "Project identifiers must be unique within a library.",
      });
    }
    projectIds.add(project.id);
  }
  if (!projectIds.has(library.activeProjectId)) {
    context.addIssue({
      code: "custom",
      path: ["activeProjectId"],
      message: "The active project must exist in the project library.",
    });
  }
});

const workspaceBundleSchema = z.object({
  format: z.literal(WORKSPACE_BUNDLE_FORMAT),
  schemaVersion: z.literal(WORKSPACE_BUNDLE_SCHEMA_VERSION),
  exportedAt: isoTimestampSchema,
  project: workspaceProjectSchema,
}).strict();

const legacyWorkspaceSchema = z.object({
  mode: workspaceModeSchema,
  title: titleSchema,
  textByMode: textByModeSchema,
  code: codeFilesSchema,
  committedCode: codeFilesSchema.optional(),
  versions: z.array(workspaceVersionSchema)
    .max(WORKSPACE_VERSION_LIMIT)
    .optional(),
}).strict();

function makeId() {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: z.ZodError) {
  const first = error.issues[0];
  const location = first?.path.length ? ` at ${first.path.join(".")}` : "";
  return `Canvas data is invalid${location}${first?.message ? `: ${first.message}` : "."}`;
}

function asStorageError(error: unknown): WorkspaceStorageError {
  if (error instanceof WorkspaceStorageError) return error;
  const errorName =
    error !== null && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (
    errorName === "QuotaExceededError" ||
    errorName === "NS_ERROR_DOM_QUOTA_REACHED"
  ) {
    return new WorkspaceStorageError(
      "quota-exceeded",
      "This device has no remaining browser storage for the Canvas library.",
      { cause: error },
    );
  }
  return new WorkspaceStorageError(
    "storage-unavailable",
    "Canvas storage is unavailable in this browser context.",
    { cause: error },
  );
}

function parseJson(raw: string, limit: number, label: string): unknown {
  if (raw.length > limit) {
    throw new WorkspaceStorageError(
      "too-large",
      `${label} exceeds the supported local size limit.`,
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new WorkspaceStorageError(
      "invalid-json",
      `${label} is not valid JSON.`,
      { cause: error },
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new WorkspaceStorageError(
      "invalid-data",
      `${label} could not be read safely. ${errorMessage(parsed.error)}`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

export function cloneCodeFiles(code: CodeFiles): CodeFiles {
  return {
    html: code.html,
    css: code.css,
    javascript: code.javascript,
  };
}

export function cloneWorkspaceDraft(draft: WorkspaceDraft): WorkspaceDraft {
  return {
    mode: draft.mode,
    title: draft.title,
    text: draft.text,
    code: cloneCodeFiles(draft.code),
  };
}

export function cloneWorkspaceVersion(version: WorkspaceVersion): WorkspaceVersion {
  return {
    id: version.id,
    name: version.name,
    createdAt: version.createdAt,
    source: version.source,
    draft: cloneWorkspaceDraft(version.draft),
  };
}

export function cloneTextByMode(textByMode: TextByMode): TextByMode {
  return {
    idea: textByMode.idea,
    mindmap: textByMode.mindmap,
    prompt: textByMode.prompt,
    brief: textByMode.brief,
  };
}

export function cloneWorkspaceProject(project: WorkspaceProject): WorkspaceProject {
  return {
    id: project.id,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    mode: project.mode,
    title: project.title,
    textByMode: cloneTextByMode(project.textByMode),
    code: cloneCodeFiles(project.code),
    committedCode: cloneCodeFiles(project.committedCode),
    versions: project.versions.map(cloneWorkspaceVersion),
  };
}

export function cloneWorkspaceLibrary(library: WorkspaceLibraryV2): WorkspaceLibraryV2 {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    revision: library.revision,
    activeProjectId: library.activeProjectId,
    projects: library.projects.map(cloneWorkspaceProject),
  };
}

function cloneProjectContent(content: WorkspaceProjectContent): WorkspaceProjectContent {
  return {
    mode: content.mode,
    title: content.title,
    textByMode: cloneTextByMode(content.textByMode),
    code: cloneCodeFiles(content.code),
    committedCode: cloneCodeFiles(content.committedCode),
    versions: content.versions.map(cloneWorkspaceVersion),
  };
}

export function createWorkspaceProject(
  content: WorkspaceProjectContent,
  options: Readonly<{
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }> = {},
): WorkspaceProject {
  const validatedContent = parseWithSchema(
    workspaceProjectContentSchema,
    content,
    "Canvas project content",
  );
  const createdAt = options.createdAt ?? new Date().toISOString();
  const project: WorkspaceProject = {
    ...cloneProjectContent(validatedContent),
    id: options.id ?? makeId(),
    createdAt,
    updatedAt: options.updatedAt ?? createdAt,
  };
  return cloneWorkspaceProject(
    parseWithSchema(workspaceProjectSchema, project, "Canvas project"),
  );
}

export function createWorkspaceLibrary(
  project: WorkspaceProject,
  revision = 0,
): WorkspaceLibraryV2 {
  const library: WorkspaceLibraryV2 = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    revision,
    activeProjectId: project.id,
    projects: [cloneWorkspaceProject(project)],
  };
  return parseWorkspaceLibrary(JSON.stringify(library));
}

export function parseWorkspaceLibrary(raw: string): WorkspaceLibraryV2 {
  const value = parseJson(
    raw,
    WORKSPACE_LIBRARY_CHARACTER_LIMIT,
    "The Canvas project library",
  );
  const record = asRecord(value);
  if (record && record.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new WorkspaceStorageError(
      "unsupported-version",
      "This Canvas project library was created by an unsupported format version.",
    );
  }
  return cloneWorkspaceLibrary(
    parseWithSchema(workspaceLibrarySchema, value, "The Canvas project library"),
  );
}

export function serializeWorkspaceLibrary(library: WorkspaceLibraryV2): string {
  const validated = parseWithSchema(
    workspaceLibrarySchema,
    library,
    "The Canvas project library",
  );
  const serialized = JSON.stringify(validated);
  if (serialized.length > WORKSPACE_LIBRARY_CHARACTER_LIMIT) {
    throw new WorkspaceStorageError(
      "too-large",
      "The Canvas project library exceeds the supported local size limit.",
    );
  }
  return serialized;
}

export function migrateLegacyWorkspace(
  raw: string,
  options: Readonly<{ id?: string; now?: string }> = {},
): WorkspaceLibraryV2 {
  const value = parseJson(
    raw,
    WORKSPACE_LIBRARY_CHARACTER_LIMIT,
    "The legacy Canvas workspace",
  );
  const legacy = parseWithSchema(
    legacyWorkspaceSchema,
    value,
    "The legacy Canvas workspace",
  );
  const now = options.now ?? new Date().toISOString();
  const project = createWorkspaceProject(
    {
      mode: legacy.mode,
      title: legacy.title,
      textByMode: legacy.textByMode,
      code: legacy.code,
      committedCode: legacy.committedCode ?? legacy.code,
      versions: legacy.versions ?? [],
    },
    { id: options.id, createdAt: now, updatedAt: now },
  );
  return createWorkspaceLibrary(project);
}

export function loadWorkspaceLibrary(
  storage: WorkspaceStorageLike,
): WorkspaceLoadResult {
  let current: string | null;
  try {
    current = storage.getItem(WORKSPACE_STORAGE_KEY);
  } catch (error) {
    return { status: "error", source: "storage", error: asStorageError(error) };
  }

  if (current !== null) {
    try {
      return {
        status: "ready",
        source: "v2",
        library: parseWorkspaceLibrary(current),
        needsPersistence: false,
      };
    } catch (error) {
      return { status: "error", source: "v2", error: asStorageError(error) };
    }
  }

  let legacy: string | null;
  try {
    legacy = storage.getItem(LEGACY_WORKSPACE_STORAGE_KEY);
  } catch (error) {
    return { status: "error", source: "storage", error: asStorageError(error) };
  }
  if (legacy === null) return { status: "empty" };

  try {
    return {
      status: "ready",
      source: "v1-migration",
      library: migrateLegacyWorkspace(legacy),
      needsPersistence: true,
    };
  } catch (error) {
    return { status: "error", source: "v1", error: asStorageError(error) };
  }
}

export function saveWorkspaceLibrary(
  storage: WorkspaceStorageLike,
  library: WorkspaceLibraryV2,
): WorkspaceSaveResult {
  try {
    const serialized = serializeWorkspaceLibrary(library);
    storage.setItem(WORKSPACE_STORAGE_KEY, serialized);
    return { ok: true, serializedCharacters: serialized.length };
  } catch (error) {
    return { ok: false, error: asStorageError(error) };
  }
}

export function serializeWorkspaceProjectBundle(
  project: WorkspaceProject,
  exportedAt = new Date().toISOString(),
): string {
  const bundle: WorkspaceProjectBundle = {
    format: WORKSPACE_BUNDLE_FORMAT,
    schemaVersion: WORKSPACE_BUNDLE_SCHEMA_VERSION,
    exportedAt,
    project: cloneWorkspaceProject(project),
  };
  const validated = parseWithSchema(
    workspaceBundleSchema,
    bundle,
    "The Canvas project bundle",
  );
  const serialized = JSON.stringify(validated);
  if (serialized.length > WORKSPACE_BUNDLE_CHARACTER_LIMIT) {
    throw new WorkspaceStorageError(
      "too-large",
      "The Canvas project bundle exceeds the supported import and export size limit.",
    );
  }
  return serialized;
}

export function parseWorkspaceProjectBundle(raw: string): WorkspaceProjectBundle {
  const value = parseJson(
    raw,
    WORKSPACE_BUNDLE_CHARACTER_LIMIT,
    "The Canvas project bundle",
  );
  const record = asRecord(value);
  if (
    record &&
    (record.format !== WORKSPACE_BUNDLE_FORMAT ||
      record.schemaVersion !== WORKSPACE_BUNDLE_SCHEMA_VERSION)
  ) {
    throw new WorkspaceStorageError(
      "unsupported-version",
      "This file is not a supported Kingxford Canvas project bundle.",
    );
  }
  const bundle = parseWithSchema(
    workspaceBundleSchema,
    value,
    "The Canvas project bundle",
  );
  return {
    format: WORKSPACE_BUNDLE_FORMAT,
    schemaVersion: WORKSPACE_BUNDLE_SCHEMA_VERSION,
    exportedAt: bundle.exportedAt,
    project: cloneWorkspaceProject(bundle.project),
  };
}

export function importWorkspaceProjectBundle(
  raw: string,
  existingProjectIds: Iterable<string> = [],
  options: Readonly<{ id?: string; now?: string }> = {},
): WorkspaceProject {
  const bundle = parseWorkspaceProjectBundle(raw);
  const ids = new Set(existingProjectIds);
  if (ids.size >= WORKSPACE_PROJECT_LIMIT) {
    throw new WorkspaceStorageError(
      "project-limit",
      `Canvas supports up to ${WORKSPACE_PROJECT_LIMIT} local projects in this release.`,
    );
  }

  let id = options.id ?? makeId();
  if (ids.has(id)) {
    if (options.id) {
      throw new WorkspaceStorageError(
        "invalid-data",
        "The imported project identifier already exists in this Canvas library.",
      );
    }
    const baseId = id;
    let suffix = 2;
    do {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    } while (ids.has(id));
  }

  const now = options.now ?? new Date().toISOString();
  return createWorkspaceProject(
    {
      mode: bundle.project.mode,
      title: bundle.project.title,
      textByMode: bundle.project.textByMode,
      code: bundle.project.code,
      committedCode: bundle.project.committedCode,
      versions: bundle.project.versions,
    },
    { id, createdAt: now, updatedAt: now },
  );
}
