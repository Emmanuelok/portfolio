import { createHash, randomUUID } from "node:crypto";

import {
  CONTACT_LIMITS,
  CONTACT_RETENTION_TARGET_DAYS,
  type ProjectEnquiry,
} from "@/lib/contact/contracts";
import {
  getContactDeliveryConfiguration,
  getContactDeliveryReadiness,
  type ContactEnvironment,
} from "@/lib/contact/configuration";
import {
  ContactDeliveryError,
  deliverProjectEnquiry,
  type ContactDeliveryFunction,
} from "@/lib/contact/delivery";
import {
  beginContactSubmission,
  completeContactSubmission,
  contactUsageHashSalt,
  deriveContactReservationKey,
  deriveContactVisitorKey,
  type ContactRateLimitDecision,
  type ContactRateLimitInput,
  type ContactRateLimitLease,
} from "@/lib/contact/rate-limit";
import {
  containsLikelySecret,
  projectEnquirySchema,
} from "@/lib/contact/schema";
import { logOperationalEvent } from "@/lib/observability/structured-log";

type ContactLogEvent = Readonly<{
  scope: "contact-intake";
  event:
    | "request-rejected"
    | "delivery-unavailable"
    | "delivery-failed"
    | "delivery-accepted"
    | "reservation-finalization-failed";
  requestId: string;
  status: number;
  durationMs: number;
  bodyBytes?: number;
  reason?: string;
}>;

export type ContactLogger = (event: ContactLogEvent) => void;

type ContactHandlerDependencies = Readonly<{
  beginRateLimit?: (
    input: ContactRateLimitInput,
  ) => Promise<ContactRateLimitDecision>;
  completeRateLimit?: (
    lease: ContactRateLimitLease,
    outcome: "delivered" | "failed",
    options: Readonly<{ environment: ContactEnvironment; now: number }>,
  ) => Promise<boolean>;
  deliver?: ContactDeliveryFunction;
  environment?: ContactEnvironment;
  logger?: ContactLogger;
  now?: () => Date;
  requestId?: () => string;
}>;

function defaultLogger(event: ContactLogEvent) {
  const level =
    event.status >= 500 ? "error" : event.status >= 400 ? "warn" : "info";
  logOperationalEvent(level, `contact.${event.event}`, {
    requestId: event.requestId,
    status: event.status,
    durationMs: event.durationMs,
    bodyBytes: event.bodyBytes,
    reason: event.reason,
  });
}

function responseHeaders(
  requestId: string,
  extra: Readonly<Record<string, string>> = {},
) {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Kingxford-Request-Id": requestId,
    ...extra,
  };
}

function jsonResponse(
  body: Readonly<Record<string, unknown>>,
  status: number,
  requestId: string,
  extraHeaders: Readonly<Record<string, string>> = {},
) {
  return Response.json(body, {
    status,
    headers: responseHeaders(requestId, extraHeaders),
  });
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const requestUrl = new URL(request.url);
  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host")) ||
    requestUrl.host;
  const expectedProtocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
    requestUrl.protocol.replace(":", "");

  try {
    const candidate = new URL(origin);
    return (
      candidate.origin === origin &&
      candidate.host.toLocaleLowerCase("en") === host.toLocaleLowerCase("en") &&
      candidate.protocol === `${expectedProtocol}:`
    );
  } catch {
    return false;
  }
}

export function deriveDeliveryIdempotencyKey(enquiry: ProjectEnquiry) {
  const digest = createHash("sha256")
    .update(enquiry.idempotencyKey)
    .update("\0")
    .update(JSON.stringify(enquiry))
    .digest("hex");
  return `kingxford-contact-${digest}`;
}

function deliveryFailureReason(error: unknown) {
  return error instanceof ContactDeliveryError
    ? error.code
    : "unclassified-delivery-failure";
}

