type UsageBucket = {
  minuteCount: number;
  minuteResetsAt: number;
  dailyCreditsUsed: number;
  dailyResetsAt: number;
  inFlight: number;
};

type UsageStore = Map<string, UsageBucket>;

const MINUTE_WINDOW_MS = 60_000;
const DEFAULT_REQUESTS_PER_MINUTE = 6;
const DEFAULT_DAILY_CREDITS = 30;
const DEFAULT_MAX_CONCURRENT = 2;

const storeSymbol = Symbol.for("kingxford.workspace.usage-store");

function usageStore() {
  const root = globalThis as typeof globalThis & { [storeSymbol]?: UsageStore };
  root[storeSymbol] ??= new Map<string, UsageBucket>();
  return root[storeSymbol];
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nextUtcDay(now: number) {
  const date = new Date(now);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
}

function freshBucket(now: number): UsageBucket {
  return {
    minuteCount: 0,
    minuteResetsAt: now + MINUTE_WINDOW_MS,
    dailyCreditsUsed: 0,
    dailyResetsAt: nextUtcDay(now),
    inFlight: 0,
  };
}

function normalizeBucket(bucket: UsageBucket | undefined, now: number) {
  const current = bucket ?? freshBucket(now);
  if (current.minuteResetsAt <= now) {
    current.minuteCount = 0;
    current.minuteResetsAt = now + MINUTE_WINDOW_MS;
  }
  if (current.dailyResetsAt <= now) {
    current.dailyCreditsUsed = 0;
    current.dailyResetsAt = nextUtcDay(now);
  }
  return current;
}

export const workspaceUsagePolicy = {
  requestsPerMinute: positiveInteger(
    process.env.KINGXFORD_AGENT_REQUESTS_PER_MINUTE,
    DEFAULT_REQUESTS_PER_MINUTE,
  ),
  dailyCredits: positiveInteger(
    process.env.KINGXFORD_AGENT_DAILY_CREDITS,
    DEFAULT_DAILY_CREDITS,
  ),
  maxConcurrent: positiveInteger(
    process.env.KINGXFORD_AGENT_MAX_CONCURRENT,
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

export function beginWorkspaceRequest(key: string) {
  const now = Date.now();
  const store = usageStore();
  const bucket = normalizeBucket(store.get(key), now);

  if (bucket.minuteCount >= workspaceUsagePolicy.requestsPerMinute) {
    store.set(key, bucket);
    return {
      allowed: false as const,
      reason: "minute" as const,
      retryAfter: Math.max(1, Math.ceil((bucket.minuteResetsAt - now) / 1000)),
      usage: snapshot(bucket, 0),
    };
  }
  if (bucket.inFlight >= workspaceUsagePolicy.maxConcurrent) {
    store.set(key, bucket);
    return {
      allowed: false as const,
      reason: "concurrency" as const,
      retryAfter: 3,
      usage: snapshot(bucket, 0),
    };
  }

  bucket.minuteCount += 1;
  bucket.inFlight += 1;
  store.set(key, bucket);
  return {
    allowed: true as const,
    usage: snapshot(bucket, 0),
  };
}

export function consumeWorkspaceCredits(
  key: string,
  depth: "standard" | "deep",
) {
  const now = Date.now();
  const store = usageStore();
  const bucket = normalizeBucket(store.get(key), now);
  const creditCost = workspaceUsagePolicy.creditCost[depth];
  const remaining = workspaceUsagePolicy.dailyCredits - bucket.dailyCreditsUsed;

  if (remaining < creditCost) {
    store.set(key, bucket);
    return {
      allowed: false as const,
      retryAfter: Math.max(1, Math.ceil((bucket.dailyResetsAt - now) / 1000)),
      usage: snapshot(bucket, creditCost),
    };
  }

  bucket.dailyCreditsUsed += creditCost;
  store.set(key, bucket);
  return {
    allowed: true as const,
    usage: snapshot(bucket, creditCost),
  };
}

export function finishWorkspaceRequest(key: string) {
  const store = usageStore();
  const bucket = store.get(key);
  if (!bucket) return;
  bucket.inFlight = Math.max(0, bucket.inFlight - 1);
  store.set(key, bucket);
}

export function getWorkspaceUsage(key: string, depth: "standard" | "deep") {
  const now = Date.now();
  const store = usageStore();
  const bucket = normalizeBucket(store.get(key), now);
  store.set(key, bucket);
  return snapshot(bucket, workspaceUsagePolicy.creditCost[depth]);
}
