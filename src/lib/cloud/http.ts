import { ZodError } from "zod";

import { logOperationalEvent } from "@/lib/observability/structured-log";

export class CloudHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly headers?: HeadersInit;

  constructor(
    status: number,
    code: string,
    message: string,
    options: Readonly<{ details?: unknown; headers?: HeadersInit }> = {},
  ) {
    super(message);
    this.name = "CloudHttpError";
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.headers = options.headers;
  }
}

export function cloudJson(
  body: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie, X-Kingxford-Organization-Id");
  return Response.json(body, { ...init, headers });
}

export function cloudErrorResponse(error: unknown) {
  if (error instanceof CloudHttpError) {
    return cloudJson(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: error.status, headers: error.headers },
    );
  }

  if (error instanceof ZodError) {
    return cloudJson(
      {
        ok: false,
        error: {
          code: "invalid_request",
          message: "The request does not match the required cloud contract.",
          details: error.issues.map(({ path, message }) => ({
            path: path.join("."),
            message,
          })),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return cloudJson(
      { ok: false, error: { code: "invalid_json", message: "The request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const candidate =
    error && typeof error === "object"
      ? (error as { name?: unknown; status?: unknown; code?: unknown })
      : undefined;
  logOperationalEvent("error", "cloud.request.failed", {
    errorName:
      typeof candidate?.name === "string" ? candidate.name : "unknown",
    status:
      typeof candidate?.status === "number" ? candidate.status : undefined,
    errorCode:
      typeof candidate?.code === "string" ? candidate.code : undefined,
  });
  return cloudJson(
    {
      ok: false,
      error: {
        code: "cloud_request_failed",
        message: "The cloud request could not be completed. Local projects remain available.",
      },
    },
    { status: 500 },
  );
}

export async function parseBoundedJsonRequest(
  request: Request,
  maximumBytes = 5_000_000,
) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new CloudHttpError(413, "request_too_large", "The cloud project request is too large.");
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maximumBytes) {
    throw new CloudHttpError(413, "request_too_large", "The cloud project request is too large.");
  }
  return JSON.parse(body) as unknown;
}
