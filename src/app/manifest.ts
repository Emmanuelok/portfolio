import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kingxford Studio — The Living Room",
    short_name: "Kingxford",
    description:
      "The multidisciplinary design practice of Emmanuel Kingsford Owusu—digital products, visual systems, research experiences, and intelligent platforms.",
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
