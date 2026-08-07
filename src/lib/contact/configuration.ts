import { validatedContactEmail } from "@/lib/contact/contracts";
import {
  contactAbuseProtectionBackend,
  type ContactAbuseProtectionBackend,
} from "@/lib/contact/rate-limit";

export type ContactEnvironment = Readonly<Record<string, string | undefined>>;

export type ContactDeliveryConfiguration = Readonly<{
  apiKey: string;
  fromEmail: string;
  inboxEmail: string;
  publicEmail: string;
}>;

export type ContactDeliveryReadiness = Readonly<{
  configured: boolean;
  deliveryConfigured: boolean;
  publicEmail: string | null;
  abuseProtection: ContactAbuseProtectionBackend;
}>;

export function getContactDeliveryConfiguration(
  environment: ContactEnvironment = process.env,
): ContactDeliveryConfiguration | null {
  const apiKeyCandidate = environment.RESEND_API_KEY?.trim();
  const apiKey =
    apiKeyCandidate && /^re_[A-Za-z0-9_-]{16,}$/.test(apiKeyCandidate)
      ? apiKeyCandidate
      : null;
  const fromEmail = validatedContactEmail(
    environment.CONTACT_FROM_EMAIL?.trim(),
  );
  const inboxEmail = validatedContactEmail(
    environment.CONTACT_INBOX_EMAIL?.trim(),
  );
  const publicEmail = validatedContactEmail(
    environment.NEXT_PUBLIC_CONTACT_EMAIL?.trim(),
  );

  if (!apiKey || !fromEmail || !inboxEmail || !publicEmail) return null;
  return { apiKey, fromEmail, inboxEmail, publicEmail };
}

export function getContactDeliveryReadiness(
  environment: ContactEnvironment = process.env,
): ContactDeliveryReadiness {
  const publicEmail = validatedContactEmail(
    environment.NEXT_PUBLIC_CONTACT_EMAIL?.trim(),
  );
  const deliveryConfigured =
    getContactDeliveryConfiguration(environment) !== null;
  const abuseProtection = contactAbuseProtectionBackend(environment);
  return {
    configured: deliveryConfigured && abuseProtection.ready,
    deliveryConfigured,
    publicEmail,
    abuseProtection,
  };
}
