import { appRoutes } from "@/lib/routes";

/**
 * Commercial IA follows the sales director's work: control the day, advance
 * negotiations, manage counterparties, interpret signals, access instruments.
 * Navigation only: no new authorizations, data queries or RFQ implementation.
 */
export type CommercialDirectorItem = {
  label: string;
  href: string;
  /** Visibile solo alla Direzione Aziendale (amministratori). */
  adminOnly?: boolean;
  /** Number of things to do, loaded on the client (RFQHUB1, COMM-CLIENTS1). */
  counter?: "purchasing_attention" | "sales_attention";
};
export type CommercialDirectorSection = {
  key: "commercial" | "purchasing";
  label: string;
  items: readonly CommercialDirectorItem[];
};
export type CommercialDirectorGroup = {
  key: string;
  label: string;
  description: string;
  items: readonly CommercialDirectorItem[];
  moreItems: readonly CommercialDirectorItem[];
  /** Sotto-aree con intestazione: usate da Direzione Aziendale per i due uffici. */
  sections?: readonly CommercialDirectorSection[];
};

export const commercialDirectorGroups: readonly CommercialDirectorGroup[] = [
  {
    // Direzione Aziendale assegna i profili. Ogni ufficio vede anche l'altro:
    // il profilo decide dove si può scrivere, non cosa si può consultare.
    key: "direction",
    label: "Direzione aziendale",
    description: "Uffici e profili",
    items: [
      // DIR-DESK1 (25 nov 2026): la Scrivania della Direzione è la prima voce.
      { label: "Scrivania della Direzione", href: appRoutes.commercial.direction, adminOnly: true },
      { label: "Team e profili", href: appRoutes.company.team, adminOnly: true },
    ],
    moreItems: [],
    sections: [
      {
        key: "commercial",
        label: "Ufficio commerciale",
        items: [
          // COMM-CLIENTS1 (19 Nov 2026): the office mirrors Ufficio acquisti
          // (Centro RFQ + Fornitori). «Scrivania» is gone: Commerciale opens on
          // Richieste d'offerta. Riattivazione clienti and Relazioni collegate
          // stay reachable from Analisi commerciale.
          { label: "Richieste d'offerta", href: appRoutes.commercial.home, counter: "sales_attention" },
          { label: "Clienti", href: appRoutes.commercial.companies },
        ],
      },
      {
        key: "purchasing",
        label: "Ufficio acquisti",
        items: [
          // RFQHUB1 (18 Nov 2026): Distinte and «Da gestire» live inside Centro RFQ.
          { label: "Centro RFQ", href: appRoutes.rfqHub.home, counter: "purchasing_attention" },
          { label: "Fornitori RFQ", href: appRoutes.rfqHub.suppliers },
        ],
      },
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
      { label: "Calcolatrice pesi", href: appRoutes.commercial.home + "?tools=1#commercial-tool-access" },
      { label: "Ricerca nello storico", href: appRoutes.commercial.search },
    ],
    moreItems: [
      { label: "Assistente AI privato", href: appRoutes.commercial.assistant },
      { label: "Memoria documentale", href: appRoutes.commercial.knowledgeExplorer },
      { label: "Prodotti", href: appRoutes.commercial.products },
    ],
  },
];

// Secondary destinations remain reachable without taking space in the default menu.
export function commercialDirectorAllItems(group: CommercialDirectorGroup) {
  return [
    ...group.items,
    ...(group.sections ?? []).flatMap(section => section.items),
    ...group.moreItems,
  ];
}

/**
 * Preserve canonical deep links. Every screen of /commercial (any ?view=, the
 * Network prospect screens) and the sales documents (RDO, offers, orders)
 * belong to «Richieste d'offerta»; campaigns and conversations to Centro RFQ.
 */
export function commercialDirectorLinkSelected(
  href: string,
  pathname: string,
  // Kept for callers: worklist filters no longer change the selected item.
  _view: string | null,
): boolean {
  const [pathWithQuery] = href.split("#");
  const [path] = pathWithQuery.split("?");
  const isPath = (base: string) => pathname === base || pathname.startsWith(base + "/");

  const salesDocument = ["/commercial/offers", "/offers", "/commercial/orders", "/orders", "/commercial/rfqs", "/rfqs"]
    .some(isPath);
  if (salesDocument || pathname === appRoutes.commercial.home) {
    // Only the list itself: shortcuts such as «Calcolatrice pesi» (?tools=1)
    // open a panel on the same page and are never the current location.
    return href === appRoutes.commercial.home;
  }
  if (isPath("/commercial/conversations") || isPath("/conversations")) {
    return path === appRoutes.rfqHub.home;
  }
  if (path === appRoutes.commercial.home) return false;

  // A campaign, a Distinta (new or saved) and «Da gestire» belong to Centro
  // RFQ. Suppliers have their own item: never highlight both.
  if (path === appRoutes.rfqHub.home) {
    return isPath(path) && ![appRoutes.rfqHub.suppliers].some(isPath);
  }

  return isPath(path);
}
