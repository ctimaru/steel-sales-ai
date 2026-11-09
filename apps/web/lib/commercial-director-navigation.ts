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
    key: "desk",
    label: "Scrivania",
    description: "Situazione e prossime azioni",
    items: [
      { label: "Scrivania", href: appRoutes.commercial.home },
    ],
    moreItems: [],
  },
  {
    // Direzione Aziendale assegna i profili. Ogni ufficio vede anche l'altro:
    // il profilo decide dove si può scrivere, non cosa si può consultare.
    key: "direction",
    label: "Direzione aziendale",
    description: "Uffici e profili",
    items: [
      { label: "Team e profili", href: appRoutes.company.team, adminOnly: true },
    ],
    moreItems: [],
    sections: [
      {
        key: "commercial",
        label: "Ufficio commerciale",
        items: [
          // Filter links stay inside the Commerciale worklist, not duplicated in the sidebar.
          { label: "Trattative", href: appRoutes.commercial.home + "?view=all#commercial-worklist" },
          { label: "Aziende", href: appRoutes.commercial.companies },
          { label: "Riattivazione clienti", href: appRoutes.commercial.reengagement },
          { label: "Relazioni collegate", href: appRoutes.commercial.crossThreadRelationships },
        ],
      },
      {
        key: "purchasing",
        label: "Ufficio acquisti",
        items: [
          { label: "Centro RFQ", href: appRoutes.rfqHub.home },
          { label: "Inbox e risposte", href: appRoutes.rfqHub.inbox },
          { label: "Fornitori RFQ", href: appRoutes.rfqHub.suppliers },
          { label: "Distinte", href: appRoutes.rfqHub.savedDistinte },
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
      { label: "Calcolatrice pesi", href: appRoutes.commercial.home + "#commercial-tool-access" },
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
