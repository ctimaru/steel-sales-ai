"use client";

import { useState, type ReactNode } from "react";

/** NET-UX LOT1 — filters live in a left column on desktop (always visible) and
 * in a collapsible panel on phones, so the company list starts right away. */
export function NetworkFilterDrawer({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="network-filter-drawer">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="network-filter-panel"
        className="ui-action ui-action-secondary inline-flex min-h-11 w-full items-center justify-between rounded-xl px-4 text-sm font-semibold lg:hidden"
      >
        <span>Filtri{activeCount ? " (" + activeCount + ")" : ""}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <div id="network-filter-panel" className={(open ? "mt-2 block" : "hidden") + " lg:mt-0 lg:block"}>
        {children}
      </div>
    </div>
  );
}
