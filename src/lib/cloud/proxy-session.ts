import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getCloudConfiguration } from "./config";

export async function refreshCloudSession(request: NextRequest) {
  const configuration = getCloudConfiguration();
  if (!configuration) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const client = createServerClient(
    configuration.url,
    configuration.publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not remove this call: it validates and refreshes an expiring session.
  await client.auth.getUser();
  return response;
}
