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

const analysisToolsNav: NavItem[] = [
  { href: appRoutes.commercial.explorer, label: "Commercial Explorer", shortLabel: "Explorer" },
  { href: appRoutes.commercial.priceIntelligence, label: "Price Intelligence", shortLabel: "Prezzi" },
  { href: appRoutes.commercial.marketIntelligence, label: "Market Intelligence", shortLabel: "Mercato" },
  { href: appRoutes.commercial.knowledgeExplorer, label: "Knowledge Explorer", shortLabel: "Knowledge" },
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
  { href: appRoutes.company.tubesStandards, label: "Strumenti tubi & norme" },
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
      title: "Analisi & strumenti",
      items: visibleItems(analysisToolsNav, organizationRole),
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
    ...analysisToolsNav,
    ...intelligenceNav,
    ...operationsNav,
    ...companyNav,
    ...(networkEnabled ? networkNav : []),
    ...knowledgeNav,
  ]
    .filter((item) => canSee(item, organizationRole))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index);

  return (
    <div className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-[#dce2df] bg-[#eef1ef] lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-[#dfe5e2] p-5">
            <ProductBrand href={appRoutes.home} />
            <div className="mt-5 rounded-2xl border border-[#dce2df] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(30,43,69,0.03)]">
              <p className="truncate text-sm font-semibold text-[#1d2824]">{organizationName}</p>
              <p className="mt-1 text-[11px] font-medium text-[#78857f]">Company Workspace</p>
            </div>
          </div>

          {platformSuperadmin ? (
            <div className="border-b border-[#dfe5e2] p-3">
              <Link
                href={appRoutes.platform.home}
                className="flex items-center justify-between rounded-xl border border-[#d9e8e2] bg-[#edf5f2] px-3 py-2.5 text-sm font-semibold text-[#173f35] transition hover:border-[#b8d2c8] hover:bg-[#e3efea]"
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

          <div className="border-t border-[#dfe5e2] p-4">
            <div className="rounded-xl border border-[#dce2df] bg-white p-3">
              <p className="truncate text-xs font-semibold text-[#3e4a45]">{viewerLabel}</p>
              <p className="mt-1 text-[11px] text-[#78857f]">
                {demoMode ? "Modalità demo" : roleLabel(organizationRole)}
              </p>
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
        <header className="sticky top-0 z-20 border-b border-[#dce2df] bg-white/92 backdrop-blur-xl">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <WorkspaceHeaderContext
              organizationName={organizationName}
              roleLabel={roleLabel(organizationRole)}
            />

            <div className="flex max-w-[72vw] items-center gap-1.5 overflow-x-auto lg:hidden">
              <WorkspaceMobileSpaceTabs networkEnabled={networkEnabled} />
              <details className="relative shrink-0">
                <summary className="cursor-pointer list-none rounded-xl border border-[#d7dfdb] bg-white px-3 py-1.5 text-xs font-semibold text-[#43524c]">
                  Altro
                </summary>
                <div className="fixed left-4 right-4 top-16 z-40 grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-[#dce2df] bg-white p-3 shadow-xl sm:left-auto sm:right-6 sm:w-96">
                  {mobileMore.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-xl border border-[#e2e7e4] bg-[#eef1ef] px-3 py-2.5 text-xs font-semibold text-[#43524c] hover:border-[#b9cfc7] hover:bg-[#edf5f2] hover:text-[#173f35]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
              {platformSuperadmin ? (
                <Link
                  href={appRoutes.platform.home}
                  className="shrink-0 rounded-xl bg-[#173f35] px-3 py-1.5 text-xs font-semibold text-white"
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
                  className="rounded-full border border-[#d9e8e2] bg-[#e1ece8] px-3 py-1.5 text-xs font-semibold text-[#173f35]"
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
