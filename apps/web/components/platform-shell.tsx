import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";
import { ProductBrand } from "@/components/product-brand";

const platformNav = [
  { href: "/platform", label: "Platform Home" },
  { href: "/platform/registrations", label: "Registrazioni aziende" },
  { href: "/platform/company-discovery", label: "Company Discovery" },
];

export function PlatformShell({
  children,
  viewerLabel,
}: {
  children: ReactNode;
  viewerLabel: string;
}) {
  return (
    <div className="min-h-screen bg-[#f3f5f7]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 bg-[#0b171e] text-[#b6c3c8] lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-5">
            <ProductBrand href="/platform" inverse />
            <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3">
              <p className="text-sm font-semibold text-white">Platform Console</p>
              <p className="mt-1 text-[11px] font-medium text-[#71858e]">Global control plane</p>
            </div>
          </div>

          <div className="border-b border-white/10 p-3">
            <Link
              href="/dashboard"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              <span>Apri Company Workspace</span>
              <span>↗</span>
            </Link>
          </div>

          <div className="flex-1 p-3">
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Platform
            </p>
            <nav className="space-y-1">
              {platformNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-[#b6c3c8] transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-6 rounded-2xl border border-indigo-400/10 bg-[#eef5f6]0/5 p-4">
              <p className="text-xs font-semibold text-[#bcd3da]">Separazione dei contesti</p>
              <p className="mt-2 text-xs leading-5 text-[#71858e]">
                La Platform Console gestisce governance e onboarding globale. Non apre automaticamente la Commercial Memory privata dei tenant.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="truncate text-xs font-semibold text-slate-200">{viewerLabel}</p>
              <p className="mt-1 text-[11px] text-[#8fb7c1]">Platform Superadmin</p>
            </div>
            <form action={logout}>
              <button className="mt-3 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#8fa1a9] hover:bg-white/10 hover:text-white">
                Esci
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-[#d9e0e4] bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/platform">
              <p className="text-sm font-semibold text-[#17232d]">Steel Sales AI · Platform</p>
              <p className="text-xs text-[#71858e]">Control Plane</p>
            </Link>
            <div className="flex gap-2">
              <Link
                href="/dashboard"
                className="rounded-full border border-[#d9e0e4] bg-white px-3 py-1.5 text-xs font-semibold text-[#33454e]"
              >
                Company Workspace
              </Link>
              <span className="rounded-full bg-[#eef5f6] px-3 py-1.5 text-xs font-semibold text-[#1b4c5d]">
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
