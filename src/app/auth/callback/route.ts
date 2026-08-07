import { NextResponse } from "next/server";

import { safeCloudReturnPath } from "@/lib/cloud/navigation";
import { createServerCloudClient } from "@/lib/cloud/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeCloudReturnPath(url.searchParams.get("next"));
  const client = await createServerCloudClient();

  if (!client || !code) {
    const destination = new URL("/auth", url.origin);
    destination.searchParams.set("next", next);
    destination.searchParams.set("status", client ? "invalid-link" : "not-configured");
    return NextResponse.redirect(destination, 303);
  }

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    const destination = new URL("/auth", url.origin);
    destination.searchParams.set("next", next);
    destination.searchParams.set("status", "invalid-link");
    return NextResponse.redirect(destination, 303);
  }

  return NextResponse.redirect(new URL(next, url.origin), 303);
}
