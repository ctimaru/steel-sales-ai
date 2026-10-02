import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Smart Steel Sales",
    short_name: "Smart Steel",
    description:
      "Piattaforma B2B per il settore acciaio e tubo: Commercial Memory, Network, Marketplace e Scuola.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2f4f3",
    theme_color: "#1a5144",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
