export const workspaceModes = ["idea", "code", "mindmap", "prompt", "brief"] as const;

export type WorkspaceMode = (typeof workspaceModes)[number];

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
