export type CloudConfiguration = Readonly<{
  url: string;
  publishableKey: string;
}>;

const publicCloudEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

function isHttpsOrLocalhost(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      || (url.protocol === "http:"
        && (url.hostname === "localhost" || url.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

/**
 * Returns `null` rather than throwing when cloud services have not been
 * provisioned. This keeps local Canvas and Atlas projects available on first
 * deploys, previews, and self-hosted installations.
 */
export function getCloudConfiguration(
  environment: Readonly<Record<string, string | undefined>> = publicCloudEnvironment,
): CloudConfiguration | null {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !publishableKey || !isHttpsOrLocalhost(url)) return null;
  return { url, publishableKey };
}

export function getCloudAvailability(
  environment: Readonly<Record<string, string | undefined>> = publicCloudEnvironment,
) {
  const configured = getCloudConfiguration(environment) !== null;
  return configured
    ? {
        configured: true as const,
        mode: "cloud-and-local" as const,
        message: "Secure cloud projects are available after sign-in. Local projects remain available.",
      }
    : {
        configured: false as const,
        mode: "local-only" as const,
        message: "Cloud projects are not configured on this deployment. Local Canvas and Atlas projects remain available on this device.",
      };
}
