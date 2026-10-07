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
  { href: appRoutes.commercial.home, label: "Home", contextKey: "commercial:home" },
  { href: appRoutes.commercial.search, label: "Cerca", contextKey: "commercial:search" },
  { href: appRoutes.commercial.products, label: "Prodotti", contextKey: "commercial:products" },
  { href: appRoutes.commercial.companies, label: "Aziende", contextKey: "commercial:companies" },
  { href: appRoutes.commercial.assistant, label: "Assistente", contextKey: "commercial:assistant" },
  { href: appRoutes.commercial.explorer, label: "Explorer", contextKey: "commercial:explorer" },
];

const intelligenceNav: NavItem[] = [
  { href: appRoutes.commercial.priceIntelligence, label: "Price Intelligence", contextKey: "commercial:intelligence:prices" },
  { href: appRoutes.commercial.marketIntelligence, label: "Market Intelligence", contextKey: "commercial:intelligence:market" },
  { href: appRoutes.commercial.reengagement, label: "Riattivazione", contextKey: "commercial:intelligence:reengagement" },
  { href: appRoutes.commercial.demand, label: "Segnali di domanda", contextKey: "commercial:intelligence:demand" },
  { href: appRoutes.commercial.conversion, label: "Conversione", contextKey: "commercial:intelligence:conversion" },
  { href: appRoutes.commercial.crossThreadRelationships, label: "Relazioni cross-thread", contextKey: "commercial:intelligence:relationships" },
];

const networkNav: NavItem[] = [
  { href: appRoutes.network.directory, label: "Directory", contextKey: "network:directory" },
  { href: appRoutes.network.saved, label: "Salvate", contextKey: "network:saved" },
  { href: appRoutes.network.following, label: "Seguite", contextKey: "network:following" },
  { href: appRoutes.network.activity, label: "Activity", contextKey: "network:activity" },
  { href: appRoutes.network.inquiries, label: "Inquiry", contextKey: "network:inquiries" },
];

const marketplaceNav: NavItem[] = [
  { href: appRoutes.marketplace.home, label: "Opportunità", contextKey: "marketplace:opportunities" },
  { href: appRoutes.marketplace.procurementInbox, label: "Inbox acquisti", contextKey: "marketplace:inbox", writeRole: true },
  { href: appRoutes.marketplace.suppliers, label: "Supplier", contextKey: "marketplace:suppliers", writeRole: true },
  { href: appRoutes.marketplace.notifications, label: "Per te", contextKey: "marketplace:notifications" },
  { href: appRoutes.marketplace.myRequests, label: "Le mie ricerche", contextKey: "marketplace:requests" },
  { href: appRoutes.marketplace.rfqHub, label: "RFQ Hub", contextKey: "marketplace:rfq-hub", writeRole: true },
  { href: appRoutes.marketplace.responses, label: "Risposte ricevute", contextKey: "marketplace:responses" },
  { href: appRoutes.marketplace.newRequest, label: "Nuova ricerca", contextKey: "marketplace:new", writeRole: true },
];

const knowledgeNav: NavItem[] = [
  { href: appRoutes.knowledge.workspace, label: "Home", contextKey: "knowledge:home" },
  { href: appRoutes.knowledge.explorer, label: "Knowledge Explorer", contextKey: "knowledge:explorer" },
  { href: appRoutes.knowledge.catalog, label: "Catalogo tecnico", contextKey: "knowledge:catalog" },
  { href: appRoutes.knowledge.schoolStandards, label: "Norme", contextKey: "knowledge:standards" },
  { href: appRoutes.knowledge.schoolGrades, label: "Gradi", contextKey: "knowledge:grades" },
  { href: appRoutes.knowledge.schoolTubes, label: "Pesi & dimensioni", contextKey: "knowledge:tubes" },
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
    .map(({ href, label, contextKey }) => ({ href, label, contextKey }));
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
  networkEntitled,
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
  networkEntitled: boolean;
}) {
  const commercialItems = visibleItems(commercialNav, organizationRole);
  const intelligenceItems = visibleItems(intelligenceNav, organizationRole);
  const networkItems =
    networkEnabled && networkEntitled ? visibleItems(networkNav, organizationRole) : [];
  const marketplaceItems = networkEnabled ? visibleItems(marketplaceNav, organizationRole) : [];
  const knowledgeItems = visibleItems(knowledgeNav, organizationRole);
  const canAdmin = canAdministerCompany(organizationRole);
  const canWrite = canWriteWorkspace(organizationRole);
  const effectiveRole = demoMode ? "Modalità demo" : roleLabel(organizationRole);

  return (
    <div className="min-h-screen bg-[#f2f4f3] pb-[calc(5rem+env(safe-area-inset-bottom))] text-[#1d2824] lg:pb-0">
      <a href="#main-content" className="skip-link">
        Vai al contenuto principale
      </a>
      <header className="sticky top-0 z-40 border-b border-[#dce2df] bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-3 sm:px-5 lg:px-8">
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
            <WorkspaceDesktopPrimaryNavigation
              networkEnabled={networkEnabled}
              networkEntitled={networkEntitled}
            />
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

      <main id="main-content" tabIndex={-1} className="mvp-focus-shell mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      <WorkspaceMobileBottomNavigation
        networkEnabled={networkEnabled}
        networkEntitled={networkEntitled}
      />
    </div>
  );
}
