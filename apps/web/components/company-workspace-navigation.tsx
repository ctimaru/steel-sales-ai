"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export const companyWorkspaceSections = [
  { id: "summary", label: "Riepilogo", group: "Profilo", icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" },
  { id: "overview", label: "Identità aziendale", group: "Profilo", icon: "M3 21h18 M5 21V4h14v17 M9 8h1 M14 8h1 M9 12h1 M14 12h1 M10 21v-5h4v5" },
  { id: "positioning", label: "Ruolo nella filiera", group: "Profilo", icon: "M4 7h16 M4 12h16 M4 17h16 M8 4v6 M16 9v6 M10 14v6" },
  { id: "products", label: "Prodotti e cataloghi", group: "Profilo", icon: "M12 3 21 8v8l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v8" },
  { id: "facilities", label: "Sedi e lavorazioni", group: "Profilo", icon: "M3 21V10l6 3V7l6 4V3h5l1 18z M7 17h2 M12 17h2 M17 17h2" },
  { id: "markets", label: "Mercati e settori", group: "Profilo", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2c5 5 5 15 0 20 M12 2c-5 5-5 15 0 20" },
  { id: "certifications", label: "Certificazioni", group: "Profilo", icon: "M12 16a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M8 15l-2 7 6-3 6 3-2-7 M10 10l1 1 3-3" },
  { id: "contacts", label: "Contatti pubblici", group: "Profilo", icon: "M3 5h18v14H3z M3 6l9 7 9-7" },
  { id: "stock", label: "Stock e arrivi", group: "Operatività", icon: "M3 21V8l9-5 9 5v13 M3 21h18 M7 21v-8h10v8 M7 17h10" },
  { id: "inquiries", label: "Preferenze di contatto", group: "Operatività", icon: "M3 4h18v13H9l-6 4z M7 9h10 M7 12h6" },
] as const;

type SectionId = (typeof companyWorkspaceSections)[number]["id"];

function sectionFromHash(): SectionId {
  const id = window.location.hash.slice(1);
  if (id === "company-description") return "overview";
  if (id === "products-catalogues" || id === "products-add" || /^products-item-[0-9a-f-]+$/i.test(id)) return "products";
  if (id === "facilities-add" || /^facilities-item-[0-9a-f-]+$/i.test(id)) return "facilities";
  if (id === "markets-add" || /^markets-item-[0-9a-f-]+$/i.test(id)) return "markets";
  if (id === "certifications-add" || /^certifications-item-[0-9a-f-]+$/i.test(id)) return "certifications";
  return companyWorkspaceSections.find((section) => section.id === id)?.id ?? "summary";
}

export function CompanyWorkspaceNavigation({ panels }: { panels: Record<SectionId, ReactNode> }) {
  const [active, setActive] = useState<SectionId>("summary");
  const pathname = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => {
    const sync = () => setActive(sectionFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [pathname, query]);

  useEffect(() => {
    const focusEditorTarget = () => {
      const hash = window.location.hash.slice(1);
      const matchesDescription = active === "overview" && hash === "company-description";
      const matchesProduct = active === "products" && (hash === "products-catalogues" || hash === "products-add" || /^products-item-[0-9a-f-]+$/i.test(hash));
      const matchesFacility = active === "facilities" && (hash === "facilities-add" || /^facilities-item-[0-9a-f-]+$/i.test(hash));
      const matchesMarket = active === "markets" && (hash === "markets-add" || /^markets-item-[0-9a-f-]+$/i.test(hash));
      const matchesCertification = active === "certifications" && (hash === "certifications-add" || /^certifications-item-[0-9a-f-]+$/i.test(hash));
      if (!matchesDescription && !matchesProduct && !matchesFacility && !matchesMarket && !matchesCertification) return;
      const target = document.getElementById(hash);
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "start" });
      }
    };
    focusEditorTarget();
    window.addEventListener("hashchange", focusEditorTarget);
    return () => window.removeEventListener("hashchange", focusEditorTarget);
  }, [active, pathname, query]);

  function select(id: SectionId) {
    if (window.location.hash !== "#" + id) {
      window.history.pushState(null, "", "#" + id);
    }
    setActive(id);
  }

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[224px_minmax(0,1fr)]" data-testid="company-workspace">
      <nav aria-label="Gestione azienda" className="flex min-w-0 gap-1 overflow-x-auto rounded-2xl border border-[#dce2df] bg-white p-2 lg:sticky lg:top-4 lg:block lg:p-3">
        {["Profilo", "Operatività"].map((group) => (
          <div key={group} className="shrink-0 lg:mb-2 lg:last:mb-0">
            <p className="hidden px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#66736e] lg:block">{group}</p>
            <div className="flex gap-1 lg:flex-col">
              {companyWorkspaceSections.filter((section) => section.group === group).map((section) => (
                <a
                  key={section.id}
                  href={"#" + section.id}
                  aria-current={active === section.id ? "page" : undefined}
                  aria-controls={"company-panel-" + section.id}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    select(section.id);
                  }}
                  className={"flex min-h-11 min-w-0 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold outline-offset-2 transition lg:whitespace-normal lg:text-sm " + (active === section.id ? "bg-[#e5f0eb] text-[#1a5144]" : "text-[#52625b] hover:bg-[#f2f6f3] hover:text-[#1a5144]")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true"><path d={section.icon} /></svg>
                  <span>{section.label}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="min-w-0" data-testid="company-workspace-panels">
        {companyWorkspaceSections.map((section) => (
          <div key={section.id} id={"company-panel-" + section.id} hidden={active !== section.id} className="min-w-0 space-y-4">
            {panels[section.id]}
          </div>
        ))}
      </div>
    </div>
  );
}
