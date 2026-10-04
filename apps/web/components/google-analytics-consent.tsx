"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "sss.google-analytics-consent.v1";

type AnalyticsConsent = "granted" | "denied" | null;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
};

function isPublicMeasurementPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/knowledge") ||
    pathname.startsWith("/azienda") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/login")
  );
}

function clearGoogleAnalyticsCookies() {
  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));

  for (const name of cookieNames) {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.smartsteelsales.com; SameSite=Lax`;
  }
}

export function GoogleAnalyticsConsent({
  measurementId,
}: {
  measurementId?: string;
}) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsent>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const shouldMeasure = useMemo(
    () => Boolean(measurementId) && isPublicMeasurementPath(pathname),
    [measurementId, pathname],
  );

  useEffect(() => {
    if (!measurementId) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "granted" || stored === "denied") {
      setConsent(stored);
    }
  }, [measurementId]);

  useEffect(() => {
    if (!measurementId || !shouldMeasure || consent !== "granted") return;

    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
    analyticsWindow.gtag =
      analyticsWindow.gtag ??
      function gtag(...args: unknown[]) {
        analyticsWindow.dataLayer?.push(args);
      };

    analyticsWindow.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    analyticsWindow.gtag("js", new Date());
    analyticsWindow.gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    analyticsWindow.gtag("event", "page_view", {
      page_path: `${pathname}${window.location.search}`,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [consent, measurementId, pathname, shouldMeasure]);

  if (!measurementId || !shouldMeasure) return null;

  function choose(nextConsent: Exclude<AnalyticsConsent, null>) {
    window.localStorage.setItem(STORAGE_KEY, nextConsent);
    setConsent(nextConsent);
    setSettingsOpen(false);

    const analyticsWindow = window as AnalyticsWindow;
    if (nextConsent === "denied") {
      analyticsWindow.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      clearGoogleAnalyticsCookies();
    }
  }

  const showPanel = consent === null || settingsOpen;

  return (
    <>
      {consent === "granted" ? (
        <Script
          id="sss-google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
          strategy="afterInteractive"
        />
      ) : null}

      {showPanel ? (
        <section
          role="dialog"
          aria-label="Preferenze statistiche"
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-[#c9ddd5] bg-white p-4 shadow-[0_18px_55px_rgba(11,47,39,0.20)] sm:bottom-5 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#173f35]">Statistiche del sito</p>
              <p className="mt-1 text-xs leading-5 text-[#52615b]">
                Possiamo usare Google Analytics per capire quali pagine pubbliche vengono visitate e da quali sorgenti arriva il traffico. Il tag non viene caricato finché non accetti.
              </p>
              <p className="mt-2 text-[11px] leading-5 text-[#66736e]">
                Leggi la{" "}
                <Link href="/privacy" className="font-bold text-[#1a5144] underline underline-offset-4">
                  Privacy Policy
                </Link>{" "}
                e la{" "}
                <Link href="/cookies" className="font-bold text-[#1a5144] underline underline-offset-4">
                  Cookie & Tracking Policy
                </Link>.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => choose("denied")}
                className="min-h-11 rounded-xl border border-[#cbd8d3] bg-white px-4 text-xs font-bold text-[#43524c] hover:border-[#8fb5a8]"
              >
                Solo necessari
              </button>
              <button
                type="button"
                onClick={() => choose("granted")}
                className="min-h-11 rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white hover:bg-[#225c4d]"
              >
                Accetta statistiche
              </button>
            </div>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="fixed bottom-3 left-3 z-[90] min-h-9 rounded-full border border-[#cbd8d3] bg-white/95 px-3 text-[10px] font-bold text-[#52615b] shadow-sm backdrop-blur hover:border-[#8fb5a8] hover:text-[#173f35]"
        >
          Preferenze statistiche
        </button>
      )}
    </>
  );
}
