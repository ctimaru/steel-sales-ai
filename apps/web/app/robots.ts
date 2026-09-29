import type { MetadataRoute } from "next";

import { absoluteUrl, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/knowledge", "/knowledge/"],
        disallow: [
          "/api/",
          "/dashboard",
          "/commercial/",
          "/operations/",
          "/company/",
          "/platform/",
          "/network",
          "/network/",
          "/marketplace",
          "/marketplace/",
          "/school",
          "/school/",
          "/knowledge-center",
          "/login",
          "/register",
          "/registration/",
          "/forgot-password",
          "/reset-password",
          "/onboarding",
          "/auth/",
          "/evidence/",
          "/tubi-norme",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
