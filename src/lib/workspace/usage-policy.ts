import { randomUUID } from "node:crypto";

import { Redis } from "@upstash/redis";

type UsageBucket = {
  minuteCount: number;
  minuteResetsAt: number;
  dailyCreditsUsed: number;
  dailyResetsAt: number;
  inFlight: number;
  inFlightLeaseIds: Set<string>;
  creditReservationIds: Set<string>;
  lastSeenAt: number;
  overflow: boolean;
};

type UsageStore = Map<string, UsageBucket>;

const MINUTE_WINDOW_MS = 60_000;
const USAGE_BUCKET_TTL_MS = 25 * 60 * 60 * 1_000;
const MAX_USAGE_BUCKETS = 5_000;
const OVERFLOW_BUCKET_COUNT = 64;
const MAX_CLEANUP_SCAN = 512;
const DEFAULT_REQUESTS_PER_MINUTE = 6;
const DEFAULT_DAILY_CREDITS = 30;
const DEFAULT_MAX_CONCURRENT = 2;
const MAX_CREDIT_UNITS_PER_REQUEST = 4;
const DISTRIBUTED_LEASE_TTL_MS = 5 * 60_000;
const DISTRIBUTED_KEY_TTL_GRACE_MS = 60 * 60_000;

const storeSymbol = Symbol.for("kingxford.workspace.usage-store.v2");
const overflowPrefix = "__kingxford-overflow-";

function nextUtcDay(now: number) {
  const date = new Date(now);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
}

function freshBucket(now: number, overflow = false): UsageBucket {
  return {
    minuteCount: 0,
    minuteResetsAt: now + MINUTE_WINDOW_MS,
    dailyCreditsUsed: 0,
    dailyResetsAt: nextUtcDay(now),
    inFlight: 0,
    inFlightLeaseIds: new Set<string>(),
    creditReservationIds: new Set<string>(),
    lastSeenAt: now,
    overflow,
  };
}

function overflowKey(index: number) {
  return `${overflowPrefix}${index}`;
}

function isOverflowKey(key: string) {
  return key.startsWith(overflowPrefix);
}

function ensureOverflowBuckets(store: UsageStore, now: number) {
  for (let index = 0; index < OVERFLOW_BUCKET_COUNT; index += 1) {
    const key = overflowKey(index);
    if (store.has(key)) continue;

    if (store.size >= MAX_USAGE_BUCKETS) {
      for (const [candidate, bucket] of store) {
        if (!isOverflowKey(candidate) && bucket.inFlight === 0) {
          store.delete(candidate);
          break;
        }
      }
    }
    if (store.size < MAX_USAGE_BUCKETS) {
      store.set(key, freshBucket(now, true));
    }
  }
}

function usageStore() {
  const root = globalThis as typeof globalThis & { [storeSymbol]?: UsageStore };
  root[storeSymbol] ??= new Map<string, UsageBucket>();
  ensureOverflowBuckets(root[storeSymbol], Date.now());
  return root[storeSymbol];
}

function boundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  hardMaximum: number,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, hardMaximum)
    : fallback;
}

function normalizeBucket(bucket: UsageBucket, now: number) {
  bucket.inFlightLeaseIds ??= new Set<string>();
  bucket.creditReservationIds ??= new Set<string>();
  if (bucket.minuteResetsAt <= now) {
    bucket.minuteCount = 0;
    bucket.minuteResetsAt = now + MINUTE_WINDOW_MS;
  }
  if (bucket.dailyResetsAt <= now) {
    bucket.dailyCreditsUsed = 0;
    bucket.creditReservationIds.clear();
    bucket.dailyResetsAt = nextUtcDay(now);
  }
  bucket.lastSeenAt = now;
  return bucket;
}

function cleanupUsageStore(store: UsageStore, now: number) {
  let scanned = 0;
  for (const [key, bucket] of store) {
    if (scanned >= MAX_CLEANUP_SCAN) break;
    scanned += 1;
    if (
      !isOverflowKey(key) &&
      bucket.inFlight === 0 &&
      now - bucket.lastSeenAt >= USAGE_BUCKET_TTL_MS
    ) {
      store.delete(key);
    }
  }

  if (store.size <= MAX_USAGE_BUCKETS) return;
  for (const [key, bucket] of store) {
    if (store.size <= MAX_USAGE_BUCKETS) break;
    if (!isOverflowKey(key) && bucket.inFlight === 0) store.delete(key);
  }
}

function stableOverflowIndex(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % OVERFLOW_BUCKET_COUNT;
}

