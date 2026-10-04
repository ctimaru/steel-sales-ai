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
    prefer_related_applications: false,
    shortcuts: [
      {
        name: "Calcolatore peso tubo",
        short_name: "Calcola peso",
        description: "Apri direttamente il calcolatore pubblico kg/m, barre e tonnellate.",
        url: "/knowledge/tubes?source=direct&surface=direct#calcolatore-pesi",
        icons: [
          {
            src: "/pwa-icon/192",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Scuola Smart Steel Sales",
        short_name: "Scuola",
        description: "Norme, gradi, pesi e dimensioni per il settore acciaio e tubo.",
        url: "/knowledge",
      },
    ],
    icons: [
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
