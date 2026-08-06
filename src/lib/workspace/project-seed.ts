export const PROJECT_SEED_STORAGE_KEY = "kingxford:project-seed:v1";
export const PROJECT_SEED_VERSION = 1 as const;
export const PROJECT_SEED_MAX_CHARACTERS = 12_000;
export const PROJECT_SEED_MAX_TTL_MS = 12 * 60 * 60 * 1000;

export type ProjectSeedAction = "start-project" | "add-evidence";
export type ProjectSeedSourceKind =
  | "idea-router"
  | "work"
  | "media"
  | "lab"
  | "create";

export type ProjectSeedEvidence = Readonly<{
  title: string;
  content: string;
  sourceUrl?: string;
}>;

export type ProjectSeed = Readonly<{
  version: typeof PROJECT_SEED_VERSION;
  id: string;
  createdAt: number;
  expiresAt: number;
  action: ProjectSeedAction;
  source: Readonly<{
    kind: ProjectSeedSourceKind;
    href: string;
    label: string;
  }>;
  payload: Readonly<{
    title: string;
    brief: string;
    evidence?: readonly ProjectSeedEvidence[];
    tags?: readonly string[];
  }>;
}>;

export type ProjectSeedInput = Readonly<{
  action: ProjectSeedAction;
  source: ProjectSeed["source"];
  payload: ProjectSeed["payload"];
}>;

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const sourceKinds: readonly ProjectSeedSourceKind[] = [
  "idea-router",
  "work",
  "media",
  "lab",
  "create",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isBoundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minimum &&
    value.length <= maximum
  );
}

function isSafeInternalHref(value: unknown) {
  return (
    isBoundedString(value, 1, 320) &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\u0000-\u001f]/.test(value)
  );
}

function isSafeSourceUrl(value: unknown) {
  if (typeof value === "undefined") return true;
  if (!isBoundedString(value, 1, 600)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isEvidence(value: unknown): value is ProjectSeedEvidence {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ["title", "content", "sourceUrl"])) return false;
  return (
    isBoundedString(value.title, 1, 180) &&
    isBoundedString(value.content, 1, 2_400) &&
    isSafeSourceUrl(value.sourceUrl)
  );
}

function isProjectSeedShape(value: unknown, now: number): value is ProjectSeed {
  if (!isRecord(value)) return false;
  if (
    !hasOnlyKeys(value, [
      "version",
      "id",
      "createdAt",
      "expiresAt",
      "action",
      "source",
      "payload",
    ])
  ) {
    return false;
  }
  if (value.version !== PROJECT_SEED_VERSION) return false;
  if (!isBoundedString(value.id, 8, 100)) return false;
  if (value.action !== "start-project" && value.action !== "add-evidence") {
    return false;
  }
  if (
    typeof value.createdAt !== "number" ||
    !Number.isFinite(value.createdAt) ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt) ||
    value.createdAt > now + 60_000 ||
    value.expiresAt <= now ||
    value.expiresAt <= value.createdAt ||
    value.expiresAt - value.createdAt > PROJECT_SEED_MAX_TTL_MS
  ) {
    return false;
  }
  if (!isRecord(value.source) || !isRecord(value.payload)) return false;
  if (!hasOnlyKeys(value.source, ["kind", "href", "label"])) return false;
  if (!sourceKinds.includes(value.source.kind as ProjectSeedSourceKind)) {
    return false;
  }
  if (
    !isSafeInternalHref(value.source.href) ||
    !isBoundedString(value.source.label, 1, 160)
  ) {
    return false;
  }
  if (!hasOnlyKeys(value.payload, ["title", "brief", "evidence", "tags"])) {
    return false;
  }
  if (
    !isBoundedString(value.payload.title, 1, 180) ||
    !isBoundedString(value.payload.brief, 1, 6_000)
  ) {
    return false;
  }
  if (
    typeof value.payload.evidence !== "undefined" &&
    (!Array.isArray(value.payload.evidence) ||
      value.payload.evidence.length > 6 ||
      !value.payload.evidence.every(isEvidence))
  ) {
    return false;
  }
  if (
    typeof value.payload.tags !== "undefined" &&
    (!Array.isArray(value.payload.tags) ||
      value.payload.tags.length > 12 ||
      !value.payload.tags.every((tag) => isBoundedString(tag, 1, 48)))
  ) {
    return false;
  }

  try {
    return JSON.stringify(value).length <= PROJECT_SEED_MAX_CHARACTERS;
  } catch {
    return false;
  }
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function createProjectSeed(
  input: ProjectSeedInput,
  now = Date.now(),
): ProjectSeed | null {
  const seed: ProjectSeed = {
    version: PROJECT_SEED_VERSION,
    id: makeId(),
    createdAt: now,
    expiresAt: now + PROJECT_SEED_MAX_TTL_MS,
    action: input.action,
    source: input.source,
    payload: input.payload,
  };

  return isProjectSeedShape(seed, now) ? seed : null;
}

export function writeProjectSeed(
  input: ProjectSeedInput,
  storage: StorageLike | null = browserStorage(),
): ProjectSeed | null {
  if (!storage) return null;
  const seed = createProjectSeed(input);
  if (!seed) return null;

  try {
    storage.setItem(PROJECT_SEED_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  } catch {
    return null;
  }
}

export function parseProjectSeed(
  raw: string | null,
  now = Date.now(),
): ProjectSeed | null {
  if (!raw || raw.length > PROJECT_SEED_MAX_CHARACTERS) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProjectSeedShape(parsed, now) ? parsed : null;
  } catch {
    return null;
  }
}

export function readProjectSeed(
  storage: StorageLike | null = browserStorage(),
): ProjectSeed | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PROJECT_SEED_STORAGE_KEY);
    const seed = parseProjectSeed(raw);
    if (!seed && raw) storage.removeItem(PROJECT_SEED_STORAGE_KEY);
    return seed;
  } catch {
    return null;
  }
}

export function clearProjectSeed(
  expectedId?: string,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return false;
  try {
    if (expectedId) {
      const current = readProjectSeed(storage);
      if (!current || current.id !== expectedId) return false;
    }
    storage.removeItem(PROJECT_SEED_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
