"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Keep the search UI, analytics handlers and result renderer out of the
// initial homepage bundle. Only load them when the section is near viewport.
const LazyCompanyLookup = dynamic(
  () => import("@/components/public-company-lookup").then((module) => module.PublicCompanyLookup),
  { ssr: false },
);

export function DeferredPublicCompanyLookup() {
  const marker = useRef<HTMLDivElement>(null);
  const [loadSearch, setLoadSearch] = useState(false);

  useEffect(() => {
    if (loadSearch) return;
    if (typeof IntersectionObserver === "undefined") {
      setLoadSearch(true);
      return;
    }
    const element = marker.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoadSearch(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadSearch]);

  return (
    <div ref={marker} data-testid="perf21-deferred-company-lookup" className="min-h-[280px]">
      {loadSearch ? (
        <LazyCompanyLookup />
      ) : (
        <div className="flex min-h-[280px] flex-col justify-center rounded-[28px] border border-[#dce2df] bg-[#f8faf9] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
            Trova la tua azienda
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
            È già presente su Smart Steel Sales?
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#5d6a65]">
            Cerca per ragione sociale o Partita IVA. Mostriamo solo i dati necessari a
            verificare se il profilo è rivendicabile.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setLoadSearch(true)}
              className="platform-primary inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold"
            >
              Cerca azienda
            </button>
            <Link
              href="/azienda"
              className="inline-flex min-h-11 items-center text-xs font-semibold text-[#1a5144] underline underline-offset-4"
            >
              Vai alla ricerca completa
            </Link>
          </div>
          <noscript>
            <p className="mt-3 text-sm text-[#52615b]">
              La ricerca è disponibile anche dalla pagina Trova azienda.
            </p>
          </noscript>
        </div>
      )}
    </div>
  );
}
