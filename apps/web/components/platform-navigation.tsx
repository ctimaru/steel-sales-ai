"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { PlatformPermissionKey } from "@/lib/platform-access-contract";
import { appRoutes } from "@/lib/routes";

const platformNavGroups = [
  ["overview", "Overview"],
  ["access", "Accesso & onboarding"],
  ["network", "Network governance"],
  ["content", "Contenuti"],
  ["strategy", "Strategy & investors"],
  ["pilot", "Pilot"],
] as const;

const platformNav = [
  {
    href: appRoutes.platform.home,
    label: "Platform Home",
    icon: "home",
    permission: "platform.console.access",
    staffEnabled: true,
    group: "overview",
  },
  {
    href: appRoutes.platform.people,
    label: "People & Access",
    icon: "people",
    permission: "platform.staff.read",
    staffEnabled: false,
    group: "access",
  },
  {
    href: appRoutes.platform.businessPlan,
    label: "Business Plan",
    icon: "strategy",
    permission: "platform.console.access",
    staffEnabled: false,
    group: "strategy",
  },
  {
    href: appRoutes.platform.investorAccess,
    label: "Investor Access",
    icon: "investor",
    permission: "platform.console.access",
    staffEnabled: false,
    group: "strategy",
  },
  {
    href: appRoutes.platform.investorKpis,
    label: "KPI",
    icon: "kpi",
    permission: "platform.console.access",
    staffEnabled: false,
    group: "strategy",
  },
  {
    href: appRoutes.platform.pilot,
    label: "Commercial Pilot",
    icon: "pilot",
    permission: "platform.console.access",
    staffEnabled: false,
    group: "pilot",
  },
  {
    href: appRoutes.platform.registrations,
    label: "Registrazioni aziende",
    icon: "registrations",
    permission: "registrations.read",
    staffEnabled: true,
    group: "access",
  },
  {
    href: appRoutes.platform.discovery,
    label: "Company Discovery",
    icon: "discovery",
    permission: "discovery.read",
    staffEnabled: true,
    group: "network",
  },
  {
    href: appRoutes.platform.claims,
    label: "Company Claims",
    icon: "claims",
    permission: "claims.read",
    staffEnabled: true,
    group: "network",
  },
  {
    href: appRoutes.platform.knowledge,
    label: "Knowledge Operations",
    icon: "knowledge",
    permission: "knowledge.read_drafts",
    staffEnabled: true,
    group: "content",
  },
  {
    href: appRoutes.platform.networkTrust,
    label: "Network Trust",
    icon: "trust",
    permission: "network_trust.read",
    staffEnabled: true,
    group: "network",
  },
] as const satisfies readonly {
  href: string;
  label: string;
  icon: "home" | "people" | "strategy" | "investor" | "kpi" | "pilot" | "registrations" | "discovery" | "claims" | "knowledge" | "trust";
  permission: PlatformPermissionKey;
  staffEnabled: boolean;
  group: (typeof platformNavGroups)[number][0];
}[];

function NavIcon({ name }: { name: (typeof platformNav)[number]["icon"] }) {
  if (name === "investor") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 18.75V9.5l8-4.25 8 4.25v9.25" />
        <path d="M7.5 18.75v-5h9v5M8.5 10.5h7M12 5.25v-2" />
      </svg>
    );
  }

  if (name === "kpi") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4.25 19.75V12.5h3.5v7.25M10.25 19.75V8h3.5v11.75M16.25 19.75V4.25h3.5v15.5" />
        <path d="M3 19.75h18" />
      </svg>
    );
  }

  if (name === "strategy") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4.25 19.75V8.5M9.5 19.75V4.25M14.75 19.75v-7.5M20 19.75V6.75" />
        <path d="M3 19.75h18" />
      </svg>
    );
  }

  if (name === "pilot") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 18.5h12M8 18.5v-4.25a4 4 0 0 1 8 0v4.25M9.5 7.5h5M12 4.5v6" />
        <path d="M5 20.25h14" />
      </svg>
    );
  }

  if (name === "people") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M8.25 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM15.75 10.25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M2.75 19.25c.45-3.35 2.3-5.25 5.5-5.25s5.05 1.9 5.5 5.25M13.25 13.25c.7-.4 1.55-.6 2.5-.6 2.95 0 4.75 1.75 5.15 4.85" />
      </svg>
    );
  }

  if (name === "registrations") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75Z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }

  if (name === "discovery") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 20.25V8.5L12 4l8 4.5v11.75" />
        <path d="M8 20.25v-6h8v6M8 10h.01M12 10h.01M16 10h.01" />
      </svg>
    );
  }

  if (name === "claims") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 3.75 19 6.5v5.75c0 4.4-2.8 6.9-7 8-4.2-1.1-7-3.6-7-8V6.5L12 3.75Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (name === "knowledge") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 4.25h10.25A2.75 2.75 0 0 1 18 7v12.75H7.75A2.75 2.75 0 0 1 5 17V4.25Z" />
        <path d="M7.75 16.75H18M8.5 8h6M8.5 11h6" />
      </svg>
    );
  }

  if (name === "trust") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 3.5 19 6.25v5.5c0 4.45-2.8 7.05-7 8.25-4.2-1.2-7-3.8-7-8.25v-5.5L12 3.5Z" />
        <path d="M9 12.25 11 14l4.25-4.5M12 6.75v1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m3.75 10.5 8.25-6.75 8.25 6.75v8.25A1.5 1.5 0 0 1 18.75 20.25H5.25a1.5 1.5 0 0 1-1.5-1.5V10.5Z" />
      <path d="M9.25 20.25v-6.5h5.5v6.5" />
    </svg>
  );
}

