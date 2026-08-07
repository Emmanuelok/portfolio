import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getCloudConfiguration } from "./config";

export async function createServerCloudClient() {
  const configuration = getCloudConfiguration();
  if (!configuration) return null;

  const cookieStore = await cookies();
  return createServerClient(configuration.url, configuration.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. The proxy refreshes
          // sessions; Route Handlers can write these values normally.
        }
      },
    },
  });
}
