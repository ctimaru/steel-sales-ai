"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { PlatformPermissionKey } from "@/lib/platform-access-contract";
import {
  PLATFORM_IA_AREAS,
  PLATFORM_IA_MODULES,
  getPlatformIaVisibleModules,
  type PlatformIaAreaKey,
} from "@/lib/platform-ia-contract";

type AccessProps = {
  permissions: PlatformPermissionKey[];
  isPlatformOwner: boolean;
};

function visibleItems({ permissions, isPlatformOwner }: AccessProps) {
  return getPlatformIaVisibleModules({
    permissions,
    is_platform_owner: isPlatformOwner,
  }).filter((item) => item.placement !== "utility");
}

function isPlatformSelected(pathname: string, href: string) {
  return href === "/platform"
    ? pathname === "/platform"
    : pathname === href || pathname.startsWith(href + "/");
}

function currentModule(pathname: string) {
  // Match the longest public navigation prefix; deep routes keep their owning breadcrumb.
  return [...PLATFORM_IA_MODULES]
    .filter((item) => isPlatformSelected(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0] ?? PLATFORM_IA_MODULES[0];
}

export function PlatformLocation() {
  const pathname = usePathname();
  const item = currentModule(pathname);
  const area = PLATFORM_IA_AREAS.find((group) => group.key === item.area);
  return (
    <span className="block truncate text-[11px] text-[#697a72]" aria-label="Posizione nella Console">
      {area?.label}{item.key === "home" ? "" : " / " + item.label}
    </span>
  );
}

function ModuleLinks({
  items,
  pathname,
  mobile = false,
}: {
  items: ReturnType<typeof visibleItems>;
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <div className={mobile ? "grid gap-1 sm:grid-cols-2" : "space-y-0.5"}>
      {items.map((item) => {
        const selected = isPlatformSelected(pathname, item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? "page" : undefined}
            className={[
              "flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]",
              selected
                ? "bg-[#dcebe4] text-[#123b34] shadow-[inset_3px_0_0_#1f6b5a]"
                : "text-[#4f6259] hover:bg-white hover:text-[#123b34]",
            ].join(" ")}
          >
            <span className="min-w-0 truncate">{item.label}</span>
            {selected ? <span aria-hidden="true" className="shrink-0 text-[#1f6b5a]">●</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

function GroupedNavigation({
  items,
  pathname,
  mobile = false,
}: {
  items: ReturnType<typeof visibleItems>;
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <nav className={mobile ? "space-y-4" : "space-y-3"} aria-label={mobile ? "Navigazione mobile Platform" : "Navigazione Platform"}>
      {PLATFORM_IA_AREAS.map((group) => {
        const groupItems = items.filter((item) => item.area === (group.key as PlatformIaAreaKey));
        if (groupItems.length === 0) return null;
        return (
          <section key={group.key} aria-label={group.label}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.11em] text-[#708079]">
              {group.label}
            </p>
            <ModuleLinks items={groupItems} pathname={pathname} mobile={mobile} />
          </section>
        );
      })}
    </nav>
  );
}

export function PlatformNavigation(props: AccessProps) {
  const pathname = usePathname();
  return <GroupedNavigation items={visibleItems(props)} pathname={pathname} />;
}

export function PlatformMobileNavigation(props: AccessProps) {
  const pathname = usePathname();
  const items = visibleItems(props);

  return (
    <details className="relative w-[86px] min-w-0 max-w-[86px] flex-none lg:hidden">
      <summary
        aria-label="Apri navigazione Platform"
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#123b34] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]"
      >
        <span aria-hidden="true">☰</span>
        <span>Menu</span>
      </summary>
      <div className="fixed left-2 right-2 top-[calc(4rem+env(safe-area-inset-top))] z-50 max-h-[calc(100dvh-5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-2xl border border-[#dce2df] bg-white p-3 shadow-[0_18px_48px_rgba(17,54,45,0.17)] sm:left-auto sm:right-6 sm:w-[440px]">
        <div className="mb-3 border-b border-[#e5ece7] px-2 pb-3">
          <p className="text-[11px] font-bold text-[#123b34]">Navigazione piattaforma</p>
          <p className="mt-0.5 text-xs text-[#60736a]">Solo aree abilitate per il tuo account</p>
        </div>
        <GroupedNavigation items={items} pathname={pathname} mobile />
      </div>
    </details>
  );
}
