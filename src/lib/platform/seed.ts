import { workspaceModes, type WorkspaceMode } from "@/lib/workspace/types";
import { platformPhases, type PlatformPhase } from "@/lib/platform/types";

export const PLATFORM_SEED_STORAGE_KEY = "kingxford:platform-seed:v1";
export const PLATFORM_SEED_SCHEMA_VERSION = 1 as const;
export const PLATFORM_SEED_CHARACTER_LIMIT = 8_000;
export const PLATFORM_SEED_INPUT_LIMIT = 6_000;
export const PLATFORM_SEED_TITLE_LIMIT = 120;

export const platformSeedSources = [
  "home-nexus",
  "idea-router",
  "platform",
  "lab",
  "work",
  "media",
  "showcase",
] as const;

export type PlatformSeedSource = (typeof platformSeedSources)[number];

export type PlatformSeedV1 = Readonly<{
  schemaVersion: 1;
  id: string;
  createdAt: string;
  title: string;
  input: string;
  phase: PlatformPhase;
  mode: WorkspaceMode;
  source: PlatformSeedSource;
}>;

export type PlatformSeedStorageLike = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}>;

export type PlatformSeedErrorCode =
  | "invalid-json"
  | "invalid-data"
  | "unsupported-version"
  | "too-large"
  | "storage-unavailable";

export class PlatformSeedError extends Error {
  readonly code: PlatformSeedErrorCode;

  constructor(
    code: PlatformSeedErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PlatformSeedError";
    this.code = code;
  }
}

export type PlatformSeedReadResult =
  | Readonly<{ status: "ready"; seed: PlatformSeedV1 }>
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "error"; error: PlatformSeedError }>;

export type PlatformSeedWriteResult =
  | Readonly<{ ok: true; serializedCharacters: number }>
  | Readonly<{ ok: false; error: PlatformSeedError }>;

function invalid(path: string, message: string): never {
  throw new PlatformSeedError(
    "invalid-data",
    `Project start data is invalid at ${path}: ${message}`,
  );
}

function record(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid("root", "expected an object.");
  }
  return value as Record<string, unknown>;
}