function touchBucket(store: UsageStore, key: string, bucket: UsageBucket) {
  store.delete(key);
  store.set(key, bucket);
}

function resolveBucket(store: UsageStore, requestedKey: string, now: number) {
  cleanupUsageStore(store, now);

  const existing = store.get(requestedKey);
  if (existing) {
    const bucket = normalizeBucket(existing, now);
    touchBucket(store, requestedKey, bucket);
    return { usageKey: requestedKey, bucket };
  }

  if (store.size < MAX_USAGE_BUCKETS) {
    const bucket = freshBucket(now);
    store.set(requestedKey, bucket);
    return { usageKey: requestedKey, bucket };
  }

  // Unseen visitors share a stable, preallocated overflow bucket while the
  // bounded store is full. That preserves rate-limit affinity and fails closed
  // under key-cardinality attacks instead of granting fresh quotas by eviction.
  const usageKey = overflowKey(stableOverflowIndex(requestedKey));
  const bucket = normalizeBucket(
    store.get(usageKey) ?? freshBucket(now, true),
    now,
  );
  touchBucket(store, usageKey, bucket);
  return { usageKey, bucket };
}

export const workspaceUsagePolicy = {
  requestsPerMinute: boundedPositiveInteger(
    process.env.KINGXFORD_AGENT_REQUESTS_PER_MINUTE,
    DEFAULT_REQUESTS_PER_MINUTE,
    DEFAULT_REQUESTS_PER_MINUTE,
  ),
  dailyCredits: boundedPositiveInteger(
    process.env.KINGXFORD_AGENT_DAILY_CREDITS,
    DEFAULT_DAILY_CREDITS,
    DEFAULT_DAILY_CREDITS,
  ),
  maxConcurrent: boundedPositiveInteger(
    process.env.KINGXFORD_AGENT_MAX_CONCURRENT,
    DEFAULT_MAX_CONCURRENT,
    DEFAULT_MAX_CONCURRENT,
  ),
  creditCost: {
    standard: 1,
    deep: 3,
  },
} as const;

export type WorkspaceUsageSnapshot = Readonly<{
  minuteRemaining: number;
  minuteResetsAt: string;
  dailyCreditsRemaining: number;
  dailyResetsAt: string;
  creditCost: number;
}>;

export type WorkspaceUsageBackend = Readonly<{
  kind: "upstash-redis" | "process-memory" | "missing";
  configured: boolean;
  durable: boolean;
  ready: boolean;
}>;

export function workspaceUsageBackend(
  environment: NodeJS.ProcessEnv = process.env,
): WorkspaceUsageBackend {
  const hasUrl = Boolean(
    environment.UPSTASH_REDIS_REST_URL?.trim() ||
      environment.KV_REST_API_URL?.trim(),
  );
  const hasToken = Boolean(
    environment.UPSTASH_REDIS_REST_TOKEN?.trim() ||
      environment.KV_REST_API_TOKEN?.trim(),
  );

  if (hasUrl && hasToken) {
    return {
      kind: "upstash-redis",
      configured: true,
      durable: true,
      ready: true,
    };
  }

  if (
    environment.KINGXFORD_ALLOW_EPHEMERAL_USAGE === "1" &&
    environment.VERCEL !== "1"
  ) {
    return {
      kind: "process-memory",
      configured: false,
      durable: false,
      ready: true,
    };
  }

  if (environment.NODE_ENV === "production") {
    return {
      kind: "missing",
      configured: false,
      durable: false,
      ready: false,
    };
  }

  return {
    kind: "process-memory",
    configured: false,
    durable: false,
    ready: true,
  };
}

function snapshot(bucket: UsageBucket, creditCost: number): WorkspaceUsageSnapshot {
  return {
    minuteRemaining: Math.max(
      0,
      workspaceUsagePolicy.requestsPerMinute - bucket.minuteCount,
    ),
    minuteResetsAt: new Date(bucket.minuteResetsAt).toISOString(),
    dailyCreditsRemaining: Math.max(
      0,
      workspaceUsagePolicy.dailyCredits - bucket.dailyCreditsUsed,
    ),
    dailyResetsAt: new Date(bucket.dailyResetsAt).toISOString(),
    creditCost,
  };
}

function boundedCreditUnits(units: number) {
  return Number.isInteger(units) && units > 0
    ? Math.min(units, MAX_CREDIT_UNITS_PER_REQUEST)
    : 1;
}

