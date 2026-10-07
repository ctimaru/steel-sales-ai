import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";
import {
  PlatformMobileNavigation,
  PlatformNavigation,
} from "@/components/platform-navigation";
import { ProductBrand } from "@/components/product-brand";
import type { PlatformPermissionKey } from "@/lib/platform-access-contract";

export function PlatformShell({
  children,
  viewerLabel,
  authorityLabel,
  permissions,
  isPlatformOwner,
}: {
  children: ReactNode;
  viewerLabel: string;
  authorityLabel: string;
  permissions: PlatformPermissionKey[];
  isPlatformOwner: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <a href="#main-content" className="skip-link">
        Vai al contenuto principale
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#dce2df] bg-[#eef1ef] lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-[#dfe5e2] p-5">
            <ProductBrand href="/platform" />
            <div className="mt-5 rounded-2xl border border-[#dce2df] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(30,43,69,0.03)]">
              <p className="text-sm font-semibold text-[#1d2824]">Console piattaforma</p>
              <p className="mt-1 text-[11px] font-medium text-[#7f8b86]">Amministrazione globale</p>
            </div>
          </div>

          {isPlatformOwner ? (
            <div className="border-b border-[#dfe5e2] p-3">
              <Link
                href="/dashboard"
                className="flex items-center justify-between rounded-xl border border-[#d7dfdb] bg-white px-3 py-2.5 text-sm font-semibold text-[#46534e] shadow-[0_1px_2px_rgba(30,43,69,0.025)] hover:border-[#b9cfc7] hover:bg-[#f0f4f2] hover:text-[#173f35]"
              >
                <span>Torna al workspace aziendale</span>
                <span className="text-[#7b8882]">↗</span>
              </Link>
            </div>
          ) : null}

          <div className="sidebar-scroll flex-1 overflow-y-auto p-3">
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b9792]">
              Platform
            </p>
            <PlatformNavigation
              permissions={permissions}
              isPlatformOwner={isPlatformOwner}
            />

            <div className="mt-6 rounded-2xl border border-[#dfe5e2] bg-white/80 p-4">
              <p className="text-xs font-semibold text-[#47554f]">Separazione dei contesti</p>
              <p className="mt-2 text-xs leading-5 text-[#74817c]">
                La Platform Console gestisce governance e processi globali. L&apos;autorità Platform non apre automaticamente la Commercial Memory privata dei tenant.
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
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/platform" className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1d2824]">Smart Steel Sales · Console</p>
              <p className="text-xs text-[#7f8b86]">Amministrazione piattaforma</p>
            </Link>
            <div className="flex items-center gap-2">
              <PlatformMobileNavigation
                permissions={permissions}
                isPlatformOwner={isPlatformOwner}
              />
              {isPlatformOwner ? (
                <Link
                  href="/dashboard"
                  className="hidden rounded-full border border-[#d7dfdb] bg-white px-3.5 py-2 text-xs font-semibold text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#f0f4f2] hover:text-[#173f35] sm:inline-flex"
                >
                  Company Workspace
                </Link>
              ) : null}
              <span className="hidden rounded-full bg-[#e1ece8] px-3.5 py-2 text-xs font-semibold text-[#173f35] sm:inline-flex">
                {authorityLabel}
              </span>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mvp-focus-shell mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