function stringValue(
  value: unknown,
  path: string,
  maximum: number,
  allowEmpty = false,
) {
  if (typeof value !== "string") invalid(path, "expected text.");
  if (!allowEmpty && !value.trim()) invalid(path, "text cannot be empty.");
  if (value.length > maximum) {
    invalid(path, `text exceeds ${maximum.toLocaleString()} characters.`);
  }
  return value;
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    invalid(path, `expected one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

function validateSeed(value: unknown): PlatformSeedV1 {
  const candidate = record(value);
  const expectedKeys = [
    "schemaVersion",
    "id",
    "createdAt",
    "title",
    "input",
    "phase",
    "mode",
    "source",
  ] as const;
  const unexpected = Object.keys(candidate).find(
    (key) => !expectedKeys.includes(key as (typeof expectedKeys)[number]),
  );
  const missing = expectedKeys.find(
    (key) => !Object.prototype.hasOwnProperty.call(candidate, key),
  );
  if (unexpected) invalid("root", `unexpected field '${unexpected}'.`);
  if (missing) invalid("root", `missing field '${missing}'.`);
  if (candidate.schemaVersion !== PLATFORM_SEED_SCHEMA_VERSION) {
    throw new PlatformSeedError(
      "unsupported-version",
      "This project start was created by an unsupported format version.",
    );
  }

  const id = stringValue(candidate.id, "root.id", 200);
  if (id !== id.trim() || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
    invalid("root.id", "expected a stable identifier.");
  }
  const createdAt = stringValue(candidate.createdAt, "root.createdAt", 64);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt) ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    invalid("root.createdAt", "expected an ISO-8601 timestamp with a timezone.");
  }

  return {
    schemaVersion: PLATFORM_SEED_SCHEMA_VERSION,
    id,
    createdAt,
    title: stringValue(
      candidate.title,
      "root.title",
      PLATFORM_SEED_TITLE_LIMIT,
      true,
    ),
    input: stringValue(
      candidate.input,
      "root.input",
      PLATFORM_SEED_INPUT_LIMIT,
    ),
    phase: enumValue(candidate.phase, "root.phase", platformPhases),
    mode: enumValue(candidate.mode, "root.mode", workspaceModes),
    source: enumValue(candidate.source, "root.source", platformSeedSources),
  };
}

function asSeedError(error: unknown): PlatformSeedError {
  if (error instanceof PlatformSeedError) return error;
  return new PlatformSeedError(
    "storage-unavailable",
    "Project start storage is unavailable in this browser context.",
    { cause: error },
  );
}

function makeId() {
  return typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function seedTitle(input: string) {
  const firstLine = input
    .trim()
    .split(/\r?\n/, 1)[0]
    .replace(/\s+/g, " ");
  return firstLine.slice(0, PLATFORM_SEED_TITLE_LIMIT);
}

export function createPlatformSeed(
  input: string,
  options: Readonly<{
    id?: string;
    now?: string;
    title?: string;
    phase?: PlatformPhase;
    mode?: WorkspaceMode;
    source?: PlatformSeedSource;
  }> = {},
): PlatformSeedV1 {
  return validateSeed({
    schemaVersion: PLATFORM_SEED_SCHEMA_VERSION,
    id: options.id ?? makeId(),
    createdAt: options.now ?? new Date().toISOString(),
    title: options.title ?? seedTitle(input),
    input,
    phase: options.phase ?? "discover",
    mode: options.mode ?? "idea",
    source: options.source ?? "platform",
  });
}

export function parsePlatformSeed(raw: string): PlatformSeedV1 {
  if (raw.length > PLATFORM_SEED_CHARACTER_LIMIT) {
    throw new PlatformSeedError(
      "too-large",
      "This project start exceeds the supported session size.",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new PlatformSeedError(
      "invalid-json",
      "This project start is not valid JSON.",
      { cause: error },
    );
  }
  return validateSeed(value);
}

export function serializePlatformSeed(seed: PlatformSeedV1) {
  const serialized = JSON.stringify(validateSeed(seed));
  if (serialized.length > PLATFORM_SEED_CHARACTER_LIMIT) {
    throw new PlatformSeedError(
      "too-large",
      "This project start exceeds the supported session size.",
    );
  }
  return serialized;
}

export function readPlatformSeed(
  storage: PlatformSeedStorageLike,
): PlatformSeedReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(PLATFORM_SEED_STORAGE_KEY);
  } catch (error) {
    return { status: "error", error: asSeedError(error) };
  }
  if (raw === null) return { status: "empty" };
  try {
    return { status: "ready", seed: parsePlatformSeed(raw) };
  } catch (error) {
    return { status: "error", error: asSeedError(error) };
  }
}

export function writePlatformSeed(
  storage: PlatformSeedStorageLike,
  seed: PlatformSeedV1,
): PlatformSeedWriteResult {
  try {
    const serialized = serializePlatformSeed(seed);
    storage.setItem(PLATFORM_SEED_STORAGE_KEY, serialized);
    return { ok: true, serializedCharacters: serialized.length };
  } catch (error) {
    return { ok: false, error: asSeedError(error) };
  }
}

/**
 * Reads and validates before removing. Invalid data is deliberately retained
 * so callers can report or recover it rather than silently destroying it.
 */
export function consumePlatformSeed(
  storage: PlatformSeedStorageLike,
): PlatformSeedReadResult {
  const result = readPlatformSeed(storage);
  if (result.status !== "ready") return result;
  try {
    storage.removeItem(PLATFORM_SEED_STORAGE_KEY);
    return result;
  } catch (error) {
    return { status: "error", error: asSeedError(error) };
  }
}