export function workspaceCreditCost(
  depth: "standard" | "deep",
  units = 1,
) {
  return workspaceUsagePolicy.creditCost[depth] * boundedCreditUnits(units);
}

function beginProcessLocalWorkspaceRequest(key: string, leaseId: string) {
  const now = Date.now();
  const store = usageStore();
  const resolved = resolveBucket(store, key, now);
  const { bucket, usageKey } = resolved;

  if (bucket.inFlightLeaseIds.has(leaseId)) {
    return {
      allowed: true as const,
      usageKey,
      leaseId,
      usage: snapshot(bucket, 0),
    };
  }

  if (bucket.minuteCount >= workspaceUsagePolicy.requestsPerMinute) {
    return {
      allowed: false as const,
      reason: "minute" as const,
      retryAfter: Math.max(1, Math.ceil((bucket.minuteResetsAt - now) / 1_000)),
      usage: snapshot(bucket, 0),
    };
  }
  if (bucket.inFlight >= workspaceUsagePolicy.maxConcurrent) {
    return {
      allowed: false as const,
      reason: "concurrency" as const,
      retryAfter: 3,
      usage: snapshot(bucket, 0),
    };
  }

  bucket.minuteCount += 1;
  bucket.inFlight += 1;
  bucket.inFlightLeaseIds.add(leaseId);
  touchBucket(store, usageKey, bucket);
  return {
    allowed: true as const,
    usageKey,
    leaseId,
    usage: snapshot(bucket, 0),
  };
}

export function consumeWorkspaceCredits(
  usageKey: string,
  depth: "standard" | "deep",
  units = 1,
  reservationId: string = randomUUID(),
) {
  return consumeDurableWorkspaceCredits(
    usageKey,
    depth,
    units,
    reservationId,
  );
}

function consumeProcessLocalWorkspaceCredits(
  usageKey: string,
  depth: "standard" | "deep",
  units = 1,
  reservationId: string = randomUUID(),
) {
  const now = Date.now();
  const store = usageStore();
  const resolved = resolveBucket(store, usageKey, now);
  const { bucket } = resolved;
  const creditCost = workspaceCreditCost(depth, units);
  const remaining = workspaceUsagePolicy.dailyCredits - bucket.dailyCreditsUsed;

  if (bucket.creditReservationIds.has(reservationId)) {
    return {
      allowed: true as const,
      usage: snapshot(bucket, creditCost),
    };
  }

  if (remaining < creditCost) {
    return {
      allowed: false as const,
      retryAfter: Math.max(1, Math.ceil((bucket.dailyResetsAt - now) / 1_000)),
      usage: snapshot(bucket, creditCost),
    };
  }

  bucket.dailyCreditsUsed += creditCost;
  bucket.creditReservationIds.add(reservationId);
  touchBucket(store, resolved.usageKey, bucket);
  return {
    allowed: true as const,
    usage: snapshot(bucket, creditCost),
  };
}

function finishProcessLocalWorkspaceRequest(
  usageKey: string,
  leaseId?: string,
) {
  const store = usageStore();
  const bucket = store.get(usageKey);
  if (!bucket) return;
  if (leaseId && !bucket.inFlightLeaseIds.has(leaseId)) return;
  if (leaseId) bucket.inFlightLeaseIds.delete(leaseId);
  bucket.inFlight = Math.max(0, bucket.inFlight - 1);
  bucket.lastSeenAt = Date.now();
  touchBucket(store, usageKey, bucket);
}

function getProcessLocalWorkspaceUsage(
  usageKey: string,
  depth: "standard" | "deep",
  units = 1,
) {
  const now = Date.now();
  const store = usageStore();
  const resolved = resolveBucket(store, usageKey, now);
  return snapshot(resolved.bucket, workspaceCreditCost(depth, units));
}

const redisCache = {
  signature: "",
  client: undefined as Redis | undefined,
};

function redisClient() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return undefined;

  const signature = `${url}\0${token}`;
  if (!redisCache.client || redisCache.signature !== signature) {
    redisCache.signature = signature;
    redisCache.client = new Redis({ url, token });
  }
  return redisCache.client;
}

function distributedKeys(key: string, now: number) {
  const minuteWindow = Math.floor(now / MINUTE_WINDOW_MS);
  const date = new Date(now).toISOString().slice(0, 10);
  const namespace = `kx:ai:v3:{${key}}`;
  return {
    minute: `${namespace}:minute:${minuteWindow}`,
    daily: `${namespace}:daily:${date}`,
    charges: `${namespace}:charges:${date}`,
    leases: `${namespace}:leases`,
  };
}

