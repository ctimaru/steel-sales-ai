"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import {
  commercialDirectorAllItems,
  commercialDirectorGroups,
  commercialDirectorLinkSelected,
  type CommercialDirectorItem,
} from "@/lib/commercial-director-navigation";
import {
  canManageOfficeProfiles,
  officeProfileOf,
  type OfficeProfile,
} from "@/lib/office-profiles";
import { getWorkspaceNavigationContext } from "@/lib/workspace-information-architecture";

const iconPaths: Record<string, string> = {
  desk: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5",
  direction: "M4 20V8l8-4 8 4v12M9 20v-5h6v5M8.5 10.5h1.5M14 10.5h1.5",
  insights: "M4 19.5h16M7 16v-4.5M12 16V7.5M17 16v-7",
  tools: "M14.5 6.5a4 4 0 0 0-5 5L4.5 16.5l3 3 5-5a4 4 0 0 0 5-5l-2.5 2.5-2-.5-.5-2z",
  commercial: "M4 6.5h16M4 12h16M4 17.5h10",
  purchasing: "M5 7h14l-1.2 9.5H6.2zM9 7a3 3 0 0 1 6 0",
};

function NavIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={"h-4 w-4 shrink-0 " + className}>
      <path d={iconPaths[name] ?? iconPaths.commercial} />
    </svg>
  );
}

