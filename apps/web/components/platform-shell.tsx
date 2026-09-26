import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";

const platformNav = [
  { href: "/platform", label: "Platform Home" },
  { href: "/platform/registrations", label: "Registrazioni aziende" },
];

export function PlatformShell({
  children,
  viewerLabel,
}: {
  children: ReactNode;
  viewerLabel: string;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 bg-slate-950 text-slate-300 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-bold tracking-[0.18em] text-indigo-300">STEEL SALES AI</p>
            <p className="mt-1 text-lg font-semibold text-white">Platform Console</p>
            <p className="mt-1 text-xs text-slate-500">Global control plane</p>
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
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-6 rounded-2xl border border-indigo-400/10 bg-indigo-500/5 p-4">
              <p className="text-xs font-semibold text-indigo-200">Separazione dei contesti</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                La Platform Console gestisce governance e onboarding globale. Non apre automaticamente la Commercial Memory privata dei tenant.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="truncate text-xs font-semibold text-slate-200">{viewerLabel}</p>
              <p className="mt-1 text-[11px] text-indigo-300">Platform Superadmin</p>
            </div>
            <form action={logout}>
              <button className="mt-3 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">
                Esci
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/platform">
              <p className="text-sm font-semibold text-slate-950">Steel Sales AI · Platform</p>
              <p className="text-xs text-slate-500">Control Plane</p>
            </Link>
            <div className="flex gap-2">
              <Link
                href="/dashboard"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Company Workspace
              </Link>
              <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
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
