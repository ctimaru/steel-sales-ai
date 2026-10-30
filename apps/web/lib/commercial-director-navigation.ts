import { appRoutes } from "@/lib/routes";

/**
 * Commercial IA follows the sales director's work: control the day, advance
 * negotiations, manage counterparties, interpret signals, access instruments.
 * Navigation only: no new authorizations, data queries or RFQ implementation.
 */
export const commercialDirectorGroups = [
  {
    key: "desk",
    label: "La mia scrivania",
    description: "Situazione e priorità",
    items: [
      { label: "Cruscotto", href: appRoutes.commercial.home },
      { label: "Cosa richiede attenzione", href: appRoutes.commercial.home + "#commercial-today" },
      { label: "Le mie trattative", href: appRoutes.commercial.home + "#commercial-worklist" },
    ],
  },
  {
    key: "deals",
    label: "Trattative e acquisti",
    description: "Dal materiale all'ordine",
    items: [
      { label: "Centro RFQ", href: appRoutes.rfqHub.home },
      { label: "Inbox operativa", href: appRoutes.rfqHub.inbox },
      { label: "Richieste ricevute", href: appRoutes.commercial.home + "?view=received#commercial-worklist" },
      { label: "RFQ ai fornitori", href: appRoutes.commercial.home + "?view=sent#commercial-worklist" },
      { label: "Offerte", href: appRoutes.commercial.home + "?view=offers#commercial-worklist" },
      { label: "Ordini", href: appRoutes.commercial.home + "?view=orders#commercial-worklist" },
      { label: "Distinte salvate", href: appRoutes.rfqHub.savedDistinte },
    ],
  },
  {
    key: "accounts",
    label: "Clienti e fornitori",
    description: "Portafoglio e relazioni",
    items: [
      { label: "Aziende", href: appRoutes.commercial.companies },
      { label: "Fornitori RFQ", href: appRoutes.rfqHub.suppliers },
      { label: "Riattivazione clienti", href: appRoutes.commercial.reengagement },
      { label: "Relazioni collegate", href: appRoutes.commercial.crossThreadRelationships },
    ],
  },
  {
    key: "insights",
    label: "Analisi e opportunità",
    description: "Decisioni basate sui dati",
    items: [
      { label: "Analisi commerciale", href: appRoutes.commercial.analysis },
      { label: "Segnali di domanda", href: appRoutes.commercial.demand },
      { label: "Prezzi", href: appRoutes.commercial.priceIntelligence },
      { label: "Mercato", href: appRoutes.commercial.marketIntelligence },
      { label: "Conversione", href: appRoutes.commercial.conversion },
    ],
  },
  {
    key: "tools",
    label: "Strumenti e memoria",
    description: "Ricerca, AI e calcoli",
    items: [
      { label: "Calcolatrice pesi", href: appRoutes.commercial.home + "#commercial-tool-access" },
      { label: "Ricerca nello storico", href: appRoutes.commercial.search },
      { label: "Assistente AI privato", href: appRoutes.commercial.assistant },
      { label: "Memoria documentale", href: appRoutes.commercial.knowledgeExplorer },
      { label: "Prodotti", href: appRoutes.commercial.products },
    ],
  },
] as const;

export type CommercialDirectorGroup = (typeof commercialDirectorGroups)[number];

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
  if (isPath("/commercial/offers") || isPath("/offers")) {
    return path === appRoutes.commercial.home && expectedView === "offers";
  }
  if (isPath("/commercial/orders") || isPath("/orders")) {
    return path === appRoutes.commercial.home && expectedView === "orders";
  }
  if (isPath("/commercial/rfqs") || isPath("/rfqs")) {
    return path === appRoutes.rfqHub.home;
  }
  if (isPath("/commercial/conversations") || isPath("/conversations")) {
    return path === appRoutes.rfqHub.inbox;
  }

  if (pathname === appRoutes.commercial.home && path === pathname) {
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
