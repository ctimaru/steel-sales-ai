"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Company Hub — compact, accessible tabs instead of oversized navigation cards.
 * Every panel remains mounted: no extra request or page reload on selection.
 * Only authorized, server-provided content is ever displayed.
 */
export type NetworkProfileHubSection = {
  id: string;
  title: string;
  summary: string;
  icon: "products" | "contacts" | "connections" | "stock" | "documents";
  content?: ReactNode;
  count?: number;
  targetId?: string;
  targetLabel?: string;
};

function HubIcon({ kind }: { kind: NetworkProfileHubSection["icon"] }) {
  const paths: Record<NetworkProfileHubSection["icon"], ReactNode> = {
    products: <><path d="M3 21V8l7 4V8l7 4V3h4v18H3Z" /><path d="M7 17h2m4 0h2m4 0h1" /></>,
    contacts: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.5-1.6 1.5-2 3-2s2.5.4 3 2m3-6h3m-3 4h3" /></>,
    connections: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="m10.5 7-4 8m7-8 4 8M8 18h8" /></>,
    stock: <><path d="M3 10 12 5l9 5v10H3V10Z" /><path d="M3 10h18M8 20v-7h8v7M12 13v7" /></>,
    documents: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h4M9 12h6m-6 4h6" /></>,
  };
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
  );
}

export function NetworkProfileHub({ sections }: { sections: NetworkProfileHubSection[] }) {
  const [selected, setSelected] = useState(sections[0]?.id ?? "attivita");
  const [ready, setReady] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => setReady(true), []);

  function selectSection(sectionId: string) {
    setSelected(sectionId);
    // Avoid the old jump on every click; scroll only when details would be
    // below the mobile viewport. Reduced motion remains respected.
    if (window.matchMedia("(max-width: 639px)").matches) {
      window.requestAnimationFrame(() => {
        const panel = document.getElementById("company-hub-panel-" + sectionId);
        if (panel && panel.getBoundingClientRect().top > window.innerHeight - 100) {
          panel.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start",
          });
        }
      });
    }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = sections.length - 1;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + sections.length) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    selectSection(sections[next].id);
    tabs.current[next]?.focus();
  }

  function openTarget(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    const summary = target.querySelector("summary");
    if (summary instanceof HTMLElement) summary.focus({ preventScroll: true });
  }

  if (!sections.length) return null;
  const activeId = sections.some((section) => section.id === selected) ? selected : sections[0].id;

  return (
    <section aria-label="Informazioni aziendali" data-testid="network-company-card-hub"
      data-profile-navigation="compact-tabs" data-ready={ready ? "true" : "false"}
      className="min-w-0 overflow-hidden rounded-2xl border border-[#dce7df] bg-white">
      <div role="tablist" aria-label="Naviga la scheda aziendale"
        data-testid="network-company-section-nav"
        className="flex min-w-0 gap-0.5 overflow-x-auto border-b border-[#e4ebe6] px-2 sm:px-4 [scrollbar-width:thin]">
        {sections.map((section, index) => {
          const current = activeId === section.id;
          return (
            <button key={section.id} type="button" role="tab"
              ref={(element) => { tabs.current[index] = element; }}
              disabled={!ready} tabIndex={current ? 0 : -1}
              aria-selected={current} aria-pressed={current}
              aria-controls={"company-hub-panel-" + section.id}
              id={"company-hub-tab-" + section.id}
              title={section.summary}
              onClick={() => selectSection(section.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              data-testid={"network-company-card-" + section.id}
              className={"relative inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#206b4c] sm:px-4 sm:text-sm " +
                (current
                  ? "border-[#1b6848] bg-[#f2f8f4] text-[#174b35]"
                  : "border-transparent text-[#546b5c] hover:bg-[#f7faf8] hover:text-[#205840]")}>
              <HubIcon kind={section.icon} />
              <span>{section.title}</span>
              {typeof section.count === "number" && section.count > 0 ?
                <span className="rounded-full bg-[#e5f1e8] px-1.5 py-0.5 text-[11px] tabular-nums text-[#24593e]">{section.count}</span> : null}
            </button>
          );
        })}
      </div>
      {sections.map((section) => (
        <div key={section.id} id={"company-hub-panel-" + section.id}
          role="tabpanel" aria-labelledby={"company-hub-tab-" + section.id}
          aria-label={section.title} tabIndex={0}
          data-testid={"network-company-panel-" + section.id}
          hidden={activeId !== section.id}
          className={activeId === section.id
            ? "min-w-0 scroll-mt-20 px-4 py-5 sm:px-6 sm:py-6"
            : "hidden"}>
          {section.content}
          {section.targetId ? (
            <button type="button" onClick={() => openTarget(section.targetId!)}
              data-testid="network-profile-open-details"
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#bdd6c3] px-3.5 text-sm font-semibold text-[#215a3d] transition hover:bg-[#eff7f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#205840]">
              {section.targetLabel || "Apri approfondimenti pubblicati"} <span aria-hidden="true" className="ml-2">↓</span>
            </button>
          ) : null}
        </div>
      ))}
    </section>
  );
}