export async function handleContactDiagnostic(
  dependencies: ContactHandlerDependencies = {},
) {
  const environment = dependencies.environment ?? process.env;
  const requestId = dependencies.requestId?.() ?? randomUUID();
  const readiness = getContactDeliveryReadiness(environment);

  return jsonResponse(
    {
      onlineSubmission: {
        available: readiness.configured,
        status: readiness.configured ? "ready" : "configuration-required",
      },
      deliveryProviderConfigured: readiness.deliveryConfigured,
      abuseProtection: {
        available: readiness.abuseProtection.ready,
        durable: readiness.abuseProtection.durable,
        mode:
          readiness.abuseProtection.kind === "upstash-redis"
            ? "distributed"
            : readiness.abuseProtection.kind === "process-memory"
              ? "local-bounded"
              : "unavailable",
      },
      fallbackEmailAvailable: readiness.publicEmail !== null,
      retentionTargetDays: CONTACT_RETENTION_TARGET_DAYS,
    },
    200,
    requestId,
  );
}

export async function handleContactPost(
  request: Request,
  dependencies: ContactHandlerDependencies = {},
) {
  const startedAt = Date.now();
  const requestId = dependencies.requestId?.() ?? randomUUID();
  const logger = dependencies.logger ?? defaultLogger;
  const log = (
    event: ContactLogEvent["event"],
    status: number,
    details: Pick<ContactLogEvent, "bodyBytes" | "reason"> = {},
  ) =>
    logger({
      scope: "contact-intake",
      event,
      requestId,
      status,
      durationMs: Math.max(0, Date.now() - startedAt),
      ...details,
    });
  const reject = (message: string, status: number, reason: string) => {
    log("request-rejected", status, { reason });
    return jsonResponse({ submitted: false, error: message, requestId }, status, requestId);
  };

  const environment = dependencies.environment ?? process.env;
  const readiness = getContactDeliveryReadiness(environment);

  if (!isSameOriginRequest(request)) {
    return reject(
      "This endpoint accepts project enquiries only from kingXford & Co.",
      403,
      "origin",
    );
  }

  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLocaleLowerCase("en");
  if (mediaType !== "application/json") {
    return reject("A JSON project enquiry is required.", 415, "content-type");
  }

  const declaredLengthHeader = request.headers.get("content-length");
  if (
    declaredLengthHeader &&
    (!/^\d+$/.test(declaredLengthHeader) ||
      Number(declaredLengthHeader) > CONTACT_LIMITS.requestBytes)
  ) {
    return reject("The project enquiry is too large to submit.", 413, "declared-size");
  }

  if (!readiness.configured) {
    const reason = readiness.deliveryConfigured
      ? "abuse-protection-not-configured"
      : "delivery-not-configured";
    log("delivery-unavailable", 503, { reason });
    return jsonResponse(
      {
        submitted: false,
        unavailable: true,
        error:
          "Online delivery is not available on this deployment. Your browser copy remains unchanged; use the visible email, copy, or download options instead.",
        requestId,
      },
      503,
      requestId,
    );
  }

  const hashSalt = contactUsageHashSalt(environment);
  if (!hashSalt) {
    log("delivery-unavailable", 503, { reason: "identity-protection-unavailable" });
    return jsonResponse(
      {
        submitted: false,
        unavailable: true,
        error:
          "Online delivery is not available on this deployment. Your browser copy remains unchanged; use the visible email, copy, or download options instead.",
        requestId,
      },
      503,
      requestId,
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return reject("The project enquiry could not be read.", 400, "unreadable-body");
  }

  const bodyBytes = Buffer.byteLength(rawBody, "utf8");
  if (bodyBytes > CONTACT_LIMITS.requestBytes) {
    return reject("The project enquiry is too large to submit.", 413, "actual-size");
  }
  if (containsLikelySecret(rawBody)) {
    return reject(
      "A likely credential or private key was detected. Remove it before submitting.",
      422,
      "likely-secret",
    );
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(rawBody) as unknown;
  } catch {
    return reject("The project enquiry could not be read.", 400, "invalid-json");
  }

  const parsed = projectEnquirySchema.safeParse(candidate);
  if (!parsed.success) {
    return reject(
      "Review the required fields, limits, and consent before submitting.",
      422,
      "schema",
    );
  }
  if (parsed.data.website) {
    return reject("The project enquiry could not be accepted.", 400, "honeypot");
  }

  const configuration = getContactDeliveryConfiguration(environment);
  if (!configuration) {
    log("delivery-unavailable", 503, { bodyBytes, reason: "not-configured" });
    return jsonResponse(
      {
        submitted: false,
        unavailable: true,
        error:
          "Online delivery is not configured. Your browser copy remains unchanged; use the visible email, copy, or download options instead.",
        requestId,
      },
      503,
      requestId,
    );
  }

  const submittedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const deliver = dependencies.deliver ?? deliverProjectEnquiry;
  const deliveryIdempotencyKey = deriveDeliveryIdempotencyKey(parsed.data);
  const reservationKey = deriveContactReservationKey(
    deliveryIdempotencyKey,
    hashSalt,
  );
  const visitorKey = deriveContactVisitorKey(request, hashSalt);
  const beginRateLimit = dependencies.beginRateLimit ?? beginContactSubmission;
  const completeRateLimit =
    dependencies.completeRateLimit ?? completeContactSubmission;
  let limit: ContactRateLimitDecision;

  try {
    limit = await beginRateLimit({
      visitorKey,
      reservationKey,
      attemptId: requestId,
      environment,
      now: new Date(submittedAt).getTime(),
    });
  } catch {
    limit = { allowed: false, reason: "unavailable", retryAfter: 30 };
  }

  if (!limit.allowed) {
    if (limit.reason === "unavailable") {
      log("delivery-unavailable", 503, {
        bodyBytes,
        reason: "abuse-protection-unavailable",
      });
      return jsonResponse(
        {
          submitted: false,
          unavailable: true,
          error:
            "Online delivery is temporarily unavailable. Your browser copy remains unchanged; use the visible email, copy, or download options instead.",
          requestId,
        },
        503,
        requestId,
      );
    }

    log("request-rejected", 429, {
      bodyBytes,
      reason: `rate-limit-${limit.reason}`,
    });
    const retryAfter = String(Math.max(1, limit.retryAfter));
    return jsonResponse(
      {
        submitted: false,
        rateLimited: true,
        error:
          limit.reason === "in-flight"
            ? "An identical enquiry is already being processed. Wait briefly before checking again."
            : "This submission channel has reached its current allowance. Try again later or use the email, copy, or download options.",
        requestId,
      },
      429,
      requestId,
      { "Retry-After": retryAfter },
    );
  }

  if (limit.replayed) {
    log("delivery-accepted", 202, {
      bodyBytes,
      reason: "idempotent-replay",
    });
    return jsonResponse(
      {
        submitted: true,
        status: "already-accepted",
        message:
          "This enquiry was already accepted for delivery. Keep the request reference for follow-up.",
        requestId,
      },
      202,
      requestId,
    );
  }

  const lease = limit.lease;
  if (!lease) {
    log("delivery-unavailable", 503, {
      bodyBytes,
      reason: "reservation-unavailable",
    });
    return jsonResponse(
      {
        submitted: false,
        unavailable: true,
        error:
          "Online delivery is temporarily unavailable. Your browser copy remains unchanged; use the visible email, copy, or download options instead.",
        requestId,
      },
      503,
      requestId,
    );
  }

  try {
    await deliver({
      configuration,
      enquiry: parsed.data,
      idempotencyKey: deliveryIdempotencyKey,
      requestId,
      submittedAt,
    });
  } catch (error) {
    await completeRateLimit(lease, "failed", {
      environment,
      now: new Date(submittedAt).getTime(),
    }).catch(() => false);
    log("delivery-failed", 502, {
      bodyBytes,
      reason: deliveryFailureReason(error),
    });
    return jsonResponse(
      {
        submitted: false,
        error:
          "The delivery service did not accept this enquiry. Your browser copy remains available; retry once or use the email, copy, or download options.",
        requestId,
      },
      502,
      requestId,
    );
  }

  const reservationFinalized = await completeRateLimit(lease, "delivered", {
    environment,
    now: new Date(submittedAt).getTime(),
  }).catch(() => false);
  if (!reservationFinalized) {
    log("reservation-finalization-failed", 202, {
      bodyBytes,
      reason: "delivery-accepted-reservation-not-finalized",
    });
  }

  log("delivery-accepted", 202, { bodyBytes });
  return jsonResponse(
    {
      submitted: true,
      status: "accepted-for-delivery",
      message:
        "Your enquiry was accepted for delivery. Keep the request reference for follow-up.",
      requestId,
    },
    202,
    requestId,
  );
}
