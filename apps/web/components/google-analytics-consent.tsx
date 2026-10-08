"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  ANALYTICS_CONSENT_VERSION,
  ANALYTICS_NOTICE_VERSION,
  LEGACY_ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentRecordIsCurrent,
  createAnalyticsConsentRecord,
  parseAnalyticsConsentRecord,
  type AnalyticsConsentDecision,
  type AnalyticsConsentRecord,
} from "@/lib/analytics-consent";

type AnalyticsConsent = AnalyticsConsentDecision | null;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  __sssGaConfigured?: string;
};

function isPublicMeasurementPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/knowledge") ||
    pathname.startsWith("/azienda") ||
    pathname.startsWith("/distinta") ||
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

function PrivacyShield() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 3.5 19 6v5.2c0 4.6-2.8 7.7-7 9.3-4.2-1.6-7-4.7-7-9.3V6l7-2.5Z" />
      <path d="m9.5 12 1.6 1.6 3.5-3.7" />
    </svg>
  );
}

export function GoogleAnalyticsConsent({
  measurementId,
}: {
  measurementId?: string;
}) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsent>(null);
  const [consentRecord, setConsentRecord] = useState<AnalyticsConsentRecord | null>(null);
  const [consentReady, setConsentReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const shouldMeasure = useMemo(
    () => Boolean(measurementId) && isPublicMeasurementPath(pathname),
    [measurementId, pathname],
  );

  useEffect(() => {
    if (!measurementId) return;

    const stored = parseAnalyticsConsentRecord(
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
    );

    if (stored && analyticsConsentRecordIsCurrent(stored)) {
      setConsentRecord(stored);
      setConsent(stored.decision);
      setConsentReady(true);
      return;
    }

    if (stored?.decision === "granted") {
      clearGoogleAnalyticsCookies();
    }
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);

    if (window.localStorage.getItem(LEGACY_ANALYTICS_CONSENT_STORAGE_KEY)) {
      window.localStorage.removeItem(LEGACY_ANALYTICS_CONSENT_STORAGE_KEY);
    }

    setConsentRecord(null);
    setConsent(null);
    setConsentReady(true);
  }, [measurementId]);

  useEffect(() => {
    if (!measurementId || !shouldMeasure) return;

    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
    analyticsWindow.gtag =
      analyticsWindow.gtag ??
      function gtag(...args: unknown[]) {
        analyticsWindow.dataLayer?.push(args);
      };

    if (analyticsWindow.__sssGaConfigured !== measurementId) {
      analyticsWindow.gtag("js", new Date());
      analyticsWindow.gtag("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      analyticsWindow.__sssGaConfigured = measurementId;
    }
  }, [measurementId, shouldMeasure]);

  useEffect(() => {
    if (!measurementId || !shouldMeasure || !consentReady || consent === null) return;

    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow.gtag?.("consent", "update", {
      analytics_storage: consent === "granted" ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    if (consent === "denied") {
      clearGoogleAnalyticsCookies();
    }
  }, [consent, consentReady, measurementId, shouldMeasure]);

  useEffect(() => {
    if (!measurementId || !shouldMeasure || !consentReady) return;

    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow.gtag?.("event", "page_view", {
      page_path: `${pathname}${window.location.search}`,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [consentReady, measurementId, pathname, shouldMeasure]);

  if (!measurementId || !shouldMeasure) return null;

  function choose(nextConsent: Exclude<AnalyticsConsent, null>) {
    const nextRecord = createAnalyticsConsentRecord(nextConsent);
    window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      JSON.stringify(nextRecord),
    );
    setConsentRecord(nextRecord);
    setConsent(nextConsent);
    setSettingsOpen(false);

    const analyticsWindow = window as AnalyticsWindow;
    analyticsWindow.gtag?.("consent", "update", {
      analytics_storage: nextConsent === "granted" ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    if (nextConsent === "denied") {
      clearGoogleAnalyticsCookies();
    } else if (consent !== "granted" && shouldMeasure) {
      // On the first opt-in, emit a granted hit immediately.
      // The initial cookieless page_view was sent before the visitor chose.
      analyticsWindow.gtag?.("event", "page_view", {
        page_path: `${pathname}${window.location.search}`,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }

  const showPanel = consent === null || settingsOpen;
  const currentLabel =
    consent === "granted"
      ? "Accettato"
      : consent === "denied"
        ? "Necessari"
        : "Scelta non espressa";

  return (
    <>
      {showPanel ? (
        <section
          role="dialog"
          aria-label="Cookie e privacy"
          aria-modal="false"
          className="fixed bottom-3 left-3 right-3 z-[100] ml-auto max-w-[560px] rounded-2xl border border-[#c9d8d2] bg-white/98 p-4 shadow-[0_12px_36px_rgba(17,54,45,0.14)] backdrop-blur sm:bottom-4 sm:left-auto sm:right-4"
        >
          <button
            type="button"
            onClick={() => choose("denied")}
            aria-label="Continua solo con cookie necessari"
            title="Accetta necessari"
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full text-base font-medium text-[#718078] transition hover:bg-[#f1f5f3] hover:text-[#173f35]"
          >
            ×
          </button>

          <div className="pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#173f35]">Cookie e privacy</p>
              {consent !== null ? (
                <span className="rounded-full bg-[#f1f5f3] px-2 py-1 text-[10px] font-semibold text-[#66736e]">
                  {currentLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 max-w-lg text-xs leading-5 text-[#52615b]">
              Usiamo cookie necessari per il sito e Google Analytics in Consent Mode. Prima della tua scelta Analytics resta senza cookie; se accetti, abiliti la misurazione statistica completa sulle sole pagine pubbliche.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[#718078]">
              <Link href="/privacy" className="font-semibold text-[#1a5144] underline underline-offset-4">
                Privacy
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/cookies" className="font-semibold text-[#1a5144] underline underline-offset-4">
                Cookie Policy
              </Link>
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => choose("denied")}
              className="min-h-10 rounded-xl border border-[#b9cbc4] bg-white px-3 text-xs font-bold text-[#43524c] transition hover:bg-[#f6f8f7]"
            >
              Accetta necessari
            </button>
            <button
              type="button"
              onClick={() => choose("granted")}
              className="min-h-10 rounded-xl border border-[#9ebcaf] bg-[#edf5f2] px-3 text-xs font-bold text-[#173f35] transition hover:bg-[#e4efeb]"
            >
              Accetta
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Riapri preferenze cookie e privacy"
          title="Cookie e privacy"
          className="group fixed bottom-4 left-0 z-[90] flex h-9 items-center gap-1.5 rounded-r-full border border-l-0 border-[#cbd8d3] bg-white/95 pl-2.5 pr-3 text-[10px] font-bold text-[#52615b] shadow-sm backdrop-blur transition hover:border-[#8fb5a8] hover:bg-white hover:text-[#173f35]"
        >
          <PrivacyShield />
          <span>Privacy</span>
          <span className="sr-only">
            · consenso {consentRecord?.decision ?? "non espresso"} · versione {ANALYTICS_CONSENT_VERSION} · informativa {ANALYTICS_NOTICE_VERSION}
          </span>
        </button>
      )}
    </>
  );
}