function distributedSnapshot(
  minuteCount: number,
  dailyCreditsUsed: number,
  now: number,
  creditCost: number,
): WorkspaceUsageSnapshot {
  return {
    minuteRemaining: Math.max(
      0,
      workspaceUsagePolicy.requestsPerMinute - minuteCount,
    ),
    minuteResetsAt: new Date(
      (Math.floor(now / MINUTE_WINDOW_MS) + 1) * MINUTE_WINDOW_MS,
    ).toISOString(),
    dailyCreditsRemaining: Math.max(
      0,
      workspaceUsagePolicy.dailyCredits - dailyCreditsUsed,
    ),
    dailyResetsAt: new Date(nextUtcDay(now)).toISOString(),
    creditCost,
  };
}

const beginDistributedScript = `
local now = tonumber(ARGV[1])
local minuteReset = tonumber(ARGV[2])
local rpm = tonumber(ARGV[3])
local maxConcurrent = tonumber(ARGV[4])
local leaseId = ARGV[5]
local leaseExpiresAt = tonumber(ARGV[6])
local ttlGrace = tonumber(ARGV[7])

redis.call("ZREMRANGEBYSCORE", KEYS[2], "-inf", now)
local minuteCount = tonumber(redis.call("GET", KEYS[1]) or "0")
local inFlight = tonumber(redis.call("ZCARD", KEYS[2]) or "0")
local dailyCreditsUsed = tonumber(redis.call("GET", KEYS[3]) or "0")

local existingLease = redis.call("ZSCORE", KEYS[2], leaseId)
if existingLease then
  return {1, 0, minuteCount, inFlight, dailyCreditsUsed}
end

if minuteCount >= rpm then
  return {0, 1, minuteCount, inFlight, dailyCreditsUsed}
end
if inFlight >= maxConcurrent then
  return {0, 2, minuteCount, inFlight, dailyCreditsUsed}
end

minuteCount = tonumber(redis.call("INCR", KEYS[1]))
redis.call("PEXPIREAT", KEYS[1], minuteReset + ttlGrace)
redis.call("ZADD", KEYS[2], leaseExpiresAt, leaseId)
redis.call("PEXPIREAT", KEYS[2], leaseExpiresAt + ttlGrace)
return {1, 0, minuteCount, inFlight + 1, dailyCreditsUsed}
`;

const consumeDistributedScript = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local cost = tonumber(ARGV[1])
local ceiling = tonumber(ARGV[2])
local resetAt = tonumber(ARGV[3])
local ttlGrace = tonumber(ARGV[4])
local reservationId = ARGV[5]

if redis.call("HEXISTS", KEYS[2], reservationId) == 1 then
  return {2, current}
end

if current + cost > ceiling then
  return {0, current}
end

