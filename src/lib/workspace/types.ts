export const workspaceModes = ["idea", "code", "mindmap", "prompt", "brief"] as const;

export type WorkspaceMode = (typeof workspaceModes)[number];

export type CodeFiles = Readonly<{
  html: string;
  css: string;
  javascript: string;
}>;

export type TextWorkspaceMode = Exclude<WorkspaceMode, "code">;

export type TextByMode = Readonly<Record<TextWorkspaceMode, string>>;

export type WorkspaceDraft = Readonly<{
  mode: WorkspaceMode;
  title: string;
  text: string;
  code: CodeFiles;
}>;

export type WorkspaceVersion = Readonly<{
  id: string;
  name: string;
  createdAt: string;
  source: "manual" | "run" | "agent" | "restored";
  draft: WorkspaceDraft;
}>;

/**
 * The complete editable content of one Canvas project. `WorkspaceDraft` remains
 * the intentionally smaller active-mode view consumed by previews and agents.
 */
export type WorkspaceProjectContent = Readonly<{
  mode: WorkspaceMode;
  title: string;
  textByMode: TextByMode;
  code: CodeFiles;
  committedCode: CodeFiles;
  versions: readonly WorkspaceVersion[];
}>;

export type WorkspaceProject = Readonly<{
  id: string;
  createdAt: string;
  updatedAt: string;
}> & WorkspaceProjectContent;

export type WorkspaceLibraryV2 = Readonly<{
  schemaVersion: 2;
  revision: number;
  activeProjectId: string;
  projects: readonly WorkspaceProject[];
}>;

export type WorkspaceProjectBundle = Readonly<{
  format: "kingxford-canvas-project";
  schemaVersion: 1;
  exportedAt: string;
  project: WorkspaceProject;
}>;

export type AgentReview = Readonly<{
  summary: string;
  status: "Strong" | "Developing" | "Unresolved";
  strengths: readonly string[];
  uncertainties: readonly string[];
  failurePoints: readonly string[];
  assumptions: readonly string[];
  nextTest: string;
  proposedChanges: readonly string[];
  improvedInput: string;
  improvedCode: CodeFiles | null;
  buildBrief: Readonly<{
    title: string;
    oneLine: string;
    audience: string;
    coreExperience: string;
    deliverables: readonly string[];
    complexity: "Focused" | "Layered" | "Advanced";
  }>;
}>;

export type AgentReviewResponse = Readonly<{
  review: AgentReview;
  source: "openai" | "local";
  model: string;
  protocolVersion: string;
  inputDigest: string;
  notice?: string;
}>;

export type ParsedConcept = Readonly<{
  title: string;
  purpose: string;
  audience: string;
  problem: string;
  change: string;
  constraints: string;
  evidence: string;
}>;

export type MindMapNode = Readonly<{
  id: string;
  label: string;
  children: readonly MindMapNode[];
}>;
