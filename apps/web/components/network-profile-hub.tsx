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

export function NetworkProfileHub({ sections }: { sections: NetworkProfileHubSection[] }) {
  const [selected, setSelected] = useState(
    sections.find((section) => section.content !== undefined)?.id ?? "",
  );
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!sections.length) return null;

  function openTarget(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section aria-label="Esplora le informazioni aziendali" data-testid="network-company-card-hub" data-ready={ready ? "true" : "false"}
      className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4e745b]">
            Company Hub
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#173f35] sm:text-xl">
            Esplora l'azienda
          </h2>
        </div>
        <span className="text-xs text-[#607567]">Seleziona una card per i dettagli</span>
      </div>

      <div aria-label="Naviga la scheda"
        className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
        data-testid="network-company-section-nav">
        {sections.map((section) => {
          const current = selected === section.id && section.content !== undefined;
          return (
            <button key={section.id} type="button" disabled={!ready}
              aria-pressed={current}
              aria-controls={section.content !== undefined ? "company-hub-panel-" + section.id : undefined}
              onClick={() => section.targetId ? openTarget(section.targetId) : setSelected(section.id)}
              className={"group flex min-h-[140px] min-w-0 flex-col items-start gap-3 rounded-[20px] border p-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#205840] sm:p-4 " +
                (current
                  ? "border-[#356e4e] bg-[#eef7f0] shadow-[0_8px_26px_-20px_rgba(16,82,46,0.6)]"
                  : "border-[#dce7df] bg-white hover:border-[#a2c5aa] hover:bg-[#f7fbf8]")}
              data-testid={"network-company-card-" + section.id}>
              <span className={"flex h-10 w-10 items-center justify-center rounded-xl " +
                (current ? "bg-[#dcefe1] text-[#17573c]" : "bg-[#f0f6f1] text-[#366a4a]")}>
                <HubIcon kind={section.icon} />
              </span>
              <span className="flex w-full min-w-0 flex-1 flex-col">
                <span className="break-words text-sm font-semibold leading-5 text-[#173f35]">{section.title}</span>
                <span className="mt-1 break-words text-[11px] leading-4 text-[#63776a]">{section.summary}</span>
              </span>
              <span className="self-end text-[#427759]" aria-hidden="true">{current ? "↓" : "↗"}</span>
            </button>
          );
        })}
      </div>

      {sections.filter((section) => section.content !== undefined).map((section) => (
        <div key={section.id} id={"company-hub-panel-" + section.id}
          role="region" aria-label={section.title}
          data-testid={"network-company-panel-" + section.id}
          className={selected === section.id
            ? "min-w-0 rounded-[22px] border border-[#dce6df] bg-white p-4 shadow-[0_10px_34px_-30px_rgba(11,53,34,0.25)] sm:p-6"
            : "hidden"}>
          {section.content}
        </div>
      ))}
    </section>
  );
}
