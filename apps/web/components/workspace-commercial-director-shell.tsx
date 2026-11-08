"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import {
  commercialDirectorAllItems,
  commercialDirectorGroups,
  commercialDirectorLinkSelected,
} from "@/lib/commercial-director-navigation";
import { getWorkspaceNavigationContext } from "@/lib/workspace-information-architecture";

function DirectorGroup({
  group, expanded, onExpandedChange, pathname, view, onNavigate,
}: {
  group: (typeof commercialDirectorGroups)[number];
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  pathname: string;
  view: string | null;
  onNavigate?: () => void;
}) {
  const extraActive = group.moreItems.some(item =>
    commercialDirectorLinkSelected(item.href, pathname, view)
  );
  const [extraOpen, setExtraOpen] = useState(extraActive);
  useEffect(() => { if (extraActive) setExtraOpen(true); }, [extraActive]);

  // Scrivania is an actual destination, not another accordion containing
  // an identical "Scrivania" link. Keep exactly one primary entry point.
  if (group.key === "desk") {
    const item = group.items[0];
    const current = commercialDirectorLinkSelected(item.href, pathname, view);
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={[
          "flex min-h-11 items-center rounded-lg px-3 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]",
          current ? "app-selected-solid" : "text-[#25483b] hover:bg-[#edf5ef]",
        ].join(" ")}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <details
      open={expanded}
      onToggle={event => {
        if (event.target === event.currentTarget) onExpandedChange(event.currentTarget.open);
      }}
      className="group rounded-xl border border-transparent open:border-[#e1ebe5] open:bg-[#f8fbf9]"
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs font-bold text-[#25483b] hover:bg-[#edf5ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] xl:min-h-11 xl:py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block">{group.label}</span>
          <span className="mt-0.5 hidden text-[10px] font-normal text-[#687d72] xl:block">{group.description}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-sm text-[#547666] transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-0.5 px-1.5 pb-2 pt-0.5">
        {group.items.map(item => {
          const current = commercialDirectorLinkSelected(item.href, pathname, view);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={[
                "block min-h-9 rounded-md px-3 py-2 text-xs leading-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]",
                current
                  ? "app-selected-solid font-bold"
                  : "font-medium text-[#476458] hover:bg-[#eaf3ed] hover:text-[#123a2b]",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
        {group.moreItems.length > 0 ? (
          <details
            open={extraOpen}
            onToggle={event => { event.stopPropagation(); setExtraOpen(event.currentTarget.open); }}
            className="mt-1 border-t border-[#e1ebe5] pt-1"
          >
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between rounded-md px-3 py-1 text-[11px] font-semibold text-[#476458] hover:bg-[#eaf3ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
              <span>Altre funzioni</span>
              <span aria-hidden="true" className="text-sm">›</span>
            </summary>
            <div className="space-y-0.5 pl-2">
              {group.moreItems.map(item => {
                const current = commercialDirectorLinkSelected(item.href, pathname, view);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={[
                      "block min-h-9 rounded-md px-3 py-2 text-xs leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]",
                      current ? "app-selected-solid font-bold" : "text-[#476458] hover:bg-[#eaf3ed]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function DirectorMenuGroups({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const activeGroup = commercialDirectorGroups.find(group =>
    commercialDirectorAllItems(group).some(item =>
      commercialDirectorLinkSelected(item.href, pathname, view)
    )
  )?.key;
  const [expandedKey, setExpandedKey] = useState<string | null>(activeGroup ?? (mobile ? null : "deals"));
  useEffect(() => {
    if (activeGroup) setExpandedKey(activeGroup);
  }, [activeGroup]);
  return (
    <div className="space-y-1.5" data-testid="commercial-director-groups">
      {commercialDirectorGroups.map(group => (
        <DirectorGroup key={group.key}
          group={group} expanded={expandedKey === group.key}
          onExpandedChange={open => setExpandedKey(current =>
            open ? group.key : current === group.key ? null : current
          )}
          pathname={pathname} view={view} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function CommercialDirectorNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const [mobileOpen, setMobileOpen] = useState(false);
  let selectedLabel: string | undefined;
  for (const group of commercialDirectorGroups) {
    for (const item of commercialDirectorAllItems(group)) {
      if (commercialDirectorLinkSelected(item.href, pathname, view)) {
        selectedLabel = item.label;
        break;
      }
    }
    if (selectedLabel) break;
  }

  // Close the mobile disclosure after a route/filter change. Selecting an
  // in-page anchor must close it too, even if the pathname does not change.
  useEffect(() => { setMobileOpen(false); }, [pathname, view]);

  if (mobile) {
    return (
      <details open={mobileOpen}
        onToggle={event => setMobileOpen(event.currentTarget.open)}
        className="rounded-xl border border-[#cddfd2] bg-white shadow-sm xl:hidden"
        data-testid="commercial-director-mobile">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block">Sezioni Commerciale</span>
            {selectedLabel ? <span className="mt-0.5 block truncate text-[11px] font-normal text-[#547666]">Attuale: {selectedLabel}</span> : null}
          </span>
          <span aria-hidden="true" className="text-lg text-[#34664d]">☰</span>
        </summary>
        <nav aria-label="Menu Commerciale mobile" className="border-t border-[#e0e9e3] p-2.5">
          <DirectorMenuGroups mobile onNavigate={() => setMobileOpen(false)} />
        </nav>
      </details>
    );
  }
  return (
    <aside data-testid="commercial-director-sidebar"
      className="hidden min-w-0 self-start xl:sticky xl:top-[80px] xl:block">
      <nav aria-label="Menu Commerciale" className="rounded-2xl border border-[#d7e5dc] bg-white px-2.5 py-3 shadow-[0_10px_30px_-27px_rgba(10,56,35,0.5)]">
        <div className="mb-2 border-b border-[#e4ece7] px-3 pb-2">
          <h2 className="text-sm font-bold tracking-tight text-[#173f35]">Commerciale</h2>
        </div>
        <DirectorMenuGroups />
      </nav>
    </aside>
  );
}

/** Commercial is one workspace, including the existing private RFQ Hub.
 * The shell is navigation only: all routes and RLS gates remain unchanged.
 */
export function WorkspaceCommercialDirectorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (getWorkspaceNavigationContext(pathname).primary !== "commercial") {
    return <div className="mx-auto w-full max-w-[1216px]">{children}</div>;
  }
  return (
    <div data-testid="commercial-director-shell" className="min-w-0">
      <div className="mb-3 xl:hidden">
        <Suspense fallback={<div className="h-12 rounded-xl bg-white" />}>
          <CommercialDirectorNavigation mobile />
        </Suspense>
      </div>
      <div className="min-w-0 xl:grid xl:grid-cols-[214px_minmax(0,1fr)] xl:items-start xl:gap-5 2xl:grid-cols-[232px_minmax(0,1fr)]">
        <Suspense fallback={<div className="hidden xl:block" />}>
          <CommercialDirectorNavigation />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
