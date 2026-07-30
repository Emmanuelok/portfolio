import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kingxford",
    short_name: "Kingxford",
    description:
      "Kingxford is a multidisciplinary creative company spanning Studio, Living Room, and Lab.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07090d",
    theme_color: "#07090d",
    orientation: "any",
    lang: "en",
    categories: ["design", "portfolio", "productivity"],
  };
}
