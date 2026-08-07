import type { NextRequest } from "next/server";

import {
  handleContactDiagnostic,
  handleContactPost,
} from "@/lib/contact/handler";

export const runtime = "nodejs";
export const maxDuration = 15;
export const dynamic = "force-dynamic";

export async function GET() {
  return handleContactDiagnostic();
}

export async function POST(request: NextRequest) {
  return handleContactPost(request);
}
