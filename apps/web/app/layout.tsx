import type { Metadata } from "next";
import type { ReactNode } from "react";

import { siteUrl } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Steel Sales AI",
  title: {
    default: "Steel Sales AI",
    template: "%s · Steel Sales AI",
  },
  description:
    "Piattaforma B2B per il settore acciaio e tubo: Commercial Memory, Network e Steel Knowledge pubblico su norme, gradi, dimensioni e pesi.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
