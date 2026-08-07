import { CloudHttpError } from "./http";

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

/**
 * Protects cookie-authenticated cloud mutations from cross-site submission.
 * Origin is required even when cookies are configured SameSite; that cookie
 * attribute is useful defense-in-depth, not the primary CSRF decision.
 */
export function requireCloudMutationRequest(
  request: Request,
  options: Readonly<{ json?: boolean }> = {},
) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin === "null") {
    throw new CloudHttpError(
      403,
      "origin_required",
      "This cloud change can be submitted only from the Kingxford site.",
    );
  }
  if (fetchSite && fetchSite !== "same-origin") {
    throw new CloudHttpError(
      403,
      "cross_origin_request_denied",
      "This cloud change can be submitted only from the Kingxford site.",
    );
  }

  const requestUrl = new URL(request.url);
  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host")) ||
    requestUrl.host;
  const protocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
    requestUrl.protocol.replace(":", "");
  let candidate: URL;
  try {
    candidate = new URL(origin);
  } catch {
    throw new CloudHttpError(
      403,
      "cross_origin_request_denied",
      "This cloud change can be submitted only from the Kingxford site.",
    );
  }
  if (candidate.host !== host || candidate.protocol !== `${protocol}:`) {
    throw new CloudHttpError(
      403,
      "cross_origin_request_denied",
      "This cloud change can be submitted only from the Kingxford site.",
    );
  }

  if (options.json) {
    const mediaType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLocaleLowerCase("en");
    if (mediaType !== "application/json") {
      throw new CloudHttpError(
        415,
        "content_type_required",
        "A JSON cloud project request is required.",
      );
    }
  }
}
