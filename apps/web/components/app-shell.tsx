import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";

const nav = [
  { href: "/dashboard", label: "Dashboard", key: "D" },
  { href: "/assistant", label: "AI Assistant", key: "A" },
  { href: "/explorer", label: "Commercial Explorer", key: "C" },
  { href: "/price-intelligence", label: "Price Intelligence", key: "P" },
  { href: "/unconverted-offers", label: "Offerte senza ordine", key: "O" },
  { href: "/review", label: "Review Queue", key: "R" },
  { href: "/uploads", label: "Upload documenti", key: "U" },
];

export function AppShell({
  children,
  viewerLabel,
  demoMode,
}: {
  children: ReactNode;
  viewerLabel: string;
  demoMode: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-slate-950 text-slate-300 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-bold tracking-[0.18em] text-slate-500">STEEL SALES</p>
            <p className="mt-1 text-lg font-semibold text-white">AI Workspace</p>
          </div>
          <nav className="space-y-1 p-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-white/10 hover:text-white"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-xs font-bold">
                  {item.key}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-white/10 p-4">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="truncate text-xs font-semibold text-slate-200">{viewerLabel}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {demoMode ? "Modalità demo" : "Supabase Auth"}
              </p>
            </div>
            <form action={logout}>
              <button className="mt-3 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white">
                Esci
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-5 sm:px-8">
            <div>
              <p className="text-sm font-semibold text-slate-950">Steel Sales AI</p>
              <p className="text-xs text-slate-500">Commercial intelligence</p>
            </div>
            <div className="flex items-center gap-1.5 lg:hidden">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {item.key}
                </Link>
              ))}
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              {demoMode ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Demo data
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Connected
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
