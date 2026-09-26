import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";
import { canAdministerCompany, canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  adminOnly?: boolean;
  writeRole?: boolean;
};

const commercialNav: NavItem[] = [
  { href: appRoutes.commercial.search, label: "Cerca nello storico", shortLabel: "Cerca" },
  { href: appRoutes.commercial.products, label: "Storico prodotti", shortLabel: "Prodotti" },
  { href: appRoutes.commercial.companies, label: "Aziende commerciali", shortLabel: "Commerciale" },
  { href: appRoutes.commercial.assistant, label: "Assistente" },
];

const networkNav: NavItem[] = [
  { href: "/network", label: "Esplora Steel Network", shortLabel: "Network" },
  { href: "/network/saved", label: "Aziende salvate" },
  { href: "/network/following", label: "Aziende seguite" },
  { href: "/network/activity", label: "Activity" },
  { href: appRoutes.network.inquiries, label: "Inquiry" },
];

const operationsNav: NavItem[] = [
  { href: appRoutes.operations.uploads, label: "Importa documenti", writeRole: true },
  { href: appRoutes.operations.review, label: "Correzioni", writeRole: true },
  { href: appRoutes.operations.alerts, label: "Alert operativi" },
];

const companyToolsNav: NavItem[] = [
  { href: appRoutes.company.profile, label: "Profilo azienda", adminOnly: true },
  { href: appRoutes.company.dataSources, label: "Fonti e import", adminOnly: true },
  { href: appRoutes.company.pilotAnalytics, label: "Pilot analytics", adminOnly: true },
  { href: appRoutes.company.tubesStandards, label: "Tubi & Norme" },
];

function roleLabel(role: string) {
  if (role === "admin") return "Organization Admin";
  if (role === "viewer") return "Viewer";
  return "Member";
}

function canSee(item: NavItem, role: string) {
  if (item.adminOnly && !canAdministerCompany(role)) return false;
  if (item.writeRole && !canWriteWorkspace(role)) return false;
  return true;
}

function NavSection({
  title,
  items,
  role,
  alertActiveCount,
}: {
  title: string;
  items: NavItem[];
  role: string;
  alertActiveCount: number;
}) {
  const visible = items.filter((item) => canSee(item, role));
  if (!visible.length) return null;

  return (
    <div>
      <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
        {title}
      </p>
      <nav className="space-y-1">
        {visible.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <span>{item.label}</span>
            {item.href === appRoutes.operations.alerts && alertActiveCount > 0 ? (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                {alertActiveCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function AppShell({
  children,
  viewerLabel,
  organizationName,
  organizationRole,
  demoMode,
  alertNeedsAttention,
  alertActiveCount,
  platformSuperadmin,
  networkEnabled,
}: {
  children: ReactNode;
  viewerLabel: string;
  organizationName: string;
  organizationRole: string;
  demoMode: boolean;
  alertNeedsAttention: boolean;
  alertActiveCount: number;
  platformSuperadmin: boolean;
  networkEnabled: boolean;
}) {
  const networkItems = networkEnabled ? networkNav : [];

  const mobilePrimary = [
    { href: appRoutes.home, label: "Home" },
    { href: appRoutes.commercial.search, label: "Cerca" },
    ...(networkEnabled
      ? [
          { href: appRoutes.network.directory, label: "Network" },
          { href: "/network/inquiries", label: "Inquiry" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-slate-950 text-slate-300 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-bold tracking-[0.18em] text-slate-500">STEEL SALES AI</p>
            <p className="mt-1 truncate text-lg font-semibold text-white">{organizationName}</p>
            <p className="mt-1 text-xs text-slate-500">Company Workspace</p>
          </div>

          {platformSuperadmin ? (
            <div className="border-b border-white/10 p-3">
              <Link
                href={appRoutes.platform.home}
                className="flex items-center justify-between rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-2.5 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
              >
                <span>Apri Platform Console</span>
                <span>↗</span>
              </Link>
            </div>
          ) : null}

          <div className="flex-1 space-y-5 overflow-y-auto p-3">
            <div>
              <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Workspace
              </p>
              <nav>
                <Link
                  href={appRoutes.home}
                  className="flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Home azienda
                </Link>
              </nav>
            </div>

            <NavSection title="Commercial Memory" items={commercialNav} role={organizationRole} alertActiveCount={alertActiveCount} />
            <NavSection title="Steel Network" items={networkItems} role={organizationRole} alertActiveCount={alertActiveCount} />
            <NavSection title="Operations" items={operationsNav} role={organizationRole} alertActiveCount={alertActiveCount} />
            <NavSection title="Company" items={companyToolsNav} role={organizationRole} alertActiveCount={alertActiveCount} />
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="truncate text-xs font-semibold text-slate-200">{viewerLabel}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {demoMode ? "Modalità demo" : roleLabel(organizationRole)}
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

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <Link href={appRoutes.home} className="min-w-0 shrink">
              <p className="truncate text-sm font-semibold text-slate-950">{organizationName}</p>
              <p className="truncate text-xs text-slate-500">
                Company Workspace · {roleLabel(organizationRole)}
              </p>
            </Link>

            <div className="flex max-w-[68vw] items-center gap-1.5 overflow-x-auto lg:hidden">
              {mobilePrimary.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {item.label}
                </Link>
              ))}
              <details className="relative shrink-0">
                <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
                  Altro
                </summary>
                <div className="fixed left-4 right-4 top-16 z-40 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:left-auto sm:right-6 sm:w-96">
                  {[...commercialNav, ...networkItems, ...operationsNav, ...companyToolsNav]
                    .filter((item) => canSee(item, organizationRole))
                    .filter((item) => !mobilePrimary.some((primary) => primary.href === item.href))
                    .map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700"
                      >
                        {item.label}
                      </Link>
                    ))}
                </div>
              </details>
              {platformSuperadmin ? (
                <Link
                  href={appRoutes.platform.home}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Platform
                </Link>
              ) : null}
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              {platformSuperadmin ? (
                <Link
                  href={appRoutes.platform.home}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                >
                  Platform Console
                </Link>
              ) : null}
              {alertNeedsAttention ? (
                <Link
                  href={appRoutes.operations.alerts}
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                >
                  {alertActiveCount > 0 ? `Alert · ${alertActiveCount}` : "Alert"}
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
