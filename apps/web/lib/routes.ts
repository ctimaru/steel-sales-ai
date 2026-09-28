export const appRoutes = {
  home: "/dashboard",
  publicHome: "/",

  commercial: {
    search: "/commercial/search",
    products: "/commercial/products",
    product: (productId: string) => `/commercial/products/${productId}`,
    productPrices: (productId: string) => `/commercial/products/${productId}/prices`,
    companies: "/commercial/companies",
    company: (companyId: string) => `/commercial/companies/${companyId}`,
    reengagement: "/commercial/reengagement",
    demand: "/commercial/demand",
    conversion: "/commercial/conversion",
    crossThreadRelationships: "/commercial/conversion/relationships",
    assistant: "/commercial/assistant",
    explorer: "/explorer",
    priceIntelligence: "/price-intelligence",
    marketIntelligence: "/market-intelligence",
    knowledgeExplorer: "/knowledge-explorer",
    rfq: (id: string) => `/commercial/rfqs/${id}`,
    offer: (id: string) => `/commercial/offers/${id}`,
    order: (id: string) => `/commercial/orders/${id}`,
    conversation: (id: string) => `/commercial/conversations/${id}`,
  },

  network: {
    directory: "/network",
    saved: "/network/saved",
    following: "/network/following",
    activity: "/network/activity",
    inquiries: "/network/inquiries",
    manage: "/company/profile",
  },

  marketplace: {
    home: "/marketplace",
  },

  knowledge: {
    home: "/knowledge",
    standards: "/knowledge/norme",
    standard: (slug: string) => `/knowledge/norme/${slug}`,
    grades: "/knowledge/gradi",
    grade: (slug: string) => `/knowledge/gradi/${slug}`,
    tubes: "/knowledge/tubes",
    tubeFamily: (family: string) => `/knowledge/tubes/${family}`,
    tubeSizeHub: (family: string, size: string) => `/knowledge/tubes/${family}/${size}`,
    tubeDimension: (slug: string) => `/knowledge/tubes/${slug}`,
  },

  operations: {
    uploads: "/operations/uploads",
    review: "/operations/review",
    reviewConversationCoverage: "/operations/review/conversation-coverage",
    reviewConversations: "/operations/review/conversations",
    reviewCoverage: "/operations/review/coverage",
    reviewIdentities: "/operations/review/identities",
    reviewOfferRecovery: "/operations/review/offer-recovery",
    reviewOfferRemediation: "/operations/review/offer-remediation",
    reviewOfferReparse: "/operations/review/offer-reparse",
    reviewRelationships: "/operations/review/relationships",
    reviewUnconvertedOffers: "/operations/review/unconverted-offers",
    alerts: "/operations/alerts",
  },

  company: {
    profile: "/company/profile",
    dataSources: "/company/data-sources",
    pilotAnalytics: "/company/pilot-analytics",
    tools: "/company/tools",
    tubesStandards: "/company/tools/tubi-norme",
  },

  platform: {
    home: "/platform",
    registrations: "/platform/registrations",
    registration: (id: string) => `/platform/registrations/${id}`,
    knowledge: "/platform/knowledge",
    knowledgePage: (type: "standard" | "grade", id: string) =>
      `/platform/knowledge/${type}/${id}`,
    networkTrust: "/platform/network-trust",
  },
} as const;

export const legacyRoutes = {
  search: "/search",
  products: "/products",
  customers: "/customers",
  assistant: "/assistant",
  uploads: "/uploads",
  review: "/review",
  alerts: "/alerts",
  dataSources: "/data-sources",
  pilotAnalytics: "/pilot-analytics",
  tubesStandards: "/tubi-norme",
} as const;
