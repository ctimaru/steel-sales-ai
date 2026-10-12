"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentRecordIsCurrent,
  parseAnalyticsConsentRecord,
} from "@/lib/analytics-consent";
import { chooseBd17Arm, recordBd17Once, type Bd17Arm } from "@/lib/bd17-cta-experiment";
import { trackProductEvent } from "@/lib/product-analytics-events.client";
import { appRoutes } from "@/lib/routes";

const BD17_ENABLED = process.env.NEXT_PUBLIC_BD17_CTA_EXPERIMENT !== "off";

export function Bd17GuestRfqCta({ eligible, onNavigate }: {
  eligible: boolean;
  onNavigate: () => void;
}) {
  const [arm, setArm] = useState<Bd17Arm>("control");
  const [ready, setReady] = useState(false);
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!BD17_ENABLED) return;
    setArm(chooseBd17Arm(window.sessionStorage, Math.random()));
    setReady(true);
  }, []);

  function hasConsent() {
    try {
      const record = parseAnalyticsConsentRecord(
        window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
      );
      return record?.decision === "granted" && analyticsConsentRecordIsCurrent(record);
    } catch {
      return false;
    }
  }

  function recordView() {
    if (!BD17_ENABLED || !eligible || !ready || !hasConsent()) return;
    recordBd17Once(window.sessionStorage, arm, "view", trackProductEvent);
  }

  function handleClick() {
    // The draft handoff and login route are identical in both arms.
    onNavigate();
    if (!BD17_ENABLED || !eligible || !ready || !hasConsent()) return;
    // A visitor may opt into analytics while the CTA is already visible.
    recordView();
    recordBd17Once(window.sessionStorage, arm, "click", trackProductEvent);
  }

  useEffect(() => {
    if (!BD17_ENABLED || !ready || !eligible || !linkRef.current) return;
    const target = linkRef.current;
    if (typeof IntersectionObserver === "undefined") {
      recordView();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && document.visibilityState === "visible") {
        recordView();
      }
    }, { threshold: 0.35 });
    observer.observe(target);
    const onVisible = () => {
      if (document.visibilityState === "visible") recordView();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Handler is derived solely from these stable primitive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, eligible, arm]);

  const clarity = BD17_ENABLED && ready && arm === "clarity";
  return (
    <p className="mt-3 text-xs leading-5 text-[#52615b]">
      {clarity ? "La distinta resta gratuita. " : "La distinta è gratuita e copiabile. "}
      <Link
        ref={linkRef}
        href={"/login?next=" + encodeURIComponent(appRoutes.rfqHub.createDistinta)}
        onClick={handleClick}
        className="font-bold underline underline-offset-2"
      >
        {clarity ? "Accedi e scegli i fornitori per una RFQ privata" : "Accedi per creare una RFQ privata"}
      </Link>.
      {clarity ? " Nessun invio parte senza la tua conferma." : null}
    </p>
  );
}
