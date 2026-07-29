import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Emmanuel Kingsford Owusu — Design Portfolio",
    short_name: "EK Portfolio",
    description:
      "Digital products, visual systems, research experiences, and intelligent platforms by Emmanuel Kingsford Owusu.",
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
