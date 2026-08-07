import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null | undefined;

/**
 * Server-only, optional privileged client for signed background workflows.
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` and either `SUPABASE_URL` or
 * `NEXT_PUBLIC_SUPABASE_URL`. It is deliberately lazy and returns `null` when
 * unconfigured so builds and local-first deployments remain operational.
 * Never import this module from a Client Component or expose the role key.
 */
export function createServiceCloudClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase service client is available only in the server runtime.");
  }
  if (serviceClient !== undefined) return serviceClient;
  const url = (
    process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    serviceClient = null;
    return serviceClient;
  }

  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:"
      && !(parsed.protocol === "http:"
        && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"))
    ) {
      serviceClient = null;
      return serviceClient;
    }
  } catch {
    serviceClient = null;
    return serviceClient;
  }

  serviceClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "kingxford-workflow-service" },
    },
  });
  return serviceClient;
}
