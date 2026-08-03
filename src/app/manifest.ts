import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "kingXford & Co",
    short_name: "kingXford & Co",
    description:
      "Intelligence, research and development, and responsible AI for sustainable abundance.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07090d",
    theme_color: "#07090d",
    orientation: "any",
    lang: "en",
    categories: ["research", "education", "productivity", "news"],
  };
}
