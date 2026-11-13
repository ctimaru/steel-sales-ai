"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * NET-PROFILE-UX4 — Company Hub: shared Free/Pro navigation.
 * Only sections backed by authorized data are passed from the server.
 * Server-rendered panels stay mounted for profile SEO and keyboard access.
 */
export type NetworkProfileHubSection = {
  id: string;
  title: string;
  summary: string;
  icon: "products" | "contacts" | "connections" | "stock" | "documents";
  content?: ReactNode;
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
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.65"
      strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
  );
}

/**
 * UX6: five destinations are visible for every company. Never hide one
 * because data is pending; selected panels communicate actual availability.
 */
export function NetworkProfileHub({ sections }: { sections: NetworkProfileHubSection[] }) {
  const [selected, setSelected] = useState("attivita");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  function selectSection(sectionId: string) {
    setSelected(sectionId);
    // On narrow screens the detail panel sits below the card grid. Bring it
    // into view after selection rather than leaving the user on the card row.
    if (window.matchMedia("(max-width: 639px)").matches) {
      window.requestAnimationFrame(() => {
        document.getElementById("company-hub-panel-" + sectionId)?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      });
    }
  }

  function openTarget(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    const summary = target.querySelector("summary");
    if (summary instanceof HTMLElement) summary.focus({ preventScroll: true });
  }

  if (!sections.length) return null;
  const activeId = sections.some((section) => section.id === selected)
    ? selected : sections[0].id;
  return (
    <section aria-label="Esplora le informazioni aziendali"
      data-testid="network-company-card-hub" data-ready={ready ? "true" : "false"}
      className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4f8060]">Company Hub</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#173b2b] sm:text-2xl">
            Esplora le informazioni
          </h2>
        </div>
        <p className="text-xs text-[#637569]">Seleziona un'area per aprire i dettagli</p>
      </div>
      <div role="group" aria-label="Naviga la scheda"
        className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-5"
        data-testid="network-company-section-nav">
        {sections.map((section) => {
          const current = activeId === section.id;
          return (
            <button key={section.id} type="button" disabled={!ready}
              aria-pressed={current} aria-controls={"company-hub-panel-" + section.id}
              onClick={() => selectSection(section.id)}
              data-testid={"network-company-card-" + section.id}
              className={"group flex min-h-[160px] min-w-0 flex-col items-start gap-2 rounded-[20px] border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#205840] sm:min-h-[142px] sm:p-4 " +
                (current
                  ? "border-[#24724f] bg-[#eff8f1] shadow-[0_12px_26px_-23px_rgba(21,85,48,0.55)]"
                  : "border-[#dfe8e1] bg-white shadow-[0_10px_26px_-24px_rgba(13,69,43,0.35)] hover:-translate-y-0.5 hover:border-[#a5c9af] hover:bg-[#f9fcfa]")}>
              <span className={"flex h-9 w-9 items-center justify-center rounded-xl " +
                (current ? "bg-[#d9eee0] text-[#175b3d]" : "bg-[#f1f6f2] text-[#406c4f]")}>
                <HubIcon kind={section.icon} />
              </span>
              <span className="block min-w-0 flex-1">
                <span className="block break-words text-[13px] font-bold leading-5 text-[#183e2d] sm:text-sm">{section.title}</span>
                <span className="mt-1 block break-words text-xs leading-[1.45] text-[#6a786e]">{section.summary}</span>
              </span>
              <span className="self-end text-sm font-bold text-[#31714c]" aria-hidden="true">
                {current ? "↓" : "↗"}
              </span>
            </button>
          );
        })}
      </div>
      {sections.map((section) => (
        <div key={section.id} id={"company-hub-panel-" + section.id}
          role="region" aria-label={section.title}
          data-testid={"network-company-panel-" + section.id}
          hidden={activeId !== section.id}
          className={activeId === section.id
            ? "min-w-0 scroll-mt-24 rounded-[24px] border border-[#e0e8e2] bg-white p-4 shadow-[0_16px_38px_-34px_rgba(18,70,44,0.36)] sm:p-6 lg:p-7"
            : "hidden"}>
          {section.content}
          {section.targetId ? (
            <button type="button" onClick={() => openTarget(section.targetId!)}
              data-testid="network-profile-open-details"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#bdd6c3] bg-white px-4 text-sm font-semibold text-[#215a3d] hover:bg-[#eff7f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#205840]">
              {section.targetLabel || "Apri approfondimenti pubblicati"} <span aria-hidden="true" className="ml-2">↓</span>
            </button>
          ) : null}
        </div>
      ))}
    </section>
  );
}
