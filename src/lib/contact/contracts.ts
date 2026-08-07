export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  organization: 140,
  problem: 6_000,
  affected: 4_000,
  evidence: 6_000,
  future: 4_000,
  constraints: 5_000,
  investment: 3_000,
  honeypot: 160,
  requestBytes: 42_000,
} as const;

export const CONTACT_RETENTION_TARGET_DAYS = 90;

export const contactHorizons = [
  "Immediate response · 0–90 days",
  "Pilot and evidence · 3–12 months",
  "Institutional development · 1–3 years",
  "Long-horizon transformation · 3+ years",
] as const;

export type ContactHorizon = (typeof contactHorizons)[number];

export type ProjectEnquiry = Readonly<{
  idempotencyKey: string;
  name: string;
  email: string;
  organization: string;
  brief: Readonly<{
    problem: string;
    affected: string;
    evidence: string;
    future: string;
    constraints: string;
    investment: string;
    horizon: ContactHorizon;
  }>;
  consent: true;
  website: string;
}>;

export function validatedContactEmail(value: string | undefined | null) {
  if (!value || value.length > CONTACT_LIMITS.email || value !== value.trim()) {
    return null;
  }
  if (!/^[\x21-\x7e]+$/.test(value)) return null;

  const [local, domain, ...extra] = value.split("@");
  if (!local || !domain || extra.length || local.length > 64) return null;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return null;
  }

  const labels = domain.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label),
    )
  ) {
    return null;
  }

  return `${local}@${domain.toLocaleLowerCase("en")}`;
}
