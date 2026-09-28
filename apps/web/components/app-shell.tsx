import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";
import { ProductBrand } from "@/components/product-brand";
import {
  WorkspaceHeaderContext,
  WorkspaceMobileSpaceTabs,
  WorkspaceSpaceNavigation,
  type WorkspaceNavGroup,
} from "@/components/workspace-navigation";
import { canAdministerCompany, canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  adminOnly?: boolean;
  writeRole?: boolean;
};

const commercialMemoryNav: NavItem[] = [
  { href: appRoutes.commercial.products, label: "Product 360", shortLabel: "Prodotti" },
  { href: appRoutes.commercial.companies, label: "Aziende commerciali", shortLabel: "Aziende" },
  { href: appRoutes.commercial.assistant, label: "Assistente" },
  { href: appRoutes.commercial.search, label: "Ricerca nello storico", shortLabel: "Cerca" },
];

const intelligenceNav: NavItem[] = [
  { href: appRoutes.commercial.reengagement, label: "Riattivazione commerciale", shortLabel: "Riattivazione" },
  { href: appRoutes.commercial.demand, label: "Segnali di domanda", shortLabel: "Domanda" },
  { href: appRoutes.commercial.conversion, label: "Esiti & conversione", shortLabel: "Conversione" },
  { href: appRoutes.commercial.crossThreadRelationships, label: "Relazioni cross-thread", shortLabel: "Relazioni" },
];

const networkNav: NavItem[] = [
  { href: appRoutes.network.directory, label: "Directory aziende", shortLabel: "Directory" },
  { href: appRoutes.network.saved, label: "Aziende salvate" },
  { href: appRoutes.network.following, label: "Aziende seguite" },
  { href: appRoutes.network.activity, label: "Activity" },
  { href: appRoutes.network.inquiries, label: "Inquiry B2B" },
];

const marketplaceNav: NavItem[] = [
  { href: appRoutes.marketplace.home, label: "Marketplace Home", shortLabel: "Marketplace" },
];

const knowledgeNav: NavItem[] = [
  { href: appRoutes.knowledge.home, label: "Knowledge Home", shortLabel: "Knowledge" },
  { href: appRoutes.knowledge.standards, label: "Norme" },
  { href: appRoutes.knowledge.grades, label: "Gradi di acciaio", shortLabel: "Gradi" },
  { href: appRoutes.knowledge.tubes, label: "Pesi & dimensioni", shortLabel: "Pesi" },
];

const operationsNav: NavItem[] = [
  { href: appRoutes.operations.uploads, label: "Importa documenti", writeRole: true },
  { href: appRoutes.operations.review, label: "Correzioni", writeRole: true },
  { href: appRoutes.operations.alerts, label: "Alert operativi" },
];

