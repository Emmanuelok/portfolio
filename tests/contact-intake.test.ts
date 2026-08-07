import assert from "node:assert/strict";
import test from "node:test";

import { contactHorizons, type ProjectEnquiry } from "../src/lib/contact/contracts";
import {
  deriveDeliveryIdempotencyKey,
  handleContactDiagnostic,
  handleContactPost,
  isSameOriginRequest,
  type ContactLogger,
} from "../src/lib/contact/handler";
import {
  beginContactSubmission,
  completeContactSubmission,
  contactAbuseProtectionBackend,
  deriveContactVisitorKey,
} from "../src/lib/contact/rate-limit";
import { projectEnquirySchema } from "../src/lib/contact/schema";

const deliveryEnvironment = {
  RESEND_API_KEY: "re_private_resend_key_1234567890",
  CONTACT_FROM_EMAIL: "projects@kingxford.co",
  CONTACT_INBOX_EMAIL: "inbox@kingxford.co",
  NEXT_PUBLIC_CONTACT_EMAIL: "hello@kingxford.co",
  KINGXFORD_USAGE_HASH_SALT: "contact-test-salt-with-more-than-32-characters",
  KINGXFORD_ALLOW_EPHEMERAL_CONTACT: "1",
} as const;

const validEnquiry = {
  idempotencyKey: "4c22b748-654b-4f00-8e87-21f1e8ae5c4c",
  name: "  Ada Mensah  ",
  email: "ada@Example.COM",
  organization: "  Civic Research Lab  ",
  brief: {
    problem:
      "  Public evidence is distributed across incompatible records and difficult to audit.  ",
    affected: "  Researchers and public administrators  ",
    evidence: "  An initial records inventory exists.\r\nImportant gaps remain.  ",
    future: "  A traceable evidence workflow with explicit review.  ",
    constraints: "  Privacy and data-residency requirements.  ",
    investment: "  A small research team and an existing repository.  ",
    horizon: contactHorizons[1],
  },
  consent: true,
  website: "",
} as const;