function visiblePlatformItems(
  permissions: PlatformPermissionKey[],
  isPlatformOwner: boolean,
) {
  return platformNav.filter((item) => {
    if (!permissions.includes(item.permission)) return false;
    return isPlatformOwner || item.staffEnabled;
  });
}

function isPlatformSelected(pathname: string, href: string) {
  return href === appRoutes.platform.home
    ? pathname === appRoutes.platform.home
    : pathname === href || pathname.startsWith(href + "/");
}

export function PlatformNavigation({
  permissions,
  isPlatformOwner,
}: {
  permissions: PlatformPermissionKey[];
  isPlatformOwner: boolean;
}) {
  const pathname = usePathname();
  const visibleItems = visiblePlatformItems(permissions, isPlatformOwner);

  return (
    <nav className="space-y-4" aria-label="Navigazione Platform">
      {platformNavGroups.map(([groupKey, groupLabel]) => {
        const items = visibleItems.filter((item) => item.group === groupKey);
        if (items.length === 0) return null;

        return (
          <div key={groupKey}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b9792]">
              {groupLabel}
            </p>
            <div className="space-y-1">
              {items.map((item) => {
                const selected = isPlatformSelected(pathname, item.href);

                return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              selected
                ? "bg-[#e1ece8] text-[#173f35] shadow-[inset_0_0_0_1px_#d9e8e2]"
                : "text-[#596761] hover:bg-white hover:text-[#1d2824]",
            ].join(" ")}
          >
            <span className={selected ? "text-[#173f35]" : "text-[#7b8882]"}>
              <NavIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}


export function PlatformMobileNavigation({
  permissions,
  isPlatformOwner,
}: {
  permissions: PlatformPermissionKey[];
  isPlatformOwner: boolean;
}) {
  const pathname = usePathname();
  const visibleItems = visiblePlatformItems(permissions, isPlatformOwner);

  return (
    <details className="relative lg:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#43524c] shadow-sm">
        Menu
      </summary>
      <div className="fixed left-3 right-3 top-[calc(4rem+env(safe-area-inset-top))] z-50 max-h-[calc(100dvh-5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-2xl border border-[#dce2df] bg-white p-3 shadow-2xl sm:left-auto sm:right-6 sm:w-96">
        <div className="mb-2 flex items-center justify-between px-2 py-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87938e]">
              Platform Console
            </p>
            <p className="mt-1 text-xs text-[#66736e]">
              Navigazione globale
            </p>
          </div>
        </div>
        <nav className="space-y-4" aria-label="Navigazione mobile Platform">
          {platformNavGroups.map(([groupKey, groupLabel]) => {
            const items = visibleItems.filter((item) => item.group === groupKey);
            if (items.length === 0) return null;

            return (
              <div key={groupKey}>
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#87938e]">
                  {groupLabel}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((item) => {
                    const selected = isPlatformSelected(pathname, item.href);
                    return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold transition",
                  selected
                    ? "border-[#c7ddd5] bg-[#e1ece8] text-[#173f35]"
                    : "border-[#e2e7e4] bg-[#f7f8f7] text-[#4f5d57] hover:border-[#c9d7d1] hover:bg-[#eef3f0]",
                ].join(" ")}
              >
                <span className={selected ? "text-[#173f35]" : "text-[#7b8882]"}>
                  <NavIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </details>
  );
}