local updated = tonumber(redis.call("INCRBY", KEYS[1], cost))
redis.call("PEXPIREAT", KEYS[1], resetAt + ttlGrace)
redis.call("HSET", KEYS[2], reservationId, cost)
redis.call("PEXPIREAT", KEYS[2], resetAt + ttlGrace)
return {1, updated}
`;

const readDistributedScript = `
local now = tonumber(ARGV[1])
redis.call("ZREMRANGEBYSCORE", KEYS[3], "-inf", now)
return {
  tonumber(redis.call("GET", KEYS[1]) or "0"),
  tonumber(redis.call("GET", KEYS[2]) or "0"),
  tonumber(redis.call("ZCARD", KEYS[3]) or "0")
}
`;

function numericResult(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unavailableUsage(now: number, creditCost = 0) {
  return distributedSnapshot(
    workspaceUsagePolicy.requestsPerMinute,
    workspaceUsagePolicy.dailyCredits,
    now,
    creditCost,
  );
}

export async function beginWorkspaceRequest(
  key: string,
  requestedLeaseId: string = randomUUID(),
) {
  const backend = workspaceUsageBackend();
  if (backend.kind === "process-memory") {
    return beginProcessLocalWorkspaceRequest(key, requestedLeaseId);
  }

  const now = Date.now();
  const redis = redisClient();
  if (!redis || !backend.ready) {
    return {
      allowed: false as const,
      reason: "unavailable" as const,
      retryAfter: 15,
      usage: unavailableUsage(now),
    };
  }

  const leaseId = requestedLeaseId;
  const keys = distributedKeys(key, now);
  const minuteReset =
    (Math.floor(now / MINUTE_WINDOW_MS) + 1) * MINUTE_WINDOW_MS;
  try {
    const result = (await redis.eval(beginDistributedScript, [
      keys.minute,
      keys.leases,
      keys.daily,
    ], [
      String(now),
      String(minuteReset),
      String(workspaceUsagePolicy.requestsPerMinute),
      String(workspaceUsagePolicy.maxConcurrent),
      leaseId,
      String(now + DISTRIBUTED_LEASE_TTL_MS),
      String(DISTRIBUTED_KEY_TTL_GRACE_MS),
    ])) as unknown[];
    const allowed = numericResult(result[0]) === 1;
    const reasonCode = numericResult(result[1]);
    const minuteCount = numericResult(result[2]);
    const dailyCreditsUsed = numericResult(result[4]);
    const usage = distributedSnapshot(minuteCount, dailyCreditsUsed, now, 0);

    if (!allowed) {
      return {
        allowed: false as const,
        reason: reasonCode === 2 ? ("concurrency" as const) : ("minute" as const),
        retryAfter:
          reasonCode === 2
            ? 3
            : Math.max(1, Math.ceil((minuteReset - now) / 1_000)),
        usage,
      };
    }

    return {
      allowed: true as const,
      usageKey: key,
      leaseId,
      usage,
    };
  } catch {
    return {
      allowed: false as const,
      reason: "unavailable" as const,
      retryAfter: 15,
      usage: unavailableUsage(now),
    };
  }
}

async function consumeDurableWorkspaceCredits(
  usageKey: string,
  depth: "standard" | "deep",
  units = 1,
  reservationId: string = randomUUID(),
) {
  const backend = workspaceUsageBackend();
  if (backend.kind === "process-memory") {
    const result = consumeProcessLocalWorkspaceCredits(
      usageKey,
      depth,
      units,
      reservationId,
    );
    return result.allowed
      ? result
      : { ...result, reason: "daily" as const };
  }

  const now = Date.now();
  const creditCost = workspaceCreditCost(depth, units);
  const redis = redisClient();
  if (!redis || !backend.ready) {
    return {
      allowed: false as const,
      reason: "unavailable" as const,
      retryAfter: 15,
      usage: unavailableUsage(now, creditCost),
    };
  }

  const keys = distributedKeys(usageKey, now);
  const resetAt = nextUtcDay(now);
  try {
    const result = (await redis.eval(consumeDistributedScript, [
      keys.daily,
      keys.charges,
    ], [
      String(creditCost),
      String(workspaceUsagePolicy.dailyCredits),
      String(resetAt),
      String(DISTRIBUTED_KEY_TTL_GRACE_MS),
      reservationId,
    ])) as unknown[];
    const allowed = numericResult(result[0]) >= 1;
    const used = numericResult(result[1]);
    const usage = distributedSnapshot(0, used, now, creditCost);
    return allowed
      ? { allowed: true as const, usage }
      : {
          allowed: false as const,
          reason: "daily" as const,
          retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1_000)),
          usage,
        };
  } catch {
    return {
      allowed: false as const,
      reason: "unavailable" as const,
      retryAfter: 15,
      usage: unavailableUsage(now, creditCost),
    };
  }
}

export async function finishWorkspaceRequest(
  usageKey: string,
  leaseId?: string,
) {
  const backend = workspaceUsageBackend();
  if (backend.kind === "process-memory") {
    finishProcessLocalWorkspaceRequest(usageKey, leaseId);
    return;
  }

  const redis = redisClient();
  if (!redis || !leaseId) return;
  const keys = distributedKeys(usageKey, Date.now());
  await redis.zrem(keys.leases, leaseId).catch(() => undefined);
}

export async function getWorkspaceUsage(
  usageKey: string,
  depth: "standard" | "deep",
  units = 1,
) {
  const backend = workspaceUsageBackend();
  if (backend.kind === "process-memory") {
    return getProcessLocalWorkspaceUsage(usageKey, depth, units);
  }

  const now = Date.now();
  const creditCost = workspaceCreditCost(depth, units);
  const redis = redisClient();
  if (!redis || !backend.ready) return unavailableUsage(now, creditCost);
  const keys = distributedKeys(usageKey, now);
  try {
    const result = (await redis.eval(readDistributedScript, [
      keys.minute,
      keys.daily,
      keys.leases,
    ], [String(now)])) as unknown[];
    return distributedSnapshot(
      numericResult(result[0]),
      numericResult(result[1]),
      now,
      creditCost,
    );
  } catch {
    return unavailableUsage(now, creditCost);
  }
}