function DirectorLink({
  item, pathname, view, onNavigate, nested = false,
}: {
  item: CommercialDirectorItem; pathname: string; view: string | null; onNavigate?: () => void; nested?: boolean;
}) {
  const current = commercialDirectorLinkSelected(item.href, pathname, view);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={[
        "group/link flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] leading-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]",
        current
          ? "app-selected-solid font-bold shadow-sm"
          : "font-medium text-[#3f5d50] hover:bg-white hover:text-[#123a2b] hover:shadow-sm",
      ].join(" ")}
    >
      <span aria-hidden="true" className={[
        "h-1.5 w-1.5 shrink-0 rounded-full transition",
        current ? "bg-current opacity-90" : nested ? "bg-[#b7cfc1] group-hover/link:bg-[#175640]" : "bg-[#9fbdac] group-hover/link:bg-[#175640]",
      ].join(" ")} />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

const officeTone: Record<string, { box: string; head: string; badge: string }> = {
  commercial: {
    box: "border-[#cfe5d6] bg-[#f1f9f4]",
    head: "text-[#175640]",
    badge: "bg-[#175640] text-white",
  },
  purchasing: {
    box: "border-[#cddfe8] bg-[#f2f8fb]",
    head: "text-[#1d4e68]",
    badge: "bg-[#1d4e68] text-white",
  },
};

function DirectorGroup({
  group, expanded, onExpandedChange, pathname, view, onNavigate, canManageProfiles, profile,
}: {
  group: (typeof commercialDirectorGroups)[number];
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  pathname: string;
  view: string | null;
  onNavigate?: () => void;
  canManageProfiles: boolean;
  profile: OfficeProfile | null;
}) {
  const allowed = (item: CommercialDirectorItem) => !item.adminOnly || canManageProfiles;
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
          "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]",
          current ? "app-selected-solid shadow-sm" : "bg-[#f1f7f3] text-[#1f4a3b] hover:bg-[#e6f1ea]",
        ].join(" ")}
      >
        <NavIcon name="desk" className="h-5 w-5" />
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
      className="group rounded-xl border border-transparent transition open:border-[#dbe8e0] open:bg-[#fbfdfc] open:shadow-[0_8px_24px_-22px_rgba(10,56,35,0.55)]"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#1f4a3b] hover:bg-[#edf5ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e3f1e8] text-[#175640] transition group-open:bg-[#175640] group-open:text-white">
            <NavIcon name={group.key} />
          </span>
          <span className="min-w-0">
            <span className="block">{group.label}</span>
            <span className="mt-0.5 block truncate text-[11px] font-normal text-[#687d72]">{group.description}</span>
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-base text-[#547666] transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-0.5 px-2 pb-2.5 pt-0.5">
        {group.items.filter(allowed).map(item => (
          <DirectorLink key={item.href} item={item} pathname={pathname} view={view} onNavigate={onNavigate} />
        ))}
        {(group.sections ?? []).map(section => {
          const tone = officeTone[section.key] ?? officeTone.commercial;
          return (
            <div key={section.key} className={"mt-2 space-y-0.5 rounded-xl border p-1.5 " + tone.box}
              data-testid={"commercial-office-" + section.key}>
              <p className={"flex items-center justify-between gap-2 px-2 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] " + tone.head}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <NavIcon name={section.key} className="h-3.5 w-3.5" />
                  <span className="truncate">{section.label}</span>
                </span>
                {profile === section.key ? (
                  <span className={"shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold normal-case tracking-normal " + tone.badge}>Il tuo ufficio</span>
                ) : null}
              </p>
              {section.items.filter(allowed).map(item => (
                <DirectorLink key={item.href} item={item} pathname={pathname} view={view} onNavigate={onNavigate} nested />
              ))}
            </div>
          );
        })}
        {group.moreItems.length > 0 ? (
          <details
            open={extraOpen}
            onToggle={event => { event.stopPropagation(); setExtraOpen(event.currentTarget.open); }}
            className="mt-1.5 border-t border-[#e1ebe5] pt-1.5"
          >
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between rounded-lg px-3 py-1 text-xs font-semibold text-[#547666] hover:bg-[#eaf3ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
              <span>Altre funzioni</span>
              <span aria-hidden="true" className="text-sm">›</span>
            </summary>
            <div className="space-y-0.5 pl-1.5">
              {group.moreItems.map(item => (
                <DirectorLink key={item.href} item={item} pathname={pathname} view={view} onNavigate={onNavigate} nested />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function DirectorMenuGroups({ mobile = false, onNavigate, access }: { mobile?: boolean; onNavigate?: () => void; access: DirectorAccess }) {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const activeGroup = commercialDirectorGroups.find(group =>
    commercialDirectorAllItems(group).some(item =>
      commercialDirectorLinkSelected(item.href, pathname, view)
    )
  )?.key;
  const [expandedKey, setExpandedKey] = useState<string | null>(activeGroup ?? (mobile ? null : "direction"));
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
          pathname={pathname} view={view} onNavigate={onNavigate}
          canManageProfiles={access.canManageProfiles} profile={access.profile} />
      ))}
    </div>
  );
}

function CommercialDirectorNavigation({ mobile = false, access }: { mobile?: boolean; access: DirectorAccess }) {
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
          <DirectorMenuGroups mobile access={access} onNavigate={() => setMobileOpen(false)} />
        </nav>
      </details>
    );
  }
  return (
    <aside data-testid="commercial-director-sidebar"
      className="hidden min-w-0 self-start xl:sticky xl:top-[80px] xl:block">
      <nav aria-label="Menu Commerciale" className="rounded-2xl border border-[#d7e5dc] bg-white px-2.5 py-3 shadow-[0_10px_30px_-27px_rgba(10,56,35,0.5)]">
        <div className="mb-3 flex items-center gap-2.5 border-b border-[#e4ece7] px-2 pb-3">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#175640] text-white shadow-sm">
            <NavIcon name="commercial" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight tracking-tight text-[#173f35]">Commerciale</h2>
            <p className="text-[11px] leading-4 text-[#687d72]">Trattative, acquisti e analisi</p>
          </div>
        </div>
        <DirectorMenuGroups access={access} />
      </nav>
    </aside>
  );
}

/** Commercial is one workspace, including the existing private RFQ Hub.
 * The shell is navigation only: all routes and RLS gates remain unchanged.
 */
type DirectorAccess = { canManageProfiles: boolean; profile: OfficeProfile | null };

export function WorkspaceCommercialDirectorShell({
  children, role = "member", businessRole = null,
}: { children: ReactNode; role?: string; businessRole?: string | null }) {
  const pathname = usePathname();
  const access: DirectorAccess = {
    canManageProfiles: canManageOfficeProfiles(role),
    profile: officeProfileOf(role, businessRole),
  };
  if (getWorkspaceNavigationContext(pathname).primary !== "commercial") {
    return <div className="mx-auto w-full max-w-[1216px]">{children}</div>;
  }
  return (
    <div data-testid="commercial-director-shell" className="min-w-0">
      <div className="mb-3 xl:hidden">
        <Suspense fallback={<div className="h-12 rounded-xl bg-white" />}>
          <CommercialDirectorNavigation mobile access={access} />
        </Suspense>
      </div>
      <div className="min-w-0 xl:grid xl:grid-cols-[214px_minmax(0,1fr)] xl:items-start xl:gap-5 2xl:grid-cols-[232px_minmax(0,1fr)]">
        <Suspense fallback={<div className="hidden xl:block" />}>
          <CommercialDirectorNavigation access={access} />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
