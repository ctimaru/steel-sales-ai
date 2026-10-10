import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";
import {
  PlatformMobileNavigation,
  PlatformNavigation,
  PlatformLocation,
} from "@/components/platform-navigation";
import { ContextSwitchLink } from "@/components/context-switch-link";
import { HeaderMenuDismissController } from "@/components/header-menu-dismiss-controller";
import { ProductBrand } from "@/components/product-brand";
import { PlatformNotificationBell } from "@/components/platform-notification-bell";
import type { PlatformNotificationSnapshot } from "@/lib/platform-notifications";
import type { PlatformPermissionKey } from "@/lib/platform-access-contract";

export function PlatformShell({
  children,
  viewerLabel,
  authorityLabel,
  permissions,
  isPlatformOwner,
  notificationSnapshot,
  notificationVerifiedAt,
}: {
  children: ReactNode;
  viewerLabel: string;
  authorityLabel: string;
  permissions: PlatformPermissionKey[];
  isPlatformOwner: boolean;
  notificationSnapshot: PlatformNotificationSnapshot | null;
  notificationVerifiedAt: string | null;
}) {
  return (
    <><HeaderMenuDismissController /><div className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <a href="#main-content" className="skip-link">
        Vai al contenuto principale
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#dce2df] bg-[#eef1ef] lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-[#dfe5e2] p-5">
            <ProductBrand href="/platform" />
            <div className="mt-4 border-l-[3px] border-[#1f6b5a] pl-3">
              <p className="text-sm font-bold text-[#123b34]">Console piattaforma</p>
              <p className="mt-0.5 text-[11px] text-[#64756c]">Governance Smart Steel Sales</p>
            </div>
          </div>

          {isPlatformOwner ? (
            <div className="border-b border-[#dfe5e2] p-3">
              <ContextSwitchLink
                href="/dashboard"
                label="Torna al workspace aziendale"
              />
            </div>
          ) : null}

          <div className="sidebar-scroll flex-1 overflow-y-auto p-3">
            <PlatformNavigation
              permissions={permissions}
              isPlatformOwner={isPlatformOwner}
            />

            <div className="mt-5 border-t border-[#dfe5e2] px-3 pt-3">
              <p className="text-[11px] leading-4 text-[#66766e]">
                Contesto globale. I dati commerciali delle aziende restano separati.
              </p>
            </div>
          </div>

          <div className="border-t border-[#dfe5e2] p-4">
            <div className="rounded-xl border border-[#dce2df] bg-white p-3">
              <p className="truncate text-xs font-semibold text-[#3e4a45]">{viewerLabel}</p>
              <p className="mt-1 text-[11px] font-medium text-[#68756f]">{authorityLabel}</p>
            </div>
            <form action={logout}>
              <button className="mt-3 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#65716c] hover:bg-[#e9eeeb] hover:text-[#2d3934]">
                Esci
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-[#dce2df] bg-white/92 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
            <Link href="/platform" className="min-w-0 max-w-[50%] sm:max-w-none">
              <p className="truncate text-xs font-semibold text-[#1d2824] sm:text-sm">Smart Steel Sales · Console</p>
              <PlatformLocation />
            </Link>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <PlatformMobileNavigation
                permissions={permissions}
                isPlatformOwner={isPlatformOwner}
              />
              {isPlatformOwner ? (
                <ContextSwitchLink
                  href="/dashboard"
                  label="Workspace aziendale"
                  compact
                  className="hidden sm:inline-flex"
                />
              ) : null}
              <PlatformNotificationBell snapshot={notificationSnapshot} initialVerifiedAt={notificationVerifiedAt} platformReady canReadRegistrations={permissions.includes("registrations.read")} />
              <span className="hidden rounded-full bg-[#e1ece8] px-3.5 py-2 text-xs font-semibold text-[#173f35] sm:inline-flex">
                {authorityLabel}
              </span>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mvp-focus-shell mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div></>
  );
}
