import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { GoogleAnalyticsConsent } from "@/components/google-analytics-consent";
import { ProductAnalyticsIngestion } from "@/components/product-analytics-ingestion";
import { PublicLegalFooter } from "@/components/public-legal-footer";
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
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [{ url: "/pwa-icon/192", sizes: "192x192", type: "image/png" }],
  },
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
  const googleAnalyticsId =
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() || "G-F5QWLD98HD";

  const googleConsentBootstrap = `
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
window.gtag("consent", "default", {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  wait_for_update: 500
});
window.gtag("set", "ads_data_redaction", true);
`;

  const googleAnalyticsConfig = `
(function() {
  var path = window.location.pathname;
  var shouldMeasure =
    path === "/" ||
    path.indexOf("/knowledge") === 0 ||
    path.indexOf("/azienda") === 0 ||
    path.indexOf("/register") === 0 ||
    path.indexOf("/login") === 0;

  if (!shouldMeasure) return;

  window.gtag("js", new Date());
  window.gtag("config", "${googleAnalyticsId}", {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  window.__sssGaConfigured = "${googleAnalyticsId}";
})();
`;

  return (
    <html lang="it">
      <head>
        <script
          id="sss-google-consent-bootstrap"
          dangerouslySetInnerHTML={{ __html: googleConsentBootstrap }}
        />
        <script
          id="sss-google-analytics"
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
        />
        <script
          id="sss-google-analytics-config"
          dangerouslySetInnerHTML={{ __html: googleAnalyticsConfig }}
        />
      </head>
      <body>
        {children}
        <PublicLegalFooter />
        <ProductAnalyticsIngestion />
        <GoogleAnalyticsConsent measurementId={googleAnalyticsId} />
      </body>
    </html>
  );
}
