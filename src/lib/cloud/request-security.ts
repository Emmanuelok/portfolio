import { createHash } from "node:crypto";

import { Redis } from "@upstash/redis";

import { CloudHttpError } from "./http";
import { workspaceUsageBackend } from "@/lib/workspace/usage-policy";

const ALLOWANCE_KEY_TTL_GRACE_SECONDS = 60;
const MAX_LOCAL_ALLOWANCE_BUCKETS = 2_048;

const localAllowanceSymbol = Symbol.for("kingxford.cloud.request-allowance.v1");

type LocalAllowanceBucket = {
  count: number;
  resetsAt: number;
};

export type CloudRequestAllowance = Readonly<{
  scope: string;
  identity: string;
  limit: number;
  windowSeconds: number;
}>;

export type CloudRequestAllowanceDecision =
  | Readonly<{ allowed: true; remaining: number; durable: boolean }>
  | Readonly<{
      allowed: false;
      reason: "rate-limited" | "unavailable";
      retryAfter: number;
    }>;

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

/**
 * Shared same-origin decision for cookie-authenticated and pseudonymous POST
 * routes. An absent Sec-Fetch-Site header falls back to the Origin/Host
 * comparison because older Safari, WebViews, and some proxies omit it; only an
 * explicitly cross-site value is rejected outright.
 */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin === "null") return false;

  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host"));
  if (!origin || !host) return process.env.NODE_ENV !== "production";

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const expectedProtocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
    new URL(request.url).protocol.replace(":", "");

  try {
    const candidate = new URL(origin);
    return (
      candidate.host.toLocaleLowerCase("en") === host.toLocaleLowerCase("en") &&
      candidate.protocol === `${expectedProtocol}:`
    );
  } catch {
    return false;
  }
}

/**
 * Protects cookie-authenticated cloud mutations from cross-site submission.
 * Origin is required even when cookies are configured SameSite; that cookie
 * attribute is useful defense-in-depth, not the primary CSRF decision.
 */
export function requireCloudMutationRequest(
  request: Request,
  options: Readonly<{ json?: boolean }> = {},
) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin === "null") {
    throw new CloudHttpError(
      403,
      "origin_required",
      "This cloud change can be submitted only from the Kingxford site.",
    );
  }
  if (fetchSite && fetchSite !== "same-origin") {
    throw new CloudHttpError(
      403,
      "cross_origin_request_denied",
      "This cloud change can be submitted only from the Kingxford site.",
    );
  }

  const requestUrl = new URL(request.url);
  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host")) ||
    requestUrl.host;
  const protocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
    requestUrl.protocol.replace(":", "");
  let candidate: URL;
  try {
    candidate = new URL(origin);
  } catch {
    throw new CloudHttpError(
      403,
      "cross_origin_request_denied",
      "This cloud change can be submitted only from the Kingxford site.",
    );
  }
  if (candidate.host !== host || candidate.protocol !== `${protocol}:`) {
    throw new CloudHttpError(
      403,
      "cross_origin_request_denied",
      "This cloud change can be submitted only from the Kingxford site.",
    );
  }

  if (options.json) {
    const mediaType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLocaleLowerCase("en");
    if (mediaType !== "application/json") {
      throw new CloudHttpError(
        415,
        "content_type_required",
        "A JSON cloud project request is required.",
      );
    }
  }
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

function allowanceKey(allowance: CloudRequestAllowance, now: number) {
  const window = Math.floor(now / (allowance.windowSeconds * 1_000));
  const identity = createHash("sha256")
    .update("kingxford-cloud-allowance-v1\0")
    .update(`${allowance.scope}\0${allowance.identity}`)
    .digest("hex");
  return `kx:cloud:v1:{${identity}}:${allowance.scope}:${window}`;
}

function localAllowanceStore() {
  const root = globalThis as typeof globalThis & {
    [localAllowanceSymbol]?: Map<string, LocalAllowanceBucket>;
  };
  root[localAllowanceSymbol] ??= new Map<string, LocalAllowanceBucket>();
  return root[localAllowanceSymbol];
}

function consumeLocalAllowance(
  key: string,
  allowance: CloudRequestAllowance,
  now: number,
): CloudRequestAllowanceDecision {
  const store = localAllowanceStore();
  for (const [candidate, bucket] of store) {
    if (bucket.resetsAt <= now) store.delete(candidate);
  }

  const existing = store.get(key);
  if (!existing && store.size >= MAX_LOCAL_ALLOWANCE_BUCKETS) {
    return {
      allowed: false,
      reason: "unavailable",
      retryAfter: allowance.windowSeconds,
    };
  }

  const bucket = existing ?? {
    count: 0,
    resetsAt: now + allowance.windowSeconds * 1_000,
  };
  if (bucket.count >= allowance.limit) {
    return {
      allowed: false,
      reason: "rate-limited",
      retryAfter: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1_000)),
    };
  }

  bucket.count += 1;
  store.set(key, bucket);
  return {
    allowed: true,
    remaining: allowance.limit - bucket.count,
    durable: false,
  };
}

const consumeAllowanceScript = `
local current = tonumber(redis.call("INCR", KEYS[1]))
if current == 1 then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
end
return {current, tonumber(redis.call("TTL", KEYS[1]))}
`;

function numericResult(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Bounds an expensive cloud route on the distributed usage backend already
 * required in production. Without that backend a production deployment fails
 * closed; local and unconfigured development keeps the bounded process store.
 */
export async function consumeCloudRequestAllowance(
  allowance: CloudRequestAllowance,
): Promise<CloudRequestAllowanceDecision> {
  const backend = workspaceUsageBackend();
  const now = Date.now();
  const key = allowanceKey(allowance, now);
  if (backend.kind === "process-memory") {
    return consumeLocalAllowance(key, allowance, now);
  }

  const redis = redisClient();
  if (!redis || !backend.ready) {
    return { allowed: false, reason: "unavailable", retryAfter: 30 };
  }

  try {
    const result = (await redis.eval(
      consumeAllowanceScript,
      [key],
      [String(allowance.windowSeconds + ALLOWANCE_KEY_TTL_GRACE_SECONDS)],
    )) as unknown[];
    const current = numericResult(result[0], allowance.limit + 1);
    const ttl = numericResult(result[1], allowance.windowSeconds);
    if (current > allowance.limit) {
      return {
        allowed: false,
        reason: "rate-limited",
        retryAfter: Math.max(1, ttl > 0 ? ttl : allowance.windowSeconds),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, allowance.limit - current),
      durable: true,
    };
  } catch {
    return { allowed: false, reason: "unavailable", retryAfter: 30 };
  }
}

export async function requireCloudRequestAllowance(
  allowance: CloudRequestAllowance,
  messages: Readonly<{ rateLimited: string; unavailable: string }>,
) {
  const decision = await consumeCloudRequestAllowance(allowance);
  if (decision.allowed) return decision;

  throw new CloudHttpError(
    decision.reason === "unavailable" ? 503 : 429,
    decision.reason === "unavailable"
      ? "cloud_request_allowance_unavailable"
      : "cloud_request_rate_limited",
    decision.reason === "unavailable"
      ? messages.unavailable
      : messages.rateLimited,
    { headers: { "Retry-After": String(decision.retryAfter) } },
  );
}
