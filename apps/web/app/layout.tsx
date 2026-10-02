import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { googleSiteVerification } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f4f3",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Smart Steel Sales",
  title: {
    default: "Smart Steel Sales",
    template: "%s · Smart Steel Sales",
  },
  description:
    "Piattaforma B2B per il settore acciaio e tubo: Commercial Memory, Network e Steel Knowledge pubblico su norme, gradi, dimensioni e pesi.",
  appleWebApp: {
    capable: true,
    title: "Smart Steel Sales",
    statusBarStyle: "default",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: googleSiteVerification(),
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
