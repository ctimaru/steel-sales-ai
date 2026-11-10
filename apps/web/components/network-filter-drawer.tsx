"use client";

import { useState, type ReactNode } from "react";

/** Responsive, accessible sidebar: visible on desktop, compact disclosure on mobile.
 * Keep the map outside this drawer so country discovery is always available. */
export function NetworkFilterDrawer({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="network-filter-drawer">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="network-filter-panel"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[#cbded2] bg-[#f5faf6] px-4 text-sm font-semibold text-[#173f35] shadow-[0_3px_14px_rgba(20,75,53,0.05)] transition-colors hover:bg-[#eaf4ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] lg:hidden"
      >
        <span className="flex min-w-0 items-center gap-2">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M7 12h10M10 17h4"/>
          </svg>
          Affina i filtri
          {activeCount > 0 ? <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#175640] px-1.5 text-[11px] font-bold text-white">{activeCount}</span> : null}
        </span>
        <span aria-hidden="true" className={"text-[#175640] transition-transform "+(open?"rotate-180":"")}>⌄</span>
      </button>
      <div id="network-filter-panel" className={(open ? "mt-2 block" : "hidden") + " lg:mt-0 lg:block"}>
        {children}
      </div>
    </div>
  );
}
