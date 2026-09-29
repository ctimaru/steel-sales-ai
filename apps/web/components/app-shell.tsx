import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";
import { ProductBrand } from "@/components/product-brand";
import {
  WorkspaceAlertsButton,
  WorkspaceContextNavigation,
  WorkspaceDesktopPrimaryNavigation,
  WorkspaceMobileBottomNavigation,
  WorkspaceProfileMenu,
  WorkspaceSearchBar,
  type WorkspaceNavItem,
} from "@/components/workspace-navigation";
import { canAdministerCompany, canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";

type NavItem = WorkspaceNavItem & {
  adminOnly?: boolean;
  writeRole?: boolean;
};

const commercialNav: NavItem[] = [
  { href: appRoutes.commercial.search, label: "Cerca" },
  { href: appRoutes.commercial.products, label: "Prodotti" },
  { href: appRoutes.commercial.companies, label: "Aziende" },
  { href: appRoutes.commercial.assistant, label: "Assistente" },
  { href: appRoutes.commercial.explorer, label: "Explorer" },
];

const intelligenceNav: NavItem[] = [
  { href: appRoutes.commercial.priceIntelligence, label: "Price Intelligence" },
  { href: appRoutes.commercial.marketIntelligence, label: "Market Intelligence" },
  { href: appRoutes.commercial.reengagement, label: "Riattivazione" },
  { href: appRoutes.commercial.demand, label: "Segnali di domanda" },
  { href: appRoutes.commercial.conversion, label: "Conversione" },
  { href: appRoutes.commercial.crossThreadRelationships, label: "Relazioni cross-thread" },
];

const networkNav: NavItem[] = [
  { href: appRoutes.network.directory, label: "Directory" },
  { href: appRoutes.network.saved, label: "Salvate" },
  { href: appRoutes.network.following, label: "Seguite" },
  { href: appRoutes.network.activity, label: "Activity" },
  { href: appRoutes.network.inquiries, label: "Inquiry" },
];

const marketplaceNav: NavItem[] = [
  { href: appRoutes.marketplace.home, label: "Opportunità" },
  { href: appRoutes.marketplace.notifications, label: "Per te" },
  { href: appRoutes.marketplace.myRequests, label: "Le mie ricerche" },
  { href: appRoutes.marketplace.responses, label: "Risposte" },
  { href: appRoutes.marketplace.newRequest, label: "Nuova ricerca", writeRole: true },
];

const knowledgeNav: NavItem[] = [
  { href: appRoutes.knowledge.workspace, label: "Home" },
  { href: appRoutes.commercial.knowledgeExplorer, label: "Knowledge Explorer" },
  { href: appRoutes.knowledge.catalog, label: "Catalogo tecnico" },
  { href: appRoutes.knowledge.schoolStandards, label: "Norme" },
  { href: appRoutes.knowledge.schoolGrades, label: "Gradi" },
  { href: appRoutes.knowledge.schoolTubes, label: "Pesi & dimensioni" },
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

function visibleItems(items: NavItem[], role: string): WorkspaceNavItem[] {
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
  const commercialItems = visibleItems(commercialNav, organizationRole);
  const intelligenceItems = visibleItems(intelligenceNav, organizationRole);
  const networkItems = networkEnabled ? visibleItems(networkNav, organizationRole) : [];
  const marketplaceItems = networkEnabled ? visibleItems(marketplaceNav, organizationRole) : [];
  const knowledgeItems = visibleItems(knowledgeNav, organizationRole);
  const canAdmin = canAdministerCompany(organizationRole);
  const canWrite = canWriteWorkspace(organizationRole);
  const effectiveRole = demoMode ? "Modalità demo" : roleLabel(organizationRole);

  return (
    <div className="min-h-screen bg-[#f2f4f3] pb-20 text-[#1d2824] lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-[#dce2df] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-3 sm:px-5 lg:px-8">
          <div className="hidden shrink-0 lg:block">
            <ProductBrand href={appRoutes.home} compact />
          </div>

          <div className="lg:hidden">
            <WorkspaceProfileMenu
              viewerLabel={viewerLabel}
              organizationName={organizationName}
              organizationRoleLabel={effectiveRole}
              platformSuperadmin={platformSuperadmin}
              canAdmin={canAdmin}
              canWrite={canWrite}
              logoutAction={logout}
            />
          </div>

          <WorkspaceSearchBar />

          <div className="ml-auto hidden h-full lg:flex">
            <WorkspaceDesktopPrimaryNavigation networkEnabled={networkEnabled} />
          </div>

          <div className="ml-auto flex items-center gap-1 lg:ml-2">
            <WorkspaceAlertsButton
              activeCount={alertActiveCount}
              needsAttention={alertNeedsAttention}
            />
            <div className="hidden lg:block">
              <WorkspaceProfileMenu
                viewerLabel={viewerLabel}
                organizationName={organizationName}
                organizationRoleLabel={effectiveRole}
                platformSuperadmin={platformSuperadmin}
                canAdmin={canAdmin}
                canWrite={canWrite}
                logoutAction={logout}
              />
            </div>
          </div>
        </div>

        <WorkspaceContextNavigation
          commercialItems={commercialItems}
          intelligenceItems={intelligenceItems}
          networkItems={networkItems}
          marketplaceItems={marketplaceItems}
          knowledgeItems={knowledgeItems}
        />
      </header>

      <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      <WorkspaceMobileBottomNavigation networkEnabled={networkEnabled} />
    </div>
  );
}
