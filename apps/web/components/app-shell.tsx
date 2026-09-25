import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";

const primaryNav = [
  { href: "/dashboard", label: "Home", shortLabel: "Home" },
  { href: "/search", label: "Cerca", shortLabel: "Cerca" },
  { href: "/products", label: "Storico prodotti", shortLabel: "Prodotti" },
  { href: "/customers", label: "Clienti / aziende", shortLabel: "Clienti" },
  { href: "/network", label: "Industry Network", shortLabel: "Network" },
];

const secondaryNav = [
  { href: "/assistant", label: "Assistente" },
  { href: "/review", label: "Correzioni" },
  { href: "/alerts", label: "Alert operativi" },
  { href: "/pilot-analytics", label: "Pilot analytics" },
  { href: "/uploads", label: "Importa" },
  { href: "/tubi-norme", label: "Tubi & Norme" },
  { href: "/data-sources", label: "Fonti e import" },
];

export function AppShell({
  children,
  viewerLabel,
  demoMode,
  alertNeedsAttention,
  alertActiveCount,
  platformSuperadmin,
}: {
  children: ReactNode;
  viewerLabel: string;
  demoMode: boolean;
  alertNeedsAttention: boolean;
  alertActiveCount: number;
  platformSuperadmin: boolean;
}) {
  const toolsNav = platformSuperadmin
    ? [...secondaryNav, { href: "/admin/registrations", label: "Platform admin" }]
    : secondaryNav;

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-slate-950 text-slate-300 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-bold tracking-[0.18em] text-slate-500">STEEL SALES AI</p>
            <p className="mt-1 text-lg font-semibold text-white">Commercial Memory + Network</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Lavoro quotidiano
            </p>
            <nav className="space-y-1">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-white/10 hover:text-white"
                >
                  <span className="h-2 w-2 rounded-full bg-white/30" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="my-4 border-t border-white/10" />
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Strumenti
            </p>
            <nav className="space-y-1">
              {toolsNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <span>{item.label}</span>
                  {item.href === "/alerts" && alertActiveCount > 0 ? (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                      {alertActiveCount}
                    </span>
                  ) : null}
                  {item.href === "/admin/registrations" ? (
                    <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                      ADMIN
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="truncate text-xs font-semibold text-slate-200">{viewerLabel}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {platformSuperadmin
                  ? "Platform Superadmin"
                  : demoMode
                    ? "Modalità demo"
                    : "Workspace connesso"}
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
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/dashboard" className="shrink-0">
              <p className="text-sm font-semibold text-slate-950">Steel Sales AI</p>
              <p className="text-xs text-slate-500">Commercial Memory privata · Industry Network condiviso</p>
            </Link>

            <div className="flex max-w-[64vw] items-center gap-1.5 overflow-x-auto lg:hidden">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {item.shortLabel}
                </Link>
              ))}
              <details className="relative shrink-0">
                <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
                  Altro
                </summary>
                <div className="fixed left-4 right-4 top-16 z-40 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:left-auto sm:right-6 sm:w-80">
                  {toolsNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700"
                    >
                      <span>{item.label}</span>
                      {item.href === "/alerts" && alertActiveCount > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          {alertActiveCount}
                        </span>
                      ) : null}
                      {item.href === "/admin/registrations" ? (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          ADMIN
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </details>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              {platformSuperadmin ? (
                <Link
                  href="/admin/registrations"
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                >
                  Superadmin
                </Link>
              ) : null}
              {alertNeedsAttention ? (
                <Link
                  href="/alerts"
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                >
                  {alertActiveCount > 0 ? `Alert · ${alertActiveCount}` : "Alert"}
                </Link>
              ) : null}
              {demoMode ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Demo data
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Connesso
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
