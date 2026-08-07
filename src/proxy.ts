import { type NextRequest, NextResponse } from "next/server";

import { refreshCloudSession } from "@/lib/cloud/proxy-session";

export async function proxy(request: NextRequest) {
  // Workflow DevKit signs and handles this internal route itself. Session
  // refresh must not intercept or mutate its request/response.
  if (request.nextUrl.pathname.startsWith("/.well-known/workflow/")) {
    return NextResponse.next();
  }
  return refreshCloudSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|\\.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2)$).*)",
  ],
};
