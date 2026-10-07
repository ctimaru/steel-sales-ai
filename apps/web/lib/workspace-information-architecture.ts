import { appRoutes, legacyRoutes } from "@/lib/routes";

export type WorkspacePrimarySpace =
  | "home"
  | "commercial"
  | "network"
  | "marketplace"
  | "knowledge";

export type WorkspaceContextKey =
  | "commercial:home"
  | "commercial:search"
  | "commercial:products"
  | "commercial:companies"
  | "commercial:assistant"
  | "commercial:intelligence:explorer"
  | "commercial:intelligence:prices"
  | "commercial:intelligence:market"
  | "commercial:intelligence:reengagement"
  | "commercial:intelligence:demand"
  | "commercial:intelligence:conversion"
  | "commercial:intelligence:relationships"
  | "network:directory"
  | "network:saved"
  | "network:following"
  | "network:activity"
  | "network:inquiries"
  | "marketplace:opportunities"
  | "marketplace:inbox"
  | "marketplace:suppliers"
  | "marketplace:intelligence"
  | "marketplace:rfq-hub"
  | "marketplace:notifications"
  | "marketplace:requests"
  | "marketplace:responses"
  | "marketplace:new"
  | "knowledge:home"
  | "knowledge:explorer"
  | "knowledge:catalog"
  | "knowledge:standards"
  | "knowledge:grades"
  | "knowledge:tubes";

export type WorkspaceNavigationContext = {
  primary: WorkspacePrimarySpace;
  context: WorkspaceContextKey | null;
};

function isPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function isAnyPath(pathname: string, hrefs: string[]) {
  return hrefs.some((href) => isPath(pathname, href));
}

function marketplaceContext(pathname: string): WorkspaceContextKey {
  if (isPath(pathname, appRoutes.marketplace.procurementInbox)) {
    return "marketplace:inbox";
  }
  if (isPath(pathname, appRoutes.marketplace.suppliers)) {
    return "marketplace:suppliers";
  }
  if (isPath(pathname, appRoutes.marketplace.procurementIntelligence)) {
    return "marketplace:intelligence";
  }
  if (isPath(pathname, appRoutes.marketplace.rfqHub)) {
    return "marketplace:rfq-hub";
  }
  if (isPath(pathname, appRoutes.marketplace.notifications)) {
    return "marketplace:notifications";
  }
  if (isPath(pathname, appRoutes.marketplace.responses)) {
    return "marketplace:responses";
  }
  if (isPath(pathname, appRoutes.marketplace.newRequest)) {
    return "marketplace:new";
  }
  if (isPath(pathname, "/marketplace/opportunities")) {
    return "marketplace:opportunities";
  }
  if (isPath(pathname, appRoutes.marketplace.myRequests)) {
    return "marketplace:requests";
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "marketplace" && segments.length === 2) {
    return "marketplace:requests";
  }

  return "marketplace:opportunities";
}

function networkContext(pathname: string): WorkspaceContextKey {
  if (isPath(pathname, appRoutes.network.saved)) return "network:saved";
  if (isPath(pathname, appRoutes.network.following)) return "network:following";
  if (isPath(pathname, appRoutes.network.activity)) return "network:activity";
  if (isPath(pathname, appRoutes.network.inquiries)) return "network:inquiries";
  return "network:directory";
}

function knowledgeContext(pathname: string): WorkspaceContextKey {
  if (
    isAnyPath(pathname, [
      appRoutes.knowledge.explorer,
      legacyRoutes.knowledgeExplorer,
    ])
  ) {
    return "knowledge:explorer";
  }
  if (isPath(pathname, appRoutes.knowledge.catalog)) return "knowledge:catalog";
  if (isPath(pathname, appRoutes.knowledge.schoolStandards)) return "knowledge:standards";
  if (isPath(pathname, appRoutes.knowledge.schoolGrades)) return "knowledge:grades";
  if (isPath(pathname, appRoutes.knowledge.schoolTubes)) return "knowledge:tubes";
  return "knowledge:home";
}

function commercialContext(pathname: string): WorkspaceContextKey {
  if (
    isAnyPath(pathname, [
      appRoutes.commercial.search,
      legacyRoutes.search,
      "/commercial/rfqs",
      "/commercial/offers",
      "/commercial/orders",
      "/commercial/conversations",
      "/rfqs",
      "/offers",
      "/orders",
      "/conversations",
    ])
  ) {
    return "commercial:search";
  }
  if (isAnyPath(pathname, [appRoutes.commercial.products, legacyRoutes.products])) {
    return "commercial:products";
  }
  if (isAnyPath(pathname, [appRoutes.commercial.companies, legacyRoutes.customers])) {
    return "commercial:companies";
  }
  if (isAnyPath(pathname, [appRoutes.commercial.assistant, legacyRoutes.assistant])) {
    return "commercial:assistant";
  }
  if (isAnyPath(pathname, [appRoutes.commercial.explorer, legacyRoutes.explorer])) {
    return "commercial:intelligence:explorer";
  }
  if (isAnyPath(pathname, [appRoutes.commercial.priceIntelligence, legacyRoutes.priceIntelligence])) {
    return "commercial:intelligence:prices";
  }
  if (isAnyPath(pathname, [appRoutes.commercial.marketIntelligence, legacyRoutes.marketIntelligence])) {
    return "commercial:intelligence:market";
  }
  if (isPath(pathname, appRoutes.commercial.crossThreadRelationships)) {
    return "commercial:intelligence:relationships";
  }
  if (isPath(pathname, appRoutes.commercial.reengagement)) {
    return "commercial:intelligence:reengagement";
  }
  if (isPath(pathname, appRoutes.commercial.demand)) {
    return "commercial:intelligence:demand";
  }
  if (isPath(pathname, appRoutes.commercial.conversion)) {
    return "commercial:intelligence:conversion";
  }
  return "commercial:home";
}

export function getWorkspaceNavigationContext(
  pathname: string,
): WorkspaceNavigationContext {
  if (isPath(pathname, appRoutes.network.directory)) {
    return { primary: "network", context: networkContext(pathname) };
  }

  if (isPath(pathname, appRoutes.marketplace.home)) {
    return {
      primary: "marketplace",
      context: marketplaceContext(pathname),
    };
  }

  if (
    isAnyPath(pathname, [
      appRoutes.knowledge.workspace,
      appRoutes.knowledge.explorer,
      legacyRoutes.knowledgeExplorer,
    ])
  ) {
    return { primary: "knowledge", context: knowledgeContext(pathname) };
  }

  if (
    isAnyPath(pathname, [
      appRoutes.commercial.home,
      legacyRoutes.search,
      legacyRoutes.products,
      legacyRoutes.customers,
      legacyRoutes.assistant,
      legacyRoutes.explorer,
      legacyRoutes.priceIntelligence,
      legacyRoutes.marketIntelligence,
      "/rfqs",
      "/offers",
      "/orders",
      "/conversations",
    ])
  ) {
    return { primary: "commercial", context: commercialContext(pathname) };
  }

  return { primary: "home", context: null };
}
