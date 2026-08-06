import { z } from "zod";

import { workspaceAgentRoles } from "@/lib/workspace/types";

const boundedText = z.string().max(48_000);
const shortText = z.string().max(4_000);
const codeFiles = z.object({
  html: z.string().max(16_000),
  css: z.string().max(16_000),
  javascript: z.string().max(16_000),
}).strict();

export const agentReviewResponseSchema = z.object({
  review: z.object({
    summary: shortText,
    status: z.enum(["Strong", "Developing", "Unresolved"]),
    strengths: z.array(shortText).max(8),
    uncertainties: z.array(shortText).max(8),
    failurePoints: z.array(shortText).max(8),
    assumptions: z.array(shortText).max(8),
    nextTest: shortText,
    proposedChanges: z.array(shortText).max(10),
    improvedInput: boundedText,
    improvedCode: codeFiles.nullable(),
    buildBrief: z.object({
      title: z.string().max(240),
      oneLine: shortText,
      audience: shortText,
      coreExperience: shortText,
      deliverables: z.array(shortText).max(10),
      complexity: z.enum(["Focused", "Layered", "Advanced"]),
    }).strict(),
  }).strict(),
  source: z.enum(["openai", "local"]),
  model: z.string().min(1).max(200),
  protocolVersion: z.string().min(1).max(200),
  inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
  agentRole: z.enum(workspaceAgentRoles),
  notice: z.string().max(2_000).optional(),
}).strict();