const companyNav: NavItem[] = [
  { href: appRoutes.company.profile, label: "Profilo azienda", adminOnly: true },
  { href: appRoutes.company.dataSources, label: "Fonti e import", adminOnly: true },
  { href: appRoutes.company.pilotAnalytics, label: "Pilot analytics", adminOnly: true },
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

function visibleItems(items: NavItem[], role: string) {
  return items
    .filter((item) => canSee(item, role))
    .map(({ href, label }) => ({ href, label }));
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
  const networkItems = networkEnabled ? visibleItems(networkNav, organizationRole) : [];
  const marketplaceItems = networkEnabled ? visibleItems(marketplaceNav, organizationRole) : [];
  const knowledgeItems = visibleItems(knowledgeNav, organizationRole);

  const workspaceGroups: WorkspaceNavGroup[] = [
    {
      title: "Commercial Memory",
      items: visibleItems(commercialMemoryNav, organizationRole),
    },
    {
      title: "Commercial Intelligence",
      items: visibleItems(intelligenceNav, organizationRole),
    },
    {
      title: "Operations",
      items: visibleItems(operationsNav, organizationRole),
      alertHref: appRoutes.operations.alerts,
    },
    {
      title: "Company",
      items: visibleItems(companyNav, organizationRole),
    },
  ];

  const mobileMore = [
    ...commercialMemoryNav,
    ...intelligenceNav,
    ...operationsNav,
    ...companyNav,
    ...(networkEnabled ? networkNav : []),
    ...knowledgeNav,
  ]
    .filter((item) => canSee(item, organizationRole))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#1e2b45]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#e3eaf5] bg-[#f8fafd] lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-[#e8eef7] p-5">
            <ProductBrand href={appRoutes.home} />
            <div className="mt-5 rounded-2xl border border-[#e3eaf5] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(30,43,69,0.03)]">
              <p className="truncate text-sm font-semibold text-[#1e2b45]">{organizationName}</p>
              <p className="mt-1 text-[11px] font-medium text-[#8090a5]">Company Workspace</p>
            </div>
          </div>

          {platformSuperadmin ? (
            <div className="border-b border-[#e8eef7] p-3">
              <Link
                href={appRoutes.platform.home}
                className="flex items-center justify-between rounded-xl border border-[#d7e5ff] bg-[#eef5ff] px-3 py-2.5 text-sm font-semibold text-[#2f6fed] transition hover:border-[#bdd1f4] hover:bg-[#e4efff]"
              >
                <span>Apri Platform Console</span>
                <span>↗</span>
              </Link>
            </div>
          ) : null}

          <div className="sidebar-scroll flex-1 overflow-y-auto p-3">
            <WorkspaceSpaceNavigation
              workspaceGroups={workspaceGroups}
              networkItems={networkItems}
              marketplaceItems={marketplaceItems}
              knowledgeItems={knowledgeItems}
              alertActiveCount={alertActiveCount}
              networkEnabled={networkEnabled}
            />
          </div>

          <div className="border-t border-[#e8eef7] p-4">
            <div className="rounded-xl border border-[#e3eaf5] bg-white p-3">
              <p className="truncate text-xs font-semibold text-[#34445c]">{viewerLabel}</p>
              <p className="mt-1 text-[11px] text-[#7e8da1]">
                {demoMode ? "Modalità demo" : roleLabel(organizationRole)}
              </p>
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
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <WorkspaceHeaderContext
              organizationName={organizationName}
              roleLabel={roleLabel(organizationRole)}
            />

            <div className="flex max-w-[72vw] items-center gap-1.5 overflow-x-auto lg:hidden">
              <WorkspaceMobileSpaceTabs networkEnabled={networkEnabled} />
              <details className="relative shrink-0">
                <summary className="cursor-pointer list-none rounded-xl border border-[#dbe5f1] bg-white px-3 py-1.5 text-xs font-semibold text-[#40516a]">
                  Altro
                </summary>
                <div className="fixed left-4 right-4 top-16 z-40 grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-[#e3eaf5] bg-white p-3 shadow-xl sm:left-auto sm:right-6 sm:w-96">
                  {mobileMore.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-xl border border-[#e7edf5] bg-[#f8fafd] px-3 py-2.5 text-xs font-semibold text-[#40516a] hover:border-[#c7d8f5] hover:bg-[#eef5ff] hover:text-[#2f6fed]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
              {platformSuperadmin ? (
                <Link
                  href={appRoutes.platform.home}
                  className="shrink-0 rounded-xl bg-[#2f6fed] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Platform
                </Link>
              ) : null}
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              {alertNeedsAttention ? (
                <Link
                  href={appRoutes.operations.alerts}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                >
                  {alertActiveCount > 0 ? `Alert · ${alertActiveCount}` : "Alert"}
                </Link>
              ) : null}
              {platformSuperadmin ? (
                <Link
                  href={appRoutes.platform.home}
                  className="rounded-full border border-[#d7e5ff] bg-[#eaf2ff] px-3 py-1.5 text-xs font-semibold text-[#2f6fed]"
                >
                  Platform Console
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