function contactRequest(
  body: unknown,
  options: Readonly<{
    contentType?: string;
    origin?: string;
    host?: string;
    fetchSite?: string;
    declaredLength?: string;
    forwardedFor?: string;
    userAgent?: string;
  }> = {},
) {
  const headers = new Headers({
    "Content-Type": options.contentType ?? "application/json",
    Origin: options.origin ?? "https://kingxford.co",
    Host: options.host ?? "kingxford.co",
    "Sec-Fetch-Site": options.fetchSite ?? "same-origin",
    "X-Forwarded-For": options.forwardedFor ?? "203.0.113.42",
    "User-Agent": options.userAgent ?? "Kingxford contact test browser",
  });
  if (options.declaredLength) {
    headers.set("Content-Length", options.declaredLength);
  }

  return new Request("https://kingxford.co/api/contact", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("the strict enquiry schema normalizes safe fields and rejects contract drift", () => {
  const parsed = projectEnquirySchema.parse(validEnquiry);

  assert.equal(parsed.name, "Ada Mensah");
  assert.equal(parsed.email, "ada@example.com");
  assert.equal(parsed.organization, "Civic Research Lab");
  assert.equal(
    parsed.brief.evidence,
    "An initial records inventory exists.\nImportant gaps remain.",
  );

  assert.equal(
    projectEnquirySchema.safeParse({ ...validEnquiry, hiddenAuthority: "approve" })
      .success,
    false,
  );
  assert.equal(
    projectEnquirySchema.safeParse({ ...validEnquiry, consent: false }).success,
    false,
  );
  assert.equal(
    projectEnquirySchema.safeParse({
      ...validEnquiry,
      name: "Ada\u202EMensah",
    }).success,
    false,
  );
});

test("same-origin enforcement compares origin, host, protocol, and fetch metadata", () => {
  assert.equal(isSameOriginRequest(contactRequest(validEnquiry)), true);
  assert.equal(
    isSameOriginRequest(
      contactRequest(validEnquiry, { origin: "https://attacker.example" }),
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      contactRequest(validEnquiry, { origin: "http://kingxford.co" }),
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      contactRequest(validEnquiry, { fetchSite: "cross-site" }),
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      new Request("https://kingxford.co/api/contact", {
        method: "POST",
        headers: { Host: "kingxford.co", "Content-Type": "application/json" },
        body: JSON.stringify(validEnquiry),
      }),
    ),
    false,
  );
});

test("the handler rejects non-JSON, oversized, secret-bearing, and honeypot requests", async () => {
  const baseDependencies = {
    environment: deliveryEnvironment,
    logger: (() => undefined) satisfies ContactLogger,
    requestId: () => "contact-test-rejected",
  };

  const nonJson = await handleContactPost(
    contactRequest(validEnquiry, { contentType: "text/plain" }),
    baseDependencies,
  );
  assert.equal(nonJson.status, 415);
  assert.equal((await nonJson.json()).submitted, false);

  const oversized = await handleContactPost(
    contactRequest(validEnquiry, { declaredLength: "999999" }),
    baseDependencies,
  );
  assert.equal(oversized.status, 413);

  const secret = await handleContactPost(
    contactRequest({
      ...validEnquiry,
      brief: {
        ...validEnquiry.brief,
        evidence: `Accidentally included sk-${"a".repeat(36)}`,
      },
    }),
    baseDependencies,
  );
  assert.equal(secret.status, 422);
  assert.match((await secret.json()).error, /credential or private key/i);

  const honeypot = await handleContactPost(
    contactRequest({ ...validEnquiry, website: "https://bot.invalid" }),
    baseDependencies,
  );
  assert.equal(honeypot.status, 400);
  assert.equal((await honeypot.json()).submitted, false);
});

test("an unconfigured deployment never claims that an enquiry was submitted", async () => {
  let deliveryCalled = false;
  const response = await handleContactPost(contactRequest(validEnquiry), {
    environment: {
      NEXT_PUBLIC_CONTACT_EMAIL: "hello@kingxford.co",
    },
    deliver: async () => {
      deliveryCalled = true;
      return { accepted: true };
    },
    logger: () => undefined,
    requestId: () => "contact-test-unconfigured",
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.submitted, false);
  assert.equal(body.unavailable, true);
  assert.equal(deliveryCalled, false);
  assert.doesNotMatch(JSON.stringify(body), /RESEND_API_KEY|re_private_resend/);
});

test("delivery fails closed when visitor protection is absent or non-durable on a shared deployment", async () => {
  let deliveryCalled = false;
  const missingProtection = await handleContactPost(contactRequest(validEnquiry), {
    environment: {
      RESEND_API_KEY: deliveryEnvironment.RESEND_API_KEY,
      CONTACT_FROM_EMAIL: deliveryEnvironment.CONTACT_FROM_EMAIL,
      CONTACT_INBOX_EMAIL: deliveryEnvironment.CONTACT_INBOX_EMAIL,
      NEXT_PUBLIC_CONTACT_EMAIL: deliveryEnvironment.NEXT_PUBLIC_CONTACT_EMAIL,
    },
    deliver: async () => {
      deliveryCalled = true;
      return { accepted: true };
    },
    logger: () => undefined,
    requestId: () => "contact-test-missing-protection",
  });
  assert.equal(missingProtection.status, 503);
  assert.equal((await missingProtection.json()).submitted, false);
  assert.equal(deliveryCalled, false);

  const productionBackend = contactAbuseProtectionBackend({
    NODE_ENV: "production",
    VERCEL: "1",
    KINGXFORD_USAGE_HASH_SALT:
      deliveryEnvironment.KINGXFORD_USAGE_HASH_SALT,
    KINGXFORD_ALLOW_EPHEMERAL_CONTACT: "1",
  });
  assert.deepEqual(productionBackend, {
    kind: "missing",
    configured: false,
    durable: false,
    ready: false,
  });
});

test("visitor identity is a server-keyed pseudonym and never contains raw request headers", () => {
  const request = contactRequest(validEnquiry, {
    forwardedFor: "198.51.100.29",
    userAgent: "Privacy Test Browser/7.0",
  });
  const key = deriveContactVisitorKey(
    request,
    deliveryEnvironment.KINGXFORD_USAGE_HASH_SALT,
  );

  assert.match(key, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(key, /198\.51\.100\.29|Privacy Test Browser/);
  assert.equal(
    key,
    deriveContactVisitorKey(
      contactRequest(validEnquiry, {
        forwardedFor: "198.51.100.29",
        userAgent: "Rotated Attacker-Controlled Agent/99.0",
      }),
      deliveryEnvironment.KINGXFORD_USAGE_HASH_SALT,
    ),
    "changing a caller-controlled user-agent must not create a fresh network quota",
  );
  assert.notEqual(
    key,
    deriveContactVisitorKey(
      contactRequest(validEnquiry, {
        forwardedFor: "198.51.100.30",
        userAgent: "Privacy Test Browser/7.0",
      }),
      deliveryEnvironment.KINGXFORD_USAGE_HASH_SALT,
    ),
  );
});

test("the bounded local limiter enforces its allowance and preserves completed idempotency", async () => {
  const now = Date.UTC(2026, 7, 6, 20, 0, 0);
  const visitorKey = `contact-limiter-${crypto.randomUUID()}`;
  const reservationKeys = Array.from(
    { length: 4 },
    (_, index) => `reservation-${index}-${crypto.randomUUID()}`,
  );

  for (let index = 0; index < 3; index += 1) {
    const decision = await beginContactSubmission({
      visitorKey,
      reservationKey: reservationKeys[index],
      attemptId: `attempt-${index}`,
      environment: deliveryEnvironment,
      now,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.allowed && decision.replayed, false);
    assert.ok(decision.allowed && decision.lease);
    if (decision.allowed && decision.lease) {
      assert.equal(
        await completeContactSubmission(decision.lease, "delivered", {
          environment: deliveryEnvironment,
          now,
        }),
        true,
      );
    }
  }

  const replay = await beginContactSubmission({
    visitorKey,
    reservationKey: reservationKeys[0],
    attemptId: "replay-attempt",
    environment: deliveryEnvironment,
    now,
  });
  assert.equal(replay.allowed, true);
  assert.equal(replay.allowed && replay.replayed, true);

  const limited = await beginContactSubmission({
    visitorKey,
    reservationKey: reservationKeys[3],
    attemptId: "limited-attempt",
    environment: deliveryEnvironment,
    now,
  });
  assert.equal(limited.allowed, false);
  assert.equal(!limited.allowed && limited.reason, "ten-minute");
  assert.ok(!limited.allowed && limited.retryAfter > 0);
});

test("a failed delivery reservation permits one bounded retry", async () => {
  const now = Date.UTC(2026, 7, 6, 21, 0, 0);
  const visitorKey = `contact-retry-${crypto.randomUUID()}`;
  const reservationKey = `contact-retry-reservation-${crypto.randomUUID()}`;

  const first = await beginContactSubmission({
    visitorKey,
    reservationKey,
    attemptId: "delivery-attempt-one",
    environment: deliveryEnvironment,
    now,
  });
  assert.ok(first.allowed && first.lease);
  if (first.allowed && first.lease) {
    assert.equal(
      await completeContactSubmission(first.lease, "failed", {
        environment: deliveryEnvironment,
        now,
      }),
      true,
    );
  }

  const second = await beginContactSubmission({
    visitorKey,
    reservationKey,
    attemptId: "delivery-attempt-two",
    environment: deliveryEnvironment,
    now: now + 1_000,
  });
  assert.ok(second.allowed && second.lease);
  if (second.allowed && second.lease) {
    assert.equal(
      await completeContactSubmission(second.lease, "failed", {
        environment: deliveryEnvironment,
        now: now + 1_000,
      }),
      true,
    );
  }

  const exhausted = await beginContactSubmission({
    visitorKey,
    reservationKey,
    attemptId: "delivery-attempt-three",
    environment: deliveryEnvironment,
    now: now + 2_000,
  });
  assert.equal(exhausted.allowed, false);
  assert.equal(!exhausted.allowed && exhausted.reason, "duplicate");
  assert.ok(!exhausted.allowed && exhausted.retryAfter > 0);
});

test("a completed duplicate is acknowledged without a second delivery attempt", async () => {
  const enquiry = {
    ...validEnquiry,
    idempotencyKey: `contact-idempotency-${crypto.randomUUID()}`,
  };
  let deliveryCalls = 0;
  const deliver = async () => {
    deliveryCalls += 1;
    return { accepted: true as const };
  };

  const first = await handleContactPost(
    contactRequest(enquiry, { forwardedFor: "192.0.2.90" }),
    {
      environment: deliveryEnvironment,
      deliver,
      logger: () => undefined,
      now: () => new Date("2026-08-06T20:00:00.000Z"),
      requestId: () => "contact-idempotency-first",
    },
  );
  const second = await handleContactPost(
    contactRequest(enquiry, { forwardedFor: "192.0.2.90" }),
    {
      environment: deliveryEnvironment,
      deliver,
      logger: () => undefined,
      now: () => new Date("2026-08-06T20:00:01.000Z"),
      requestId: () => "contact-idempotency-second",
    },
  );

  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.equal((await second.json()).status, "already-accepted");
  assert.equal(deliveryCalls, 1);
});

test("rate-limited responses include a bounded Retry-After header", async () => {
  const response = await handleContactPost(contactRequest(validEnquiry), {
    environment: deliveryEnvironment,
    beginRateLimit: async () => ({
      allowed: false,
      reason: "ten-minute",
      retryAfter: 37,
    }),
    deliver: async () => {
      assert.fail("delivery must not run after a rate-limit decision");
    },
    logger: () => undefined,
    requestId: () => "contact-test-rate-limited",
  });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "37");
  assert.equal((await response.json()).submitted, false);
});

test("accepted delivery is idempotent, bounded, and exposes no provider secret", async () => {
  const logs: Parameters<ContactLogger>[0][] = [];
  let delivered:
    | Readonly<{
        enquiry: ProjectEnquiry;
        idempotencyKey: string;
      }>
    | undefined;
  const response = await handleContactPost(contactRequest(validEnquiry), {
    environment: deliveryEnvironment,
    deliver: async ({ enquiry, idempotencyKey, configuration }) => {
      delivered = { enquiry, idempotencyKey };
      assert.equal(configuration.apiKey, "re_private_resend_key_1234567890");
      return { accepted: true };
    },
    logger: (event) => logs.push(event),
    now: () => new Date("2026-08-06T20:00:00.000Z"),
    requestId: () => "contact-test-accepted",
  });
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.submitted, true);
  assert.equal(body.status, "accepted-for-delivery");
  assert.ok(delivered);
  assert.equal(
    delivered.idempotencyKey,
    deriveDeliveryIdempotencyKey(delivered.enquiry),
  );
  assert.equal(logs.at(-1)?.event, "delivery-accepted");
  const publicOutput = JSON.stringify({ body, logs });
  assert.doesNotMatch(publicOutput, /re_private_resend/);
  assert.doesNotMatch(publicOutput, /Ada Mensah|ada@example.com|Public evidence/);
});

test("provider failures are sanitized and retain an honest submission state", async () => {
  const logs: Parameters<ContactLogger>[0][] = [];
  const response = await handleContactPost(contactRequest(validEnquiry), {
    environment: deliveryEnvironment,
    deliver: async () => {
      throw new Error("provider leaked re_private_resend_key_1234567890");
    },
    logger: (event) => logs.push(event),
    requestId: () => "contact-test-provider-failure",
  });
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.submitted, false);
  assert.doesNotMatch(JSON.stringify({ body, logs }), /re_private_resend/);
  assert.equal(logs.at(-1)?.reason, "unclassified-delivery-failure");
});

test("the public diagnostic reports capability without configuration values", async () => {
  const configured = await handleContactDiagnostic({
    environment: deliveryEnvironment,
    requestId: () => "contact-test-diagnostic",
  });
  const readyBody = await configured.json();
  assert.deepEqual(readyBody.onlineSubmission, {
    available: true,
    status: "ready",
  });
  assert.deepEqual(readyBody.abuseProtection, {
    available: true,
    durable: false,
    mode: "local-bounded",
  });
  assert.equal(readyBody.deliveryProviderConfigured, true);
  assert.equal(readyBody.fallbackEmailAvailable, true);
  assert.doesNotMatch(JSON.stringify(readyBody), /re_private_resend|inbox@/);

  const unavailable = await handleContactDiagnostic({
    environment: {},
    requestId: () => "contact-test-diagnostic-unavailable",
  });
  const unavailableBody = await unavailable.json();
  assert.equal(unavailableBody.onlineSubmission.available, false);
  assert.equal(unavailableBody.abuseProtection.available, false);
  assert.equal(unavailableBody.fallbackEmailAvailable, false);

  const noPublicChannel = await handleContactDiagnostic({
    environment: {
      RESEND_API_KEY: "re_private_resend_key_1234567890",
      CONTACT_FROM_EMAIL: "projects@kingxford.co",
      CONTACT_INBOX_EMAIL: "inbox@kingxford.co",
      KINGXFORD_USAGE_HASH_SALT:
        deliveryEnvironment.KINGXFORD_USAGE_HASH_SALT,
      KINGXFORD_ALLOW_EPHEMERAL_CONTACT: "1",
    },
    requestId: () => "contact-test-diagnostic-no-public-channel",
  });
  assert.equal(
    (await noPublicChannel.json()).onlineSubmission.available,
    false,
    "online intake remains closed until a public privacy/deletion channel exists",
  );
});
