import type { MetadataRoute } from "next";

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://kingxford.co"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/.well-known/workflow/",
        "/account",
        "/accept-invitation",
        "/auth",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
