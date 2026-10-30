import type { ReactNode } from "react";

import { logout } from "@/app/(workspace)/actions";
import { ContextSwitchLink } from "@/components/context-switch-link";
import { WorkspaceCommercialDirectorShell } from "@/components/workspace-commercial-director-shell";
import { HeaderMenuDismissController } from "@/components/header-menu-dismiss-controller";
import { WorkspaceNotificationBell } from "@/components/workspace-notification-bell";
import { ProductBrand } from "@/components/product-brand";
import {
  WorkspaceContextNavigation,
  WorkspaceDesktopPrimaryNavigation,
  WorkspaceMobileBottomNavigation,
  WorkspaceProfileMenu,
  WorkspaceSearchBar,
  type WorkspaceNavItem,
} from "@/components/workspace-navigation";
import { canAdministerCompany, canWriteWorkspace } from "@/lib/access-policy";
import { appRoutes } from "@/lib/routes";
import type { WorkspaceNotificationSnapshot } from "@/lib/workspace-notifications";

type NavItem = WorkspaceNavItem & {
  adminOnly?: boolean;
  writeRole?: boolean;
};

// COMM-UX1A: three task-oriented destinations. All specialist routes remain
// reachable from their work area; the top-level menu is not a feature inventory.
const commercialNav: NavItem[] = [
  { href: appRoutes.commercial.home, label: "Attività", contextKey: "commercial:home" },
  { href: appRoutes.commercial.companies, label: "Relazioni", contextKey: "commercial:companies" },
  { href: appRoutes.commercial.analysis, label: "Analisi", contextKey: "commercial:analysis" },
];

const networkNav: NavItem[] = [
  { href: appRoutes.network.directory, label: "Esplora aziende", contextKey: "network:directory" },
  { href: appRoutes.network.connections, label: "Connessioni", contextKey: "network:connections" },
];

// RFQ Hub and its historical URLs remain private, directly addressable
// workflows, but no longer create a second navigation bar.
const marketplaceNav: NavItem[] = [
  { href: appRoutes.marketplace.home, label: "Opportunità", contextKey: "marketplace:opportunities" },
  { href: appRoutes.marketplace.myRequests, label: "Le mie pubblicazioni", contextKey: "marketplace:requests" },
  { href: appRoutes.marketplace.responses, label: "Risposte Marketplace", contextKey: "marketplace:responses" },
  { href: appRoutes.marketplace.notifications, label: "Notifiche", contextKey: "marketplace:notifications" },
];

const knowledgeNav: NavItem[] = [
  { href: appRoutes.knowledge.workspace, label: "Scuola", contextKey: "knowledge:home" },
  { href: appRoutes.knowledge.professor, label: "Professore", contextKey: "knowledge:professor" },
  { href: appRoutes.knowledge.schoolStandards, label: "Norme", contextKey: "knowledge:standards" },
  { href: appRoutes.knowledge.schoolGrades, label: "Materiali", contextKey: "knowledge:grades" },
  { href: appRoutes.knowledge.guides, label: "Guide", contextKey: "knowledge:guides" },
];

function roleLabel(role: string) {
  if (role === "admin") return "Amministratore azienda";
  if (role === "viewer") return "Sola lettura";
  return "Membro";
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

function workspaceOrganizationLabel(name: string) {
  return /^Steel Sales AI workspace [a-z0-9-]+$/i.test(name.trim())
    ? "Smart Steel Sales · Workspace"
    : name;
}

export function AppShell({
  children,
  viewerLabel,
  organizationName,
  organizationRole,
  demoMode,
  notificationSnapshot,
  notificationVerifiedAt,
  organizationId,
  platformConsoleAccess,
  guidedSetupComplete,
  networkEnabled,
  networkEntitled,
  networkFreeEnabled,
}: {
  children: ReactNode;
  viewerLabel: string;
  organizationName: string;
  organizationRole: string;
  demoMode: boolean;
  notificationSnapshot: WorkspaceNotificationSnapshot | null;
  notificationVerifiedAt: string | null;
  organizationId: string | null;
  platformConsoleAccess: boolean;
  guidedSetupComplete: boolean;
  networkEnabled: boolean;
  networkEntitled: boolean;
  networkFreeEnabled: boolean;
}) {
  const commercialItems = visibleItems(commercialNav, organizationRole);
  const networkItems =
    networkEnabled && networkEntitled ? visibleItems(networkNav, organizationRole)
    : networkEnabled && networkFreeEnabled ? visibleItems(networkNav, organizationRole)
    : [];
  const marketplaceItems = networkEnabled ? visibleItems(marketplaceNav, organizationRole) : [];
  const knowledgeItems = visibleItems(knowledgeNav, organizationRole);
  const canAdmin = canAdministerCompany(organizationRole);
  const effectiveRole = demoMode ? "Modalità demo" : roleLabel(organizationRole);
  const organizationLabel = workspaceOrganizationLabel(organizationName);

  return (
    <><HeaderMenuDismissController /><div className="min-h-screen bg-[#f2f4f3] pb-[calc(5rem+env(safe-area-inset-bottom))] text-[#1d2824] lg:pb-0">
      <a href="#main-content" className="skip-link">
        Vai al contenuto principale
      </a>
      <header className="sticky top-0 z-40 border-b border-[#dce2df] bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-3 sm:px-5 lg:px-8">
          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            <ProductBrand href={appRoutes.home} compact />
            {platformConsoleAccess ? (
              <ContextSwitchLink
                href={appRoutes.platform.home}
                label="Console piattaforma"
                compact
              />
            ) : null}
          </div>

          <div className="lg:hidden">
            <WorkspaceProfileMenu
              viewerLabel={viewerLabel}
              organizationName={organizationLabel}
              organizationRoleLabel={effectiveRole}
              guidedSetupComplete={guidedSetupComplete}
              canAdmin={canAdmin}
              logoutAction={logout}
            />
          </div>

          <WorkspaceSearchBar />

          <div className="ml-auto hidden h-full lg:flex">
            <WorkspaceDesktopPrimaryNavigation
              networkEnabled={networkEnabled}
              networkEntitled={networkEntitled || networkFreeEnabled}
            />
          </div>

          <div className="ml-auto flex items-center gap-1 lg:ml-2">
            {platformConsoleAccess ? (
              <div className="lg:hidden">
                <ContextSwitchLink
                  href={appRoutes.platform.home}
                  label="Console"
                  compact
                />
              </div>
            ) : null}
            <WorkspaceNotificationBell key={organizationId ?? "demo"} organizationId={organizationId} initialVerifiedAt={notificationVerifiedAt} snapshot={notificationSnapshot} demoMode={demoMode} />
            <div className="hidden lg:block">
              <WorkspaceProfileMenu
                viewerLabel={viewerLabel}
                organizationName={organizationLabel}
                organizationRoleLabel={effectiveRole}
                guidedSetupComplete={guidedSetupComplete}
                canAdmin={canAdmin}
                logoutAction={logout}
              />
            </div>
          </div>
        </div>

        <WorkspaceContextNavigation
          commercialItems={commercialItems}
          networkItems={networkItems}
          marketplaceItems={marketplaceItems}
          knowledgeItems={knowledgeItems}
        />
      </header>

      <main id="main-content" tabIndex={-1} className="mvp-focus-shell mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <WorkspaceCommercialDirectorShell>{children}</WorkspaceCommercialDirectorShell>
      </main>

      <WorkspaceMobileBottomNavigation
        networkEnabled={networkEnabled}
        networkEntitled={networkEntitled || networkFreeEnabled}
      />
    </div></>
  );
}
