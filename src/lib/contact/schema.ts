import { z } from "zod";

import {
  CONTACT_LIMITS,
  contactHorizons,
  validatedContactEmail,
} from "@/lib/contact/contracts";

const unsafeControlCharacters =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function safeText(options: Readonly<{ min?: number; max: number }>) {
  return z
    .string()
    .max(options.max)
    .refine((value) => !unsafeControlCharacters.test(value), {
      message: "Unsupported control characters are not allowed.",
    })
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(options.min ?? 0)
        .max(options.max),
    );
}

const emailSchema = z
  .string()
  .max(CONTACT_LIMITS.email)
  .refine((value) => !unsafeControlCharacters.test(value))
  .transform((value) => value.trim())
  .pipe(
    z.string().refine((value) => validatedContactEmail(value) !== null, {
      message: "Enter a valid email address.",
    }),
  )
  .transform((value) => validatedContactEmail(value) as string);

export const projectEnquirySchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(16)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    name: safeText({ min: 2, max: CONTACT_LIMITS.name }),
    email: emailSchema,
    organization: safeText({ max: CONTACT_LIMITS.organization }),
    brief: z
      .object({
        problem: safeText({ min: 30, max: CONTACT_LIMITS.problem }),
        affected: safeText({ min: 10, max: CONTACT_LIMITS.affected }),
        evidence: safeText({ max: CONTACT_LIMITS.evidence }),
        future: safeText({ min: 10, max: CONTACT_LIMITS.future }),
        constraints: safeText({ max: CONTACT_LIMITS.constraints }),
        investment: safeText({ max: CONTACT_LIMITS.investment }),
        horizon: z.enum(contactHorizons),
      })
      .strict(),
    consent: z.literal(true),
    website: safeText({ max: CONTACT_LIMITS.honeypot }),
  })
  .strict();

export const likelySecretPatterns = [
  /\bsk-[A-Za-z0-9_-]{24,}\b/,
  /\bgh[oprsu]_[A-Za-z0-9]{28,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bAIza[A-Za-z0-9_-]{30,}\b/,
  /\b(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|CLIENT_SECRET|PRIVATE_KEY)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i,
] as const;

export function containsLikelySecret(value: string) {
  return likelySecretPatterns.some((pattern) => pattern.test(value));
}
