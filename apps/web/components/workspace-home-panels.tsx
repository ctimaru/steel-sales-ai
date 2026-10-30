"use client";

import { useEffect, useState, type ReactNode } from "react";

type WorkspaceHomeView = "overview" | "tasks" | "activity" | "opportunities" | "pulse";

const navigation: { id: WorkspaceHomeView; label: string; description: string }[] = [
  { id: "overview", label: "Panoramica", description: "Il tuo punto di partenza" },
  { id: "tasks", label: "Da fare", description: "Prossime azioni" },
  { id: "activity", label: "Attività", description: "Movimenti commerciali" },
  { id: "opportunities", label: "Opportunità", description: "Network e Marketplace" },
  { id: "pulse", label: "Steel Pulse", description: "Segnali e notizie" },
];

/**
 * HOME-AUTH-UX1: presentation-only navigation. All sections are still rendered
 * from the existing server-side, tenant/entitlement-scoped queries.
 * No client fetch, elevated permissions or synthetic AI responses.
 */
export function WorkspaceHomePanels({
  attentionCount, overview, tasks, activity, opportunities, pulse,
}: {
  attentionCount: number;
  overview: ReactNode;
  tasks: ReactNode;
  activity: ReactNode;
  opportunities: ReactNode;
  pulse: ReactNode;
}) {
  const [active, setActive] = useState<WorkspaceHomeView>("overview");
  useEffect(() => {
    function syncDeepLink() {
      if (window.location.hash === "#dashboard-discovery") setActive("opportunities");
      if (window.location.hash === "#dashboard-pulse-heading") setActive("pulse");
    }
    syncDeepLink();
    window.addEventListener("hashchange", syncDeepLink);
    return () => window.removeEventListener("hashchange", syncDeepLink);
  }, []);

  const views: Record<WorkspaceHomeView, ReactNode> = {
    overview, tasks, activity, opportunities, pulse,
  };
  const navButton = (view: (typeof navigation)[number], mobile: boolean) => {
    const selected = active === view.id;
    return (
      <button
        key={view.id}
        type="button"
        onClick={() => setActive(view.id)}
        aria-pressed={selected}
        aria-controls={"workspace-home-" + view.id}
        className={
          "group flex shrink-0 items-center text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246a50] " +
          (mobile
            ? "min-h-11 gap-2 rounded-lg border px-3 text-xs font-semibold "
            : "min-h-12 w-full justify-between gap-2 rounded-lg border-l-[3px] px-3 py-2 text-sm ") +
          (selected
            ? "border-[#1c684b] bg-[#eaf3ed] font-semibold text-[#174f3a]"
            : "border-transparent text-[#4d6156] hover:border-[#c5d9cb] hover:bg-[#f4f8f5]")
        }
      >
        <span className="min-w-0">
          <span className="block">{view.label}</span>
          {!mobile ? <span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#607268]">{view.description}</span> : null}
        </span>
        {view.id === "tasks" && attentionCount > 0 ? (
          <span className="rounded-full bg-[#d9e9df] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#175640]">
            {attentionCount}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div data-testid="workspace-home-navigation" className="grid min-w-0 items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-5">
      <nav aria-label="Sezioni della Home" className="flex min-w-0 gap-2 overflow-x-auto pb-1 lg:hidden">
        {navigation.map((view) => navButton(view, true))}
      </nav>
      <nav aria-label="Sezioni della Home" className="hidden rounded-2xl border border-[#d9e5dd] bg-white p-2 lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-1">
        <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#698075]">La tua Home</div>
        {navigation.map((view) => navButton(view, false))}
      </nav>
      <div className="min-w-0">
        {navigation.map((view) => (
          <section
            key={view.id}
            id={"workspace-home-" + view.id}
            aria-label={view.label}
            hidden={active !== view.id}
            className="min-w-0"
            data-testid={"workspace-home-panel-" + view.id}
          >
            {views[view.id]}
          </section>
        ))}
      </div>
    </div>
  );
}
