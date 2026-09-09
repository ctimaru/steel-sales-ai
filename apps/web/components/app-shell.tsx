import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";

const nav = [
  { href: "/dashboard", label: "Dashboard", helper: "Overview commerciale", icon: "dashboard" },
  { href: "/explorer", label: "Commercial Explorer", helper: "Storico e ricerca", icon: "search" },
  { href: "/review", label: "Review Queue", helper: "Controllo qualità", icon: "review" },
] as const;

function NavIcon({ icon }: { icon: (typeof nav)[number]["icon"] }) {
  if (icon === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d="M4 4h6v6H4V4Zm10 0h6v10h-6V4ZM4 14h6v6H4v-6Zm10 4h6v2h-6v-2Z" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "search") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
        <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function initials(value: string) {
  const source = value.split("@")[0] ?? value;
  const parts = source.split(/[._\-\s]+/).filter(Boolean);
  if (!parts.length) return "SS";
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

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
    <div className="min-h-screen bg-[#f5f7fa] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] border-r border-white/5 bg-[#0b1725] text-slate-300 lg:block">
        <div className="flex h-full flex-col">
          <div className="px-5 pb-5 pt-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[11px] font-black tracking-tight text-[#0b1725] shadow-sm">
                SS
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Steel Sales</p>
                <p className="mt-0.5 text-[15px] font-semibold text-white">AI Workspace</p>
              </div>
            </div>
          </div>

          <div className="px-3">
            <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Workspace
            </p>
            <nav className="space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.05] text-slate-400 transition group-hover:border-white/10 group-hover:bg-white/10 group-hover:text-white">
                    <NavIcon icon={item.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{item.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-600 group-hover:text-slate-400">
                      {item.helper}
                    </span>
                  </span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="mx-4 mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Data layer</p>
              <span className={`h-2 w-2 rounded-full ${demoMode ? "bg-amber-400" : "bg-emerald-400"}`} />
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-200">
              {demoMode ? "Preview dataset" : "Supabase connected"}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">
              {demoMode ? "UI pronta per il collegamento live." : "RLS attivo · sessione autenticata."}
            </p>
          </div>

          <div className="mt-auto border-t border-white/[0.06] p-4">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-700 text-[11px] font-bold text-white">
                {initials(viewerLabel)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">{viewerLabel}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">Commercial workspace</p>
              </div>
            </div>
            <form action={logout}>
              <button className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-slate-500 transition hover:bg-white/[0.06] hover:text-white">
                Esci dal workspace
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-[68px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0b1725] text-[10px] font-black text-white lg:hidden">
                SS
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-950">Steel Sales AI</p>
                <p className="mt-0.5 hidden text-[10px] text-slate-400 sm:block">Commercial intelligence workspace</p>
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center md:flex">
              <Link
                href="/explorer"
                className="flex h-9 w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400 transition hover:border-slate-300 hover:bg-white"
              >
                <NavIcon icon="search" />
                <span className="truncate">Cerca prodotto, qualità, norma o dimensione...</span>
                <span className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">Explorer</span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex ${demoMode ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                {demoMode ? "PREVIEW" : "LIVE"}
              </span>
              <div className="flex items-center gap-1 lg:hidden">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600"
                    aria-label={item.label}
                  >
                    <NavIcon icon={item.icon} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="p-5 sm:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
