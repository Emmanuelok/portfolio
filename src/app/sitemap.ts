import type { MetadataRoute } from "next";

import { websiteShowcases } from "@/data/creations";
import { mediaPosts } from "@/data/media";
import { projects } from "@/data/projects";

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://kingxford.co"
).replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-02T00:00:00.000Z");

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/work`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/create`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/create/workspace`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/media`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/lab`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.6,
    },
  ];

  const projectRoutes: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${baseUrl}/work/${project.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: project.featured ? 0.85 : 0.75,
    images: [`${baseUrl}${project.cover}`],
  }));

  const mediaRoutes: MetadataRoute.Sitemap = mediaPosts.map((post) => ({
    url: `${baseUrl}/media/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly",
    priority: post.featured ? 0.8 : 0.7,
    images: [`${baseUrl}${post.cover}`],
  }));

  const creationRoutes: MetadataRoute.Sitemap = websiteShowcases.map(
    (showcase) => ({
      url: `${baseUrl}/create/${showcase.slug}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    }),
  );

  return [
    ...staticRoutes,
    ...creationRoutes,
    ...projectRoutes,
    ...mediaRoutes,
  ];
}
