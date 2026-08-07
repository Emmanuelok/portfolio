import { createHmac } from "node:crypto";

import { Redis } from "@upstash/redis";

export type ContactRateLimitEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type ContactAbuseProtectionBackend = Readonly<{
  kind: "upstash-redis" | "process-memory" | "missing";
  configured: boolean;
  durable: boolean;
  ready: boolean;
}>;

export const CONTACT_RATE_LIMIT_POLICY = {
  submissionsPerTenMinutes: 3,
  submissionsPerDay: 8,
} as const;

const REQUIRED_HASH_SALT_CHARACTERS = 32;
const WINDOW_MS = 10 * 60 * 1_000;
const KEY_TTL_GRACE_MS = 60 * 60 * 1_000;
const RESERVATION_TTL_MS = 25 * 60 * 60 * 1_000;
const PENDING_RESERVATION_MS = 60 * 1_000;
const MAX_LOCAL_BUCKETS = 2_048;
const LOCAL_OVERFLOW_BUCKETS = 64;
const MAX_LOCAL_RESERVATIONS_PER_BUCKET = 32;
const MAX_LOCAL_CLEANUP_SCAN = 256;

type ReservationMarker = {
  state: "pending" | "delivered" | "retry";
  attemptId: string;
  deliveryAttempts: number;
  pendingUntil: number;
  expiresAt: number;
};

type LocalBucket = {
  windowCount: number;
  windowResetsAt: number;
  dailyCount: number;
  dailyResetsAt: number;
  lastSeenAt: number;
  reservations: Map<string, ReservationMarker>;
};

type LocalStore = Map<string, LocalBucket>;

const localStoreSymbol = Symbol.for("kingxford.contact.rate-limit.v1");
const localOverflowPrefix = "__kingxford-contact-overflow-";

export type ContactRateLimitLease = Readonly<{
  backend: "upstash-redis" | "process-memory";
  visitorKey: string;
  reservationKey: string;
  attemptId: string;
  pendingUntil: number;
  deliveryAttempt: number;
}>;

export type ContactRateLimitDecision =
  | Readonly<{
      allowed: true;
      replayed: boolean;
      remaining: Readonly<{
        tenMinute: number;
        daily: number;
      }>;
      lease?: ContactRateLimitLease;
    }>
  | Readonly<{
      allowed: false;
      reason:
        | "ten-minute"
        | "daily"
        | "in-flight"
        | "duplicate"
        | "unavailable";
      retryAfter: number;
    }>;

function nextUtcDay(now: number) {
  const date = new Date(now);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
}

function windowReset(now: number) {
  return (Math.floor(now / WINDOW_MS) + 1) * WINDOW_MS;
}

