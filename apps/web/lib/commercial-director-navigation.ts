import { appRoutes } from "@/lib/routes";

/**
 * Commercial IA follows the sales director's work: control the day, advance
 * negotiations, manage counterparties, interpret signals, access instruments.
 * Navigation only: no new authorizations, data queries or RFQ implementation.
 */
export const commercialDirectorGroups = [
  {
    key: "desk",
    label: "Scrivania",
    description: "Situazione e prossime azioni",
    items: [
      { label: "Scrivania", href: appRoutes.commercial.home },
    ],
    moreItems: [],
  },
  {
    key: "deals",
    label: "Trattative e RFQ",
    description: "Richieste, offerte e ordini",
    items: [
      // Filter links stay inside the Commerciale worklist, not duplicated in the sidebar.
      { label: "Trattative", href: appRoutes.commercial.home + "?view=all#commercial-worklist" },
      { label: "Centro RFQ", href: appRoutes.rfqHub.home },
      { label: "Inbox e risposte", href: appRoutes.rfqHub.inbox },
      { label: "Distinte", href: appRoutes.rfqHub.savedDistinte },
    ],
    moreItems: [],
  },
  {
    key: "accounts",
    label: "Aziende",
    description: "Clienti e fornitori",
    items: [
      { label: "Aziende", href: appRoutes.commercial.companies },
      { label: "Fornitori RFQ", href: appRoutes.rfqHub.suppliers },
    ],
    moreItems: [
      { label: "Riattivazione clienti", href: appRoutes.commercial.reengagement },
      { label: "Relazioni collegate", href: appRoutes.commercial.crossThreadRelationships },
    ],
  },
  {
    key: "insights",
    label: "Analisi",
    description: "Dati e opportunità",
    items: [
      { label: "Analisi commerciale", href: appRoutes.commercial.analysis },
      { label: "Prezzi", href: appRoutes.commercial.priceIntelligence },
    ],
    moreItems: [
      { label: "Segnali di domanda", href: appRoutes.commercial.demand },
      { label: "Mercato", href: appRoutes.commercial.marketIntelligence },
      { label: "Conversione", href: appRoutes.commercial.conversion },
    ],
  },
  {
    key: "tools",
    label: "Strumenti",
    description: "Ricerca, AI e calcoli",
    items: [
      { label: "Calcolatrice pesi", href: appRoutes.commercial.home + "#commercial-tool-access" },
      { label: "Ricerca nello storico", href: appRoutes.commercial.search },
    ],
    moreItems: [
      { label: "Assistente AI privato", href: appRoutes.commercial.assistant },
      { label: "Memoria documentale", href: appRoutes.commercial.knowledgeExplorer },
      { label: "Prodotti", href: appRoutes.commercial.products },
    ],
  },
] as const;

export type CommercialDirectorGroup = (typeof commercialDirectorGroups)[number];

// Secondary destinations remain reachable without taking space in the default menu.
export function commercialDirectorAllItems(group: CommercialDirectorGroup) {
  return [...group.items, ...group.moreItems];
}

/**
 * Preserve canonical deep links. For filtered worklists only the explicit
 * ?view=... item is selected; anchors are shortcuts to the same homepage.
 */
export function commercialDirectorLinkSelected(
  href: string,
  pathname: string,
  view: string | null,
): boolean {
  const [pathWithQuery] = href.split("#");
  const [path, search] = pathWithQuery.split("?");
  const expectedView = new URLSearchParams(search ?? "").get("view");
  const isPath = (base: string) => pathname === base || pathname.startsWith(base + "/");

  // Deal detail pages and legacy bookmarks must retain the correct director
  // context. Their URLs don't carry the homepage ?view filter.
  const worklistLink = path === appRoutes.commercial.home
    && expectedView === "all" && href.endsWith("#commercial-worklist");
  if (isPath("/commercial/offers") || isPath("/offers")) {
    return worklistLink;
  }
  if (isPath("/commercial/orders") || isPath("/orders")) {
    return worklistLink;
  }
  if (isPath("/commercial/rfqs") || isPath("/rfqs")) {
    return path === appRoutes.rfqHub.home;
  }
  if (isPath("/commercial/conversations") || isPath("/conversations")) {
    return path === appRoutes.rfqHub.inbox;
  }

  if (pathname === appRoutes.commercial.home && path === pathname) {
    // All worklist filters (received/sent/offers/orders/drafts) share one item.
    // Existing ?view= URLs are unchanged and remain directly bookmarkable.
    if (worklistLink) {
      return view !== null && ["all", "received", "sent", "offers", "orders", "drafts"].includes(view);
    }
    if (expectedView !== null) return expectedView === view;
    return view === null && !href.includes("#");
  }
  if (path === appRoutes.commercial.home) return false;

  // A campaign, intelligence view or new Distinta belongs to Centro RFQ.
  // Inbox, suppliers and saved Distinte have their own more specific item:
  // never highlight both the parent and a child destination.
  if (path === appRoutes.rfqHub.home) {
    return isPath(path) && ![
      appRoutes.rfqHub.inbox,
      appRoutes.rfqHub.suppliers,
      appRoutes.rfqHub.savedDistinte,
    ].some(isPath);
  }

  return isPath(path);
}
