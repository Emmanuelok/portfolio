import type { AgentLens } from "./lenses";

export const workspaceModes = ["idea", "code", "mindmap", "prompt", "brief"] as const;

export type WorkspaceMode = (typeof workspaceModes)[number];

// Compatibility contract for the original unified intelligence branch. The
// Project Atlas uses AgentLens for new review records, while the orchestrated
// runtime retains these stable role identifiers for imported local bundles.
export const workspaceAgentRoles = [
  "conductor",
  "discovery",
  "evidence",
  "systems",
  "prototype",
  "validation",
  "delivery",
] as const;

export type WorkspaceAgentRole = (typeof workspaceAgentRoles)[number];

export type CodeFiles = Readonly<{
  html: string;
  css: string;
  javascript: string;
}>;

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

export type TextWorkspaceMode = Exclude<WorkspaceMode, "code">;

export type TextByMode = Readonly<Record<TextWorkspaceMode, string>>;

/**
 * Legacy Canvas-v2 bundle types remain readable so projects created by the
 * unified-create-system branch can be migrated into Project Atlas without
 * losing local content or revision history.
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
  proposedCode?: CodeFiles;
  buildBrief: Readonly<{
    title: string;
    oneLine: string;
    audience: string;
    coreExperience: string;
    deliverables: readonly string[];
    complexity: "Focused" | "Layered" | "Advanced";
  }>;
}>;

export type AgentProjectContext = Readonly<{
  projectId: string;
  snapshotId: string;
  snapshotHash: string;
  snapshotSchemaVersion: number;
  snapshotCharacterCount: number;
  artifactRevisionId?: string;
  artifactId?: string;
  draftHash?: string;
  counts: Readonly<{
    nodes: number;
    edges: number;
    artifacts: number;
    revisions: number;
    reviews: number;
    decisions: number;
    gates: number;
  }>;
}>;

export type AgentReviewResponse = Readonly<{
  review: AgentReview;
  source: "openai" | "local";
  model: string;
  protocolVersion: string;
  agent: Readonly<{
    id: AgentLens;
    label: string;
  }>;
  grounding: readonly Readonly<{
    id: string;
    title: string;
  }>[];
  request: Readonly<{
    id: string;
    durationMs: number;
    depth: "standard" | "deep";
  }>;
  projectContext?: AgentProjectContext;
  usage?: Readonly<{
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  }>;
  limits?: Readonly<{
    minuteRemaining: number;
    minuteResetsAt: string;
    dailyCreditsRemaining: number;
    dailyResetsAt: string;
    creditCost: number;
  }>;
  notice?: string;
}>;

export type AgentReviewRecord = Readonly<{
  id: string;
  createdAt: string;
  projectTitle: string;
  mode: WorkspaceMode;
  instruction: string;
  response: AgentReviewResponse;
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
