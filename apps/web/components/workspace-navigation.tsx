"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { appRoutes } from "@/lib/routes";
import {
  getWorkspaceNavigationContext,
  type WorkspaceContextKey,
} from "@/lib/workspace-information-architecture";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  contextKey: WorkspaceContextKey;
};

export type WorkspaceNavGroup = {
  title: string;
  items: WorkspaceNavItem[];
  alertHref?: string;
};

function currentPrimarySpace(pathname: string) {
  if (
    pathname === appRoutes.knowledge.workspace ||
    pathname.startsWith(appRoutes.knowledge.workspace + "/")
  ) {
    return "knowledge" as const;
  }
  return getWorkspaceNavigationContext(pathname).primary;
}

function NavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: "home" | "commercial" | "rfq" | "network" | "marketplace" | "knowledge" | "bell" | "user" | "search" | "chevron";
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    "aria-hidden": true,
  } as const;

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="m3.5 10 8.5-7 8.5 7" />
        <path d="M5.5 9.5V21h13V9.5M9 21v-6h6v6" />
      </svg>
    );
  }
  if (name === "commercial") {
    return (
      <svg {...common}>
        <rect x="3.5" y="6.5" width="17" height="13" rx="2" />
        <path d="M8.5 6.5V4.75h7V6.5M3.5 11.5h17M9.5 14h5" />
      </svg>
    );
  }
  if (name === "rfq") {
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M8 8h8M8 12h5M8 16h5M15 15l2 2 3-4" />
      </svg>
    );
  }
  if (name === "network") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M2.75 19c.55-3.25 2.3-5 5.25-5s4.7 1.75 5.25 5M13.5 15.25c.9-.85 2.05-1.25 3.5-1.25 2.35 0 3.75 1.45 4.25 4" />
      </svg>
    );
  }
  if (name === "marketplace") {
    return (
      <svg {...common}>
        <path d="M4 9.5h16l-1.25-5h-13.5L4 9.5Z" />
        <path d="M5 9.5V20h14V9.5M9 20v-5h6v5" />
        <path d="M4 9.5c0 1.4 1 2.5 2.25 2.5S8.5 10.9 8.5 9.5c0 1.4 1 2.5 2.25 2.5S13 10.9 13 9.5c0 1.4 1 2.5 2.25 2.5s2.25-1.1 2.25-2.5c0 1.4 1 2.5 2.25 2.5" />
      </svg>
    );
  }
  if (name === "knowledge") {
    return (
      <svg {...common}>
        <path d="M4.5 4.5h6.25A2.25 2.25 0 0 1 13 6.75V20a3.25 3.25 0 0 0-3.25-3.25H4.5V4.5Z" />
        <path d="M19.5 4.5h-6.25A2.25 2.25 0 0 0 11 6.75V20a3.25 3.25 0 0 1 3.25-3.25h5.25V4.5Z" />
      </svg>
    );
  }
  if (name === "bell") {
    return (
      <svg {...common}>
        <path d="M6 10a6 6 0 0 1 12 0v4.25l1.5 2.25h-15L6 14.25V10Z" />
        <path d="M9.5 19.5a3 3 0 0 0 5 0" />
      </svg>
    );
  }
  if (name === "user") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.65-4 3-6 7-6s6.35 2 7 6" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m15 15 5 5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

function primaryItems(networkEnabled: boolean, networkEntitled: boolean) {
  return [
    {
      key: "home" as const,
      href: appRoutes.home,
      label: "Home",
      icon: "home" as const,
      locked: false,
    },
    {
      key: "commercial" as const,
      href: appRoutes.commercial.home,
      label: "Commerciale",
      icon: "commercial" as const,
      locked: false,
    },
    {
      key: "rfq" as const,
      href: appRoutes.rfqHub.home,
      label: "RFQ Hub",
      mobileLabel: "RFQ",
      icon: "rfq" as const,
      locked: false,
    },
    ...(networkEnabled
      ? [
          {
            key: "network" as const,
            href: appRoutes.network.directory,
            label: "Network",
            icon: "network" as const,
            locked: !networkEntitled,
          },
          {
            key: "marketplace" as const,
            href: appRoutes.marketplace.home,
            label: "Marketplace",
            mobileLabel: "Mercato",
            icon: "marketplace" as const,
            locked: false,
          },
        ]
      : []),
    {
      key: "knowledge" as const,
      href: appRoutes.knowledge.workspace,
      label: "Scuola",
      icon: "knowledge" as const,
      locked: false,
    },
  ];
}

