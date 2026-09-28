import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";
import { PlatformNavigation } from "@/components/platform-navigation";
import { ProductBrand } from "@/components/product-brand";

export function PlatformShell({
  children,
  viewerLabel,
}: {
  children: ReactNode;
  viewerLabel: string;
}) {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#1e2b45]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#e3eaf5] bg-[#f8fafd] lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-[#e8eef7] p-5">
            <ProductBrand href="/platform" />
            <div className="mt-5 rounded-2xl border border-[#e3eaf5] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(30,43,69,0.03)]">
              <p className="text-sm font-semibold text-[#1e2b45]">Platform Console</p>
              <p className="mt-1 text-[11px] font-medium text-[#8a98aa]">Global control plane</p>
            </div>
          </div>

          <div className="border-b border-[#e8eef7] p-3">
            <Link
              href="/dashboard"
              className="flex items-center justify-between rounded-xl border border-[#dbe5f1] bg-white px-3 py-2.5 text-sm font-semibold text-[#42516a] shadow-[0_1px_2px_rgba(30,43,69,0.025)] hover:border-[#c7d8f5] hover:bg-[#f3f7ff] hover:text-[#2f6fed]"
            >
              <span>Apri Company Workspace</span>
              <span className="text-[#7f8da3]">↗</span>
            </Link>
          </div>

          <div className="sidebar-scroll flex-1 overflow-y-auto p-3">
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ba8b9]">
              Platform
            </p>
            <PlatformNavigation />

            <div className="mt-6 rounded-2xl border border-[#e1e9f4] bg-white/80 p-4">
              <p className="text-xs font-semibold text-[#44546b]">Separazione dei contesti</p>
              <p className="mt-2 text-xs leading-5 text-[#7a899d]">
                La Platform Console gestisce governance e onboarding globale. Non apre automaticamente la Commercial Memory privata dei tenant.
              </p>
            </div>
          </div>

          <div className="border-t border-[#e8eef7] p-4">
            <div className="rounded-xl border border-[#e3eaf5] bg-white p-3">
              <p className="truncate text-xs font-semibold text-[#34445c]">{viewerLabel}</p>
              <p className="mt-1 text-[11px] font-medium text-[#6c7e96]">Platform Owner</p>
            </div>
            <form action={logout}>
              <button className="mt-3 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#65758b] hover:bg-[#eef3fa] hover:text-[#2b3a52]">
                Esci
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-[#e3eaf5] bg-white/92 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/platform" className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1e2b45]">Steel Sales AI · Platform</p>
              <p className="text-xs text-[#8795a8]">Control Plane</p>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="hidden rounded-full border border-[#dbe5f1] bg-white px-3.5 py-2 text-xs font-semibold text-[#40516a] hover:border-[#bdd1f4] hover:bg-[#f3f7ff] hover:text-[#2f6fed] sm:inline-flex"
              >
                Company Workspace
              </Link>
              <span className="rounded-full bg-[#eaf2ff] px-3.5 py-2 text-xs font-semibold text-[#2f6fed]">
                Superadmin
              </span>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
