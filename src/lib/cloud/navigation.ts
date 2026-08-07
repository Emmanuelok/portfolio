export function safeCloudReturnPath(value: string | null | undefined, fallback = "/create/workspace") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "https://kingxford.local");
    if (parsed.origin !== "https://kingxford.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
