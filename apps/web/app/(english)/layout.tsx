import type { ReactNode } from "react";
import { SiteDocument, metadata, viewport } from "@/app/site-document";

export { metadata, viewport };

export default function EnglishRootLayout({ children }: { children: ReactNode }) {
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