function completeRedisCredentials(environment: ContactRateLimitEnvironment) {
  const url =
    environment.UPSTASH_REDIS_REST_URL?.trim() ||
    environment.KV_REST_API_URL?.trim();
  const token =
    environment.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    environment.KV_REST_API_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

export function contactUsageHashSalt(
  environment: ContactRateLimitEnvironment = process.env,
) {
  const value = environment.KINGXFORD_USAGE_HASH_SALT?.trim();
  return value && value.length >= REQUIRED_HASH_SALT_CHARACTERS ? value : null;
}

export function contactAbuseProtectionBackend(
  environment: ContactRateLimitEnvironment = process.env,
): ContactAbuseProtectionBackend {
  const salt = contactUsageHashSalt(environment);
  const redis = completeRedisCredentials(environment);

  if (salt && redis) {
    return {
      kind: "upstash-redis",
      configured: true,
      durable: true,
      ready: true,
    };
  }

  const sharedDeployment =
    environment.VERCEL === "1" || environment.NODE_ENV === "production";
  if (
    !sharedDeployment &&
    salt &&
    environment.KINGXFORD_ALLOW_EPHEMERAL_CONTACT === "1"
  ) {
    return {
      kind: "process-memory",
      configured: false,
      durable: false,
      ready: true,
    };
  }

  return {
    kind: "missing",
    configured: false,
    durable: false,
    ready: false,
  };
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

/**
 * Produces the only visitor identifier used by the contact limiter. Raw
 * network and browser headers remain request-local and are never logged or
 * written to Redis/process storage.
 */
export function deriveContactVisitorKey(request: Request, salt: string) {
  const address = (
    firstForwardedValue(request.headers.get("x-forwarded-for")) ||
    request.headers.get("x-real-ip")
  )?.slice(0, 256);
  const userAgent = (request.headers.get("user-agent") || "agent-unavailable")
    .trim()
    .slice(0, 256);

  return createHmac("sha256", salt)
    .update("kingxford-contact-visitor-v1\0")
    .update(address ? `network\0${address}` : `fallback\0${userAgent}`)
    .digest("hex");
}

export function deriveContactReservationKey(
  deliveryIdempotencyKey: string,
  salt: string,
) {
  return createHmac("sha256", salt)
    .update("kingxford-contact-reservation-v1\0")
    .update(deliveryIdempotencyKey)
    .digest("hex");
}

function freshLocalBucket(now: number): LocalBucket {
  return {
    windowCount: 0,
    windowResetsAt: windowReset(now),
    dailyCount: 0,
    dailyResetsAt: nextUtcDay(now),
    lastSeenAt: now,
    reservations: new Map(),
  };
}

function localStore() {
  const root = globalThis as typeof globalThis & {
    [localStoreSymbol]?: LocalStore;
  };
  root[localStoreSymbol] ??= new Map();
  return root[localStoreSymbol];
}

function stableOverflowIndex(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % LOCAL_OVERFLOW_BUCKETS;
}

function localOverflowKey(visitorKey: string) {
  return `${localOverflowPrefix}${stableOverflowIndex(visitorKey)}`;
}

function normalizeLocalBucket(bucket: LocalBucket, now: number) {
  if (bucket.windowResetsAt <= now) {
    bucket.windowCount = 0;
    bucket.windowResetsAt = windowReset(now);
  }
  if (bucket.dailyResetsAt <= now) {
    bucket.dailyCount = 0;
    bucket.dailyResetsAt = nextUtcDay(now);
  }
  for (const [key, marker] of bucket.reservations) {
    if (marker.expiresAt <= now) bucket.reservations.delete(key);
  }
  bucket.lastSeenAt = now;
  return bucket;
}

function cleanupLocalStore(store: LocalStore, now: number) {
  let scanned = 0;
  for (const [key, bucket] of store) {
    if (scanned >= MAX_LOCAL_CLEANUP_SCAN) break;
    scanned += 1;
    if (
      !key.startsWith(localOverflowPrefix) &&
      bucket.dailyResetsAt + KEY_TTL_GRACE_MS <= now
    ) {
      store.delete(key);
    }
  }
}

function resolveLocalBucket(visitorKey: string, now: number) {
  const store = localStore();
  cleanupLocalStore(store, now);
  const existing = store.get(visitorKey);
  if (existing) return normalizeLocalBucket(existing, now);

  if (store.size < MAX_LOCAL_BUCKETS) {
    const bucket = freshLocalBucket(now);
    store.set(visitorKey, bucket);
    return bucket;
  }

  // Once the bounded store is full, unseen visitors share a stable bucket.
  // This deliberately tightens the allowance under a cardinality attack.
  const overflowKey = localOverflowKey(visitorKey);
  const bucket = store.get(overflowKey) ?? freshLocalBucket(now);
  store.set(overflowKey, bucket);
  return normalizeLocalBucket(bucket, now);
}

function remaining(windowCount: number, dailyCount: number) {
  return {
    tenMinute: Math.max(
      0,
      CONTACT_RATE_LIMIT_POLICY.submissionsPerTenMinutes - windowCount,
    ),
    daily: Math.max(
      0,
      CONTACT_RATE_LIMIT_POLICY.submissionsPerDay - dailyCount,
    ),
  };
}

function trimLocalReservations(bucket: LocalBucket) {
  if (bucket.reservations.size < MAX_LOCAL_RESERVATIONS_PER_BUCKET) return;
  for (const [key, marker] of bucket.reservations) {
    if (bucket.reservations.size < MAX_LOCAL_RESERVATIONS_PER_BUCKET) break;
    if (marker.state !== "pending") bucket.reservations.delete(key);
  }
}

function beginLocalContactSubmission(input: ResolvedContactRateLimitInput) {
  const bucket = resolveLocalBucket(input.visitorKey, input.now);
  const marker = bucket.reservations.get(input.reservationKey);
  const pendingUntil = input.now + PENDING_RESERVATION_MS;
  const deliveryAttempt = marker ? marker.deliveryAttempts + 1 : 1;
  const lease: ContactRateLimitLease = {
    backend: "process-memory",
    visitorKey: input.visitorKey,
    reservationKey: input.reservationKey,
    attemptId: input.attemptId,
    pendingUntil,
    deliveryAttempt,
  };

  if (marker?.state === "delivered") {
    return {
      allowed: true as const,
      replayed: true,
      remaining: remaining(bucket.windowCount, bucket.dailyCount),
    };
  }
  if (marker?.state === "pending" && marker.pendingUntil > input.now) {
    return {
      allowed: false as const,
      reason: "in-flight" as const,
      retryAfter: Math.max(
        1,
        Math.ceil((marker.pendingUntil - input.now) / 1_000),
      ),
    };
  }
  if (marker) {
    if (marker.deliveryAttempts >= 2) {
      return {
        allowed: false as const,
        reason: "duplicate" as const,
        retryAfter: Math.max(
          1,
          Math.ceil((bucket.dailyResetsAt - input.now) / 1_000),
        ),
      };
    }
    bucket.reservations.set(input.reservationKey, {
      state: "pending",
      attemptId: input.attemptId,
      deliveryAttempts: deliveryAttempt,
      pendingUntil,
      expiresAt: input.now + RESERVATION_TTL_MS,
    });
    return {
      allowed: true as const,
      replayed: false,
      remaining: remaining(bucket.windowCount, bucket.dailyCount),
      lease,
    };
  }

  if (
    bucket.windowCount >= CONTACT_RATE_LIMIT_POLICY.submissionsPerTenMinutes
  ) {
    return {
      allowed: false as const,
      reason: "ten-minute" as const,
      retryAfter: Math.max(
        1,
        Math.ceil((bucket.windowResetsAt - input.now) / 1_000),
      ),
    };
  }
  if (bucket.dailyCount >= CONTACT_RATE_LIMIT_POLICY.submissionsPerDay) {
    return {
      allowed: false as const,
      reason: "daily" as const,
      retryAfter: Math.max(
        1,
        Math.ceil((bucket.dailyResetsAt - input.now) / 1_000),
      ),
    };
  }

  bucket.windowCount += 1;
  bucket.dailyCount += 1;
  trimLocalReservations(bucket);
  bucket.reservations.set(input.reservationKey, {
    state: "pending",
    attemptId: input.attemptId,
    deliveryAttempts: deliveryAttempt,
    pendingUntil,
    expiresAt: input.now + RESERVATION_TTL_MS,
  });

  return {
    allowed: true as const,
    replayed: false,
    remaining: remaining(bucket.windowCount, bucket.dailyCount),
    lease,
  };
}

const redisCache = {
  signature: "",
  client: undefined as Redis | undefined,
};

function redisClient(environment: ContactRateLimitEnvironment) {
  const credentials = completeRedisCredentials(environment);
  if (!credentials) return undefined;
  const signature = `${credentials.url}\0${credentials.token}`;
  if (!redisCache.client || redisCache.signature !== signature) {
    redisCache.signature = signature;
    redisCache.client = new Redis(credentials);
  }
  return redisCache.client;
}

function distributedKeys(visitorKey: string, now: number) {
  const window = Math.floor(now / WINDOW_MS);
  const date = new Date(now).toISOString().slice(0, 10);
  const namespace = `kx:contact:v1:{${visitorKey}}`;
  return {
    window: `${namespace}:window:${window}`,
    daily: `${namespace}:daily:${date}`,
    reservations: `${namespace}:reservations`,
  };
}

const beginDistributedScript = `
local now = tonumber(ARGV[1])
local windowCeiling = tonumber(ARGV[2])
local dailyCeiling = tonumber(ARGV[3])
local windowReset = tonumber(ARGV[4])
local dailyReset = tonumber(ARGV[5])
local grace = tonumber(ARGV[6])
local reservationKey = ARGV[7]
local attemptId = ARGV[8]
local pendingUntil = tonumber(ARGV[9])
local reservationExpiresAt = tonumber(ARGV[10])

local windowCount = tonumber(redis.call("GET", KEYS[1]) or "0")
local dailyCount = tonumber(redis.call("GET", KEYS[2]) or "0")
local marker = redis.call("HGET", KEYS[3], reservationKey)

if marker then
  local state = string.sub(marker, 1, 1)
  if state == "d" then
    return {2, 0, windowCount, dailyCount, 0, 0}
  end
  local attempts = 0
  if state == "p" then
    local currentPendingUntil, currentAttempts = string.match(marker, "^p:[^:]+:(%d+):(%d+)$")
    currentPendingUntil = tonumber(currentPendingUntil) or 0
    attempts = tonumber(currentAttempts) or 0
    if currentPendingUntil > now then
      return {0, 3, windowCount, dailyCount, currentPendingUntil - now, attempts}
    end
  elseif state == "r" then
    attempts = tonumber(string.match(marker, "^r:[^:]+:(%d+)$")) or 0
  end
  if attempts >= 2 then
    return {0, 4, windowCount, dailyCount, dailyReset - now, attempts}
  end

  attempts = attempts + 1
  redis.call("HSET", KEYS[3], reservationKey, "p:" .. attemptId .. ":" .. pendingUntil .. ":" .. attempts)
  redis.call("PEXPIREAT", KEYS[3], reservationExpiresAt)
  return {1, 0, windowCount, dailyCount, 0, attempts}
end

if windowCount >= windowCeiling then
  return {0, 1, windowCount, dailyCount, windowReset - now, 0}
end
if dailyCount >= dailyCeiling then
  return {0, 2, windowCount, dailyCount, dailyReset - now, 0}
end

windowCount = tonumber(redis.call("INCR", KEYS[1]))
dailyCount = tonumber(redis.call("INCR", KEYS[2]))
redis.call("PEXPIREAT", KEYS[1], windowReset + grace)
redis.call("PEXPIREAT", KEYS[2], dailyReset + grace)
redis.call("HSET", KEYS[3], reservationKey, "p:" .. attemptId .. ":" .. pendingUntil .. ":1")
redis.call("PEXPIREAT", KEYS[3], reservationExpiresAt)
return {1, 0, windowCount, dailyCount, 0, 1}
`;

const completeDistributedScript = `
local reservationKey = ARGV[1]
local expected = "p:" .. ARGV[2] .. ":" .. ARGV[3] .. ":" .. ARGV[4]
local current = redis.call("HGET", KEYS[1], reservationKey)
if current ~= expected then
  return 0
end
redis.call("HSET", KEYS[1], reservationKey, ARGV[5] .. ":" .. ARGV[6] .. ":" .. ARGV[4])
redis.call("PEXPIREAT", KEYS[1], ARGV[7])
return 1
`;

function numericResult(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type ContactRateLimitInput = Readonly<{
  visitorKey: string;
  reservationKey: string;
  attemptId: string;
  environment?: ContactRateLimitEnvironment;
  now?: number;
}>;

type ResolvedContactRateLimitInput = Readonly<{
  visitorKey: string;
  reservationKey: string;
  attemptId: string;
  environment: ContactRateLimitEnvironment;
  now: number;
}>;

export async function beginContactSubmission(
  requestedInput: ContactRateLimitInput,
): Promise<ContactRateLimitDecision> {
  const environment = requestedInput.environment ?? process.env;
  const input = {
    ...requestedInput,
    environment,
    now: requestedInput.now ?? Date.now(),
  };
  const backend = contactAbuseProtectionBackend(environment);
  if (!backend.ready) {
    return { allowed: false, reason: "unavailable", retryAfter: 30 };
  }
  if (backend.kind === "process-memory") {
    return beginLocalContactSubmission(input);
  }

  const redis = redisClient(environment);
  if (!redis) {
    return { allowed: false, reason: "unavailable", retryAfter: 30 };
  }

  const keys = distributedKeys(input.visitorKey, input.now);
  const tenMinuteReset = windowReset(input.now);
  const dailyReset = nextUtcDay(input.now);
  const pendingUntil = input.now + PENDING_RESERVATION_MS;
  try {
    const result = (await redis.eval(
      beginDistributedScript,
      [keys.window, keys.daily, keys.reservations],
      [
        String(input.now),
        String(CONTACT_RATE_LIMIT_POLICY.submissionsPerTenMinutes),
        String(CONTACT_RATE_LIMIT_POLICY.submissionsPerDay),
        String(tenMinuteReset),
        String(dailyReset),
        String(KEY_TTL_GRACE_MS),
        input.reservationKey,
        input.attemptId,
        String(pendingUntil),
        String(input.now + RESERVATION_TTL_MS),
      ],
    )) as unknown[];
    const outcome = numericResult(result[0]);
    const reason = numericResult(result[1]);
    const windowCount = numericResult(result[2]);
    const dailyCount = numericResult(result[3]);
    const deliveryAttempt = numericResult(result[5], 1);
    if (outcome === 2) {
      return {
        allowed: true,
        replayed: true,
        remaining: remaining(windowCount, dailyCount),
      };
    }
    if (outcome === 1) {
      return {
        allowed: true,
        replayed: false,
        remaining: remaining(windowCount, dailyCount),
        lease: {
          backend: "upstash-redis",
          visitorKey: input.visitorKey,
          reservationKey: input.reservationKey,
          attemptId: input.attemptId,
          pendingUntil,
          deliveryAttempt,
        },
      };
    }

    const retryMilliseconds = numericResult(result[4], 1_000);
    return {
      allowed: false,
      reason:
        reason === 2
          ? "daily"
          : reason === 3
            ? "in-flight"
            : reason === 4
              ? "duplicate"
              : "ten-minute",
      retryAfter: Math.max(1, Math.ceil(retryMilliseconds / 1_000)),
    };
  } catch {
    return { allowed: false, reason: "unavailable", retryAfter: 30 };
  }
}

export async function completeContactSubmission(
  lease: ContactRateLimitLease,
  outcome: "delivered" | "failed",
  options: Readonly<{
    environment?: ContactRateLimitEnvironment;
    now?: number;
  }> = {},
) {
  const environment = options.environment ?? process.env;
  const now = options.now ?? Date.now();
  if (lease.backend === "process-memory") {
    const bucket = resolveLocalBucket(lease.visitorKey, now);
    const marker = bucket.reservations.get(lease.reservationKey);
    if (
      !marker ||
      marker.state !== "pending" ||
      marker.attemptId !== lease.attemptId
    ) {
      return false;
    }
    bucket.reservations.set(lease.reservationKey, {
      state: outcome === "delivered" ? "delivered" : "retry",
      attemptId: lease.attemptId,
      deliveryAttempts: lease.deliveryAttempt,
      pendingUntil: 0,
      expiresAt: now + RESERVATION_TTL_MS,
    });
    return true;
  }

  const backend = contactAbuseProtectionBackend(environment);
  const redis = redisClient(environment);
  if (!backend.ready || !redis) return false;
  const keys = distributedKeys(lease.visitorKey, now);
  try {
    const result = await redis.eval(
      completeDistributedScript,
      [keys.reservations],
      [
        lease.reservationKey,
        lease.attemptId,
        String(lease.pendingUntil),
        String(lease.deliveryAttempt),
        outcome === "delivered" ? "d" : "r",
        String(now),
        String(now + RESERVATION_TTL_MS),
      ],
    );
    return numericResult(result) === 1;
  } catch {
    return false;
  }
}
