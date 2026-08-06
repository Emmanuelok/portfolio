export const platformPhases = [
  "discovery",
  "evidence",
  "systems",
  "prototype",
  "validation",
  "delivery",
] as const;

export type PlatformPhase = (typeof platformPhases)[number];

/**
 * Phase identifiers shipped by the first unified-platform preview. They are
 * accepted only at legacy persistence and URL boundaries, then immediately
 * rewritten to the canonical Atlas identifiers above.
 */
export const legacyPlatformPhaseAliases = {
  discover: "discovery",
  investigate: "evidence",
  model: "systems",
  build: "prototype",
  validate: "validation",
  launch: "delivery",
} as const satisfies Readonly<Record<string, PlatformPhase>>;

export type LegacyPlatformPhase = keyof typeof legacyPlatformPhaseAliases;

export function isLegacyPlatformPhase(
  value: unknown,
): value is LegacyPlatformPhase {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(legacyPlatformPhaseAliases, value)
  );
}

export function normalizePlatformPhase(value: unknown): PlatformPhase | null {
  if (typeof value !== "string") return null;
  if ((platformPhases as readonly string[]).includes(value)) {
    return value as PlatformPhase;
  }
  return isLegacyPlatformPhase(value)
    ? legacyPlatformPhaseAliases[value]
    : null;
}

export const platformAgentRoles = [
  "conductor",
  "discovery",
  "evidence",
  "systems",
  "prototype",
  "validation",
  "delivery",
] as const;

export type PlatformAgentRole = (typeof platformAgentRoles)[number];

export const platformArtifactRelations = [
  "derived-from",
  "informs",
  "challenges",
  "depends-on",
  "validates",
  "supersedes",
] as const;

export type PlatformArtifactRelation =
  (typeof platformArtifactRelations)[number];

export const platformEvidenceKinds = [
  "platform",
  "url",
  "note",
  "file",
] as const;

export type PlatformEvidenceKind = (typeof platformEvidenceKinds)[number];

export const platformDecisionStatuses = [
  "open",
  "accepted",
  "revisit",
] as const;

export type PlatformDecisionStatus =
  (typeof platformDecisionStatuses)[number];

export const platformAgentRunSources = ["openai", "local"] as const;

export type PlatformAgentRunSource =
  (typeof platformAgentRunSources)[number];

export type PlatformPoint = Readonly<{
  x: number;
  y: number;
}>;

export type PlatformMapViewState = Readonly<{
  zoom: number;
  pan: PlatformPoint;
  nodeOffsets: Readonly<Record<string, PlatformPoint>>;
}>;

export type PlatformArtifactRelationship = Readonly<{
  id: string;
  fromArtifactId: string;
  toArtifactId: string;
  relation: PlatformArtifactRelation;
  label: string;
  createdAt: string;
}>;

export type PlatformEvidenceReference = Readonly<{
  id: string;
  kind: PlatformEvidenceKind;
  title: string;
  source: string;
  claim: string;
  addedAt: string;
}>;

export type PlatformDecision = Readonly<{
  id: string;
  title: string;
  decision: string;
  rationale: string;
  status: PlatformDecisionStatus;
  relatedArtifactIds: readonly string[];
  createdAt: string;
}>;

/**
 * A record of an Agent result the user deliberately accepted. Rejected,
 * incomplete, and merely viewed results do not belong in this ledger.
 */
export type PlatformAcceptedAgentRun = Readonly<{
  id: string;
  role: PlatformAgentRole;
  phase: PlatformPhase;
  source: PlatformAgentRunSource;
  model: string;
  protocolVersion: string;
  inputDigest: string;
  summary: string;
  artifactIds: readonly string[];
  acceptedAt: string;
}>;

/**
 * Additive intelligence associated with an existing Canvas project. Canvas
 * remains the authority for editable source and versions; this record carries
 * the cross-platform relationships, evidence, decisions, and provenance.
 */
export type PlatformProjectIntelligence = Readonly<{
  projectId: string;
  objective: string;
  phase: PlatformPhase;
  artifactRelationships: readonly PlatformArtifactRelationship[];
  evidence: readonly PlatformEvidenceReference[];
  decisions: readonly PlatformDecision[];
  agentRuns: readonly PlatformAcceptedAgentRun[];
  mapView: PlatformMapViewState | null;
  updatedAt: string;
}>;

export type PlatformSidecarV1 = Readonly<{
  schemaVersion: 1;
  revision: number;
  projects: Readonly<Record<string, PlatformProjectIntelligence>>;
}>;

export type PlatformChangeReason =
  | "saved"
  | "removed"
  | "reloaded"
  | "recovered";

export type PlatformChangeDetail = Readonly<{
  revision: number;
  projectId: string | null;
  reason: PlatformChangeReason;
}>;