export function WorkspaceDesktopPrimaryNavigation({
  networkEnabled,
  networkEntitled,
}: {
  networkEnabled: boolean;
  networkEntitled: boolean;
}) {
  const pathname = usePathname();
  const current = currentPrimarySpace(pathname);

  return (
    <nav className="hidden h-full items-stretch gap-1 lg:flex" aria-label="Navigazione principale">
      {primaryItems(networkEnabled, networkEntitled).map((item) => {
        const selected = current === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={[
              "relative flex min-w-[88px] flex-col items-center justify-center gap-1 rounded-t-xl px-2 text-[11px] font-semibold transition",
              selected
                ? "bg-[#f7faf8] text-[#173f35]"
                : "text-[#5d6a65] hover:bg-[#f4f6f5] hover:text-[#1d2824]",
            ].join(" ")}
          >
            <NavIcon name={item.icon} className="h-[21px] w-[21px]" />
            <span>{item.label}</span>
            {item.locked ? (
              <span className="absolute right-1 top-1 rounded-full bg-[#edf5f2] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#173f35]">
                Premium
              </span>
            ) : null}
            {selected ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#173f35]" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function WorkspaceMobileBottomNavigation({
  networkEnabled,
  networkEntitled,
}: {
  networkEnabled: boolean;
  networkEntitled: boolean;
}) {
  const pathname = usePathname();
  const current = currentPrimarySpace(pathname);
  const items = primaryItems(networkEnabled, networkEntitled);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid border-t border-[#d7dfdb] bg-white/96 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_22px_rgba(20,46,38,0.06)] backdrop-blur-xl lg:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      aria-label="Navigazione mobile principale"
    >
      {items.map((item) => {
        const selected = current === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={[
              "relative flex min-h-[62px] flex-col items-center justify-center gap-1 px-1 pt-1 text-[10px] font-semibold transition",
              selected ? "bg-[#f3f7f5] text-[#173f35]" : "text-[#5d6a65]",
            ].join(" ")}
          >
            {selected ? (
              <span className="absolute inset-x-[28%] top-0 h-0.5 rounded-full bg-[#173f35]" />
            ) : null}
            <NavIcon name={item.icon} className="h-5 w-5" />
            <span className="max-w-full truncate">
              {"mobileLabel" in item ? item.mobileLabel : item.label}
              {item.locked ? " · 🔒" : ""}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function ContextLink({
  item,
  selected,
}: {
  item: WorkspaceNavItem;
  selected: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={selected ? "page" : undefined}
      className={[
        "flex min-h-11 shrink-0 items-center rounded-t-lg border-b-2 px-3 text-xs font-semibold transition sm:text-sm",
        selected
          ? "border-[#173f35] bg-[#f7faf8] text-[#173f35]"
          : "border-transparent text-[#5d6a65] hover:border-[#c8d5d0] hover:bg-[#fafcfb] hover:text-[#1d2824]",
      ].join(" ")}
    >
      {item.label}
    </Link>
  );
}

export function WorkspaceContextNavigation({
  commercialItems,
  intelligenceItems,
  rfqItems,
  networkItems,
  marketplaceItems,
  knowledgeItems,
}: {
  commercialItems: WorkspaceNavItem[];
  intelligenceItems: WorkspaceNavItem[];
  rfqItems: WorkspaceNavItem[];
  networkItems: WorkspaceNavItem[];
  marketplaceItems: WorkspaceNavItem[];
  knowledgeItems: WorkspaceNavItem[];
}) {
  const pathname = usePathname();
  const navigation = getWorkspaceNavigationContext(pathname);
  const current = navigation.primary;

  if (current === "home") return null;

  const items =
    current === "rfq"
      ? rfqItems
      : current === "network"
        ? networkItems
      : current === "marketplace"
        ? marketplaceItems
        : current === "knowledge"
          ? knowledgeItems
          : commercialItems;

  if (current === "network" && items.length === 0) return null;

  const intelligenceSelected =
    current === "commercial" &&
    Boolean(
      navigation.context?.startsWith("commercial:intelligence:"),
    );

  return (
    <div className="border-t border-[#eef1ef] bg-white">
      <div className="workspace-context-scroll mx-auto flex max-w-[1280px] items-center gap-1 overflow-x-auto px-3 sm:px-5 lg:px-8">
        {items.map((item) => (
          <ContextLink
            key={item.contextKey}
            item={item}
            selected={navigation.context === item.contextKey}
          />
        ))}

        {current === "commercial" && intelligenceItems.length ? (
          <details className="relative shrink-0">
            <summary
              aria-current={intelligenceSelected ? "page" : undefined}
              className={[
                "flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-t-lg border-b-2 px-3 text-xs font-semibold transition sm:text-sm",
                intelligenceSelected
                  ? "border-[#173f35] bg-[#f7faf8] text-[#173f35]"
                  : "border-transparent text-[#5d6a65] hover:border-[#c8d5d0] hover:bg-[#fafcfb] hover:text-[#1d2824]",
              ].join(" ")}
            >
              Intelligence
              <NavIcon name="chevron" className="h-4 w-4" />
            </summary>
            <div className="fixed left-3 right-3 top-[calc(112px+env(safe-area-inset-top))] z-50 grid max-h-[calc(100dvh-9rem-env(safe-area-inset-top))] gap-1 overflow-y-auto rounded-2xl border border-[#dce2df] bg-white p-2 shadow-xl sm:left-auto sm:right-6 sm:w-72 lg:absolute lg:left-auto lg:right-0 lg:top-full lg:max-h-none lg:overflow-visible">
              {intelligenceItems.map((item) => {
                const selected = navigation.context === item.contextKey;
                return (
                  <Link
                    key={item.contextKey}
                    href={item.href}
                    aria-current={selected ? "page" : undefined}
                    className={[
                      "rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                      selected
                        ? "bg-[#e1ece8] text-[#173f35]"
                        : "text-[#43524c] hover:bg-[#edf5f2] hover:text-[#173f35]",
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
    </div>
  );
}

export function WorkspaceSearchBar() {
  return (
    <form
      action={appRoutes.commercial.search}
      method="get"
      className="relative min-w-0 flex-1 sm:max-w-sm lg:w-[280px] lg:flex-none"
    >
      <NavIcon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8782]"
      />
      <input
        name="q"
        type="search"
        aria-label="Cerca nello storico commerciale"
        placeholder="Cerca"
        className="h-10 w-full rounded-xl border border-[#cfd8d4] bg-[#f7f9f8] pl-9 pr-4 text-sm text-[#1d2824] outline-none transition placeholder:text-[#5d6a65] focus:border-[#86a99e] focus:bg-white focus:ring-4 focus:ring-[#e1ece8]"
      />
    </form>
  );
}

export function WorkspaceProfileMenu({
  viewerLabel,
  organizationName,
  organizationRoleLabel,
  guidedSetupComplete,
  canAdmin,
  logoutAction,
}: {
  viewerLabel: string;
  organizationName: string;
  organizationRoleLabel: string;
  guidedSetupComplete: boolean;
  canAdmin: boolean;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const initial = (viewerLabel.trim()[0] || "U").toUpperCase();

  const closeMenu = useCallback(() => setOpen(false), []);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeMenu();
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeMenu();
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  useEffect(() => { closeMenu(); }, [pathname, closeMenu]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-full p-0.5 transition hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--steel-blue)]"
        aria-label="Apri menu profilo"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-deep)] text-xs font-bold text-white">
          {initial}
        </span>
        <NavIcon name="chevron" className="hidden h-4 w-4 text-[var(--text-secondary)] sm:block" />
      </button>

      {open ? (
        <>
          <aside
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label="Menu profilo"
            className="fixed inset-x-3 top-[calc(72px+env(safe-area-inset-top))] z-[60] flex max-h-[min(75dvh,650px)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] shadow-2xl sm:left-auto sm:right-5 sm:w-[360px] lg:absolute lg:inset-x-auto lg:right-0 lg:top-12 lg:w-[360px]"
          >
            <div className="flex items-start justify-between gap-3 bg-[var(--surface-subtle)] p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand-deep)] text-sm font-bold text-white">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--text-primary)] lg:text-sm">{viewerLabel}</p>
                  <p className="mt-1 truncate text-sm font-medium text-[var(--text-secondary)] lg:text-xs">{organizationName}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)] lg:text-[11px]">{organizationRoleLabel}</p>
                </div>
              </div>
              <button
                type="button"
                autoFocus
                onClick={closeMenu}
                aria-label="Chiudi"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--brand-deep)]"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {canAdmin ? (
                <div className="mt-2 border-t border-[var(--border)] pt-2">
                  <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                    Azienda
                  </p>
                  {!guidedSetupComplete ? (
                    <ProfileMenuLink href={appRoutes.company.setup} label="Completa setup azienda" onNavigate={closeMenu} />
                  ) : null}
                  <ProfileMenuLink href={appRoutes.company.profile} label="Profilo azienda" onNavigate={closeMenu} />
                  <ProfileMenuLink href={appRoutes.company.team} label="Team e accessi" onNavigate={closeMenu} />
                  <ProfileMenuLink href={appRoutes.company.dataSources} label="Dati e fonti" onNavigate={closeMenu} />
                </div>
              ) : null}

              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
                  Account
                </p>
                <ProfileMenuLink
                  href={appRoutes.account.profile}
                  label="Account e privacy"
                  onNavigate={closeMenu}
                />
              </div>

            </div>

            <form action={logoutAction} className="border-t border-[var(--border)] p-3">
              <button
                type="submit"
                className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--brand-deep)]"
              >
                Esci
              </button>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}

function ProfileMenuLink({
  href,
  label,
  emphasis = false,
  onNavigate,
}: {
  href: string;
  label: string;
  emphasis?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "block rounded-xl px-3 py-2.5 text-sm font-semibold transition",
        emphasis
          ? "bg-[var(--brand-primary-soft)] text-[var(--brand-deep)] hover:bg-[var(--surface-muted)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--brand-deep)]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
