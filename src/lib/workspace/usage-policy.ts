type UsageBucket = {
  minuteCount: number;
  minuteResetsAt: number;
  dailyCreditsUsed: number;
  dailyResetsAt: number;
  inFlight: number;
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
  if (bucket.minuteResetsAt <= now) {
    bucket.minuteCount = 0;
    bucket.minuteResetsAt = now + MINUTE_WINDOW_MS;
  }
  if (bucket.dailyResetsAt <= now) {
    bucket.dailyCreditsUsed = 0;
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

export function beginWorkspaceRequest(key: string) {
  const now = Date.now();
  const store = usageStore();
  const resolved = resolveBucket(store, key, now);
  const { bucket, usageKey } = resolved;

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
  touchBucket(store, usageKey, bucket);
  return {
    allowed: true as const,
    usageKey,
    usage: snapshot(bucket, 0),
  };
}

export function consumeWorkspaceCredits(
  usageKey: string,
  depth: "standard" | "deep",
  units = 1,
) {
  const now = Date.now();
  const store = usageStore();
  const resolved = resolveBucket(store, usageKey, now);
  const { bucket } = resolved;
  const creditCost = workspaceCreditCost(depth, units);
  const remaining = workspaceUsagePolicy.dailyCredits - bucket.dailyCreditsUsed;

  if (remaining < creditCost) {
    return {
      allowed: false as const,
      retryAfter: Math.max(1, Math.ceil((bucket.dailyResetsAt - now) / 1_000)),
      usage: snapshot(bucket, creditCost),
    };
  }

  bucket.dailyCreditsUsed += creditCost;
  touchBucket(store, resolved.usageKey, bucket);
  return {
    allowed: true as const,
    usage: snapshot(bucket, creditCost),
  };
}

export function finishWorkspaceRequest(usageKey: string) {
  const store = usageStore();
  const bucket = store.get(usageKey);
  if (!bucket) return;
  bucket.inFlight = Math.max(0, bucket.inFlight - 1);
  bucket.lastSeenAt = Date.now();
  touchBucket(store, usageKey, bucket);
}

export function getWorkspaceUsage(
  usageKey: string,
  depth: "standard" | "deep",
  units = 1,
) {
  const now = Date.now();
  const store = usageStore();
  const resolved = resolveBucket(store, usageKey, now);
  return snapshot(resolved.bucket, workspaceCreditCost(depth, units));
}
