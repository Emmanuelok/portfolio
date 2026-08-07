import process from "node:process";

const CONFIRMATION = "YES";
const confirmation = process.env.VERIFY_AI_LIVE_CONFIRM;
const requestedDepth = process.env.VERIFY_AI_LIVE_DEPTH ?? "standard";
const baseInput = process.env.VERIFY_AI_LIVE_BASE_URL ?? process.env.VERIFY_BASE_URL;

function refuse(message) {
  console.error(`Live AI verification refused: ${message}`);
  process.exit(2);
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function boundedMessage(value, fallback) {
  if (!value || typeof value !== "object") return fallback;
  const direct = value.error;
  if (typeof direct === "string" && direct.trim()) return direct.slice(0, 240);
  if (direct && typeof direct === "object" && typeof direct.message === "string") {
    return direct.message.slice(0, 240);
  }
  return fallback;
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new Error(`Expected JSON but received ${contentType || "an unspecified content type"}.`);
  }
  return response.json();
}

if (confirmation !== CONFIRMATION) {
  refuse(
    "set VERIFY_AI_LIVE_CONFIRM=YES only when one real, billable provider request is intended.",
  );
}
if (!baseInput) {
  refuse("set VERIFY_AI_LIVE_BASE_URL to the canonical deployment origin.");
}
if (requestedDepth !== "standard" && requestedDepth !== "deep") {
  refuse("VERIFY_AI_LIVE_DEPTH must be either standard or deep.");
}

let baseUrl;
try {
  baseUrl = new URL(baseInput);
} catch {
  refuse("VERIFY_AI_LIVE_BASE_URL must be an absolute URL.");
}
if (
  baseUrl.username ||
  baseUrl.password ||
  baseUrl.search ||
  baseUrl.hash ||
  (baseUrl.protocol !== "https:" &&
    !(baseUrl.protocol === "http:" && isLocalHostname(baseUrl.hostname)))
) {
  refuse("use an HTTPS origin without credentials, query parameters, or a fragment (HTTP is accepted only for localhost). ");
}
if (baseUrl.pathname !== "/") {
  refuse("use the deployment origin without an additional path.");
}

const origin = baseUrl.origin;
const readinessUrl = new URL("/api/workspace/agent", origin);
let readinessResponse;
try {
  readinessResponse = await fetch(readinessUrl, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
} catch (error) {
  throw new Error(
    `The readiness endpoint could not be reached: ${error instanceof Error ? error.message : String(error)}`,
  );
}

const readinessBody = await readJson(readinessResponse);
if (!readinessResponse.ok) {
  refuse(
    `the readiness endpoint returned HTTP ${readinessResponse.status}: ${boundedMessage(readinessBody, "readiness unavailable")}`,
  );
}
const readiness = readinessBody?.readiness;
const selectedRoute = readiness?.routes?.[requestedDepth];
if (
  readiness?.status !== "ready" ||
  readiness?.deploymentReady !== true ||
  readiness?.providerReady !== true ||
  readiness?.usageProtectionReady !== true ||
  readinessBody?.mode !== "openai" ||
  !selectedRoute ||
  typeof selectedRoute.primary !== "string"
) {
  const blockerCodes = Array.isArray(readiness?.blockers)
    ? readiness.blockers
        .map((blocker) => blocker?.code)
        .filter((code) => typeof code === "string")
        .join(", ")
    : "unknown";
  refuse(
    `the deployment is not ready for a live request (status: ${readiness?.status ?? "unknown"}; blockers: ${blockerCodes || "none reported"}).`,
  );
}

const fixture = {
  mode: "brief",
  title: "Live API release verification",
  text:
    "A public library is preparing a small, accessible programme page. The team needs a clear content hierarchy and one practical usability test before publication.",
  code: { html: "", css: "", javascript: "" },
  objective:
    "Return a concise, evidence-aware review and one practical next test for this non-sensitive release fixture.",
  depth: requestedDepth,
  lens: "conductor",
  includeKnowledge: false,
  context: { codeLogs: [], versions: [] },
};

let liveResponse;
try {
  liveResponse = await fetch(readinessUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: origin,
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": "kingxford-live-release-verifier/1.0",
    },
    body: JSON.stringify(fixture),
    redirect: "error",
    signal: AbortSignal.timeout(135_000),
  });
} catch (error) {
  throw new Error(
    `The live provider request did not complete: ${error instanceof Error ? error.message : String(error)}`,
  );
}

const liveBody = await readJson(liveResponse);
if (!liveResponse.ok) {
  throw new Error(
    `Live AI verification failed with HTTP ${liveResponse.status}: ${boundedMessage(liveBody, "request failed")}`,
  );
}

const responseRequestId = liveResponse.headers.get("x-kingxford-request-id");
const review = liveBody?.review;
const allowedStatuses = new Set(["Strong", "Developing", "Unresolved"]);
const routeModels = [selectedRoute.primary, ...(selectedRoute.fallbacks ?? [])].map((model) =>
  model.replace(/^openai\//, ""),
);
const checks = {
  sourceIsOpenAi: liveBody?.source === "openai",
  modelIsApproved: routeModels.includes(String(liveBody?.model ?? "").replace(/^openai\//, "")),
  requestIdentityMatches:
    typeof liveBody?.request?.id === "string" &&
    liveBody.request.id.length > 0 &&
    liveBody.request.id === responseRequestId,
  requestedDepthMatches: liveBody?.request?.depth === requestedDepth,
  structuredReview:
    review &&
    typeof review.summary === "string" &&
    review.summary.trim().length > 0 &&
    allowedStatuses.has(review.status) &&
    Array.isArray(review.strengths) &&
    Array.isArray(review.uncertainties) &&
    Array.isArray(review.failurePoints) &&
    Array.isArray(review.assumptions) &&
    Array.isArray(review.proposedChanges) &&
    typeof review.nextTest === "string" &&
    review.nextTest.trim().length > 0,
  humanControlBoundary:
    readiness.governance?.automaticApplyEnabled === false &&
    readiness.governance?.gateApprovalMode === "human-only" &&
    readiness.governance?.toolsEnabled === false,
  usageReturned:
    liveBody?.limits &&
    Number.isInteger(liveBody.limits.dailyCreditsRemaining) &&
    liveBody.limits.dailyCreditsRemaining >= 0,
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
if (failed.length) {
  throw new Error(`Live AI response failed verification: ${failed.join(", ")}.`);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      endpoint: readinessUrl.href,
      depth: requestedDepth,
      source: liveBody.source,
      model: liveBody.model,
      requestId: liveBody.request.id,
      protocolVersion: liveBody.protocolVersion,
      usage: {
        inputTokens: liveBody.usage?.inputTokens ?? null,
        outputTokens: liveBody.usage?.outputTokens ?? null,
        totalTokens: liveBody.usage?.totalTokens ?? null,
        dailyCreditsRemaining: liveBody.limits.dailyCreditsRemaining,
      },
      checks,
    },
    null,
    2,
  ),
);
