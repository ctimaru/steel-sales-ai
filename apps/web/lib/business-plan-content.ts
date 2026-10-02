export const BUSINESS_PLAN_VERSION = "Investor Draft 1.0";

export const businessPlanSnapshot = {
  stage: "Product-ready web SaaS",
  currentFocus: "Target market sizing & economic opportunity",
  launchWindow: "2027 controlled launch",
  thesis:
    "Smart Steel Sales aims to become the business network layer for the steel and tube industry: a free professional network strengthened by commercial memory, marketplace activity, AI and industry intelligence, with monetization that scales with users and usage rather than sales headcount.",
} as const;

export const businessPlanHighlights = {
  eyebrow: "Smart Steel Sales · Investor Highlights",
  headline: "The business network for the steel industry.",
  subheadline:
    "A free professional network for steel and tube companies, strengthened by Commercial Memory, Marketplace activity, AI and industry intelligence — monetized through multiple low-friction income streams.",
  oneLine:
    "SSS aims to become the digital business graph where steel companies discover each other, manage commercial knowledge, exchange demand and create measurable professional activity.",
  highlightCards: [
    {
      metric: "Free",
      label: "network-first entry",
      detail: "Useful core access stays free to maximize company density, users and repeat usage.",
    },
    {
      metric: "5",
      label: "income streams",
      detail: "Modules, Marketplace premium, sponsored visibility, intelligence and API/enterprise.",
    },
    {
      metric: "€15–€49",
      label: "working SME paid range",
      detail: "Low-impact self-service pricing keeps monetization compatible with product-led adoption.",
    },
    {
      metric: "MAO + MAU",
      label: "investor north stars",
      detail: "Company and user activity matter alongside revenue because network density is the core asset.",
    },
  ],
  investorHook:
    "The investable asset is not a high-priced software contract. It is a growing industry network that concentrates verified companies, professional attention, commercial workflows and transaction intent.",
} as const;

export const businessPlanTimeline = [
  {
    phase: "NOW",
    title: "Foundation built",
    status: "Product",
    description:
      "Private Commercial Memory, company graph, Marketplace foundations, Scuola acquisition layer, role-aware workspace and governed investor room are already integrated into one product architecture.",
    signal:
      "From isolated SaaS features to one connected industry platform.",
  },
  {
    phase: "LAUNCH 2027",
    title: "Italy-first network activation",
    status: "Distribution",
    description:
      "Use Scuola/SEO, company pages, profile claims and the Free Base to activate steel/tube distributors first, then producers, processors and industrial users.",
    signal:
      "Verified organizations + MAO + repeat usage before aggressive monetization.",
  },
  {
    phase: "DENSITY",
    title: "Product-led monetization",
    status: "Revenue",
    description:
      "Contextual Memory+, AI+, Team+ and SSS Plus upgrades convert a small share of activated organizations without mandatory sales intervention.",
    signal:
      "Self-service paid attach + 60/90-day retention.",
  },
  {
    phase: "LIQUIDITY",
    title: "Marketplace becomes a network engine",
    status: "Usage",
    description:
      "As cross-company demand and supplier response become repeatable, premium Marketplace actions can monetize transaction value while core participation remains free.",
    signal:
      "Relevant supplier response + recurring demand activity.",
  },
  {
    phase: "EUROPE",
    title: "Cross-border steel graph",
    status: "Scale",
    description:
      "Expand the same verified company graph, content, workflows and network mechanics across European steel distribution and production markets.",
    signal:
      "More organizations increase discovery, data density and cross-border utility.",
  },
  {
    phase: "NETWORK SCALE",
    title: "Multi-stream industry infrastructure",
    status: "Platform",
    description:
      "Modules, Marketplace, sponsored professional visibility, aggregated intelligence and API/enterprise revenue compound on the same distribution asset.",
    signal:
      "Revenue / MAO grows without requiring high SME subscription prices.",
  },
] as const;

export const businessPlanGeneralHighlights = [
  {
    title: "Beachhead",
    value: "Italian steel/tube distributors & stockholders",
    detail:
      "High-frequency commercial workflows, fragmented knowledge and strong network connectivity make distribution the first activation wedge.",
  },
  {
    title: "Positioning",
    value: "Network + commercial operating layer",
    detail:
      "SSS complements ERP and email rather than asking companies to replace their operational systems.",
  },
  {
    title: "Distribution",
    value: "Scuola → Company Graph → Network → Marketplace",
    detail:
      "Public technical utility and searchable company identity feed organic discovery into the professional network.",
  },
  {
    title: "Monetization",
    value: "Low friction, multi-stream",
    detail:
      "Free network utility first; optional modules and later network monetization expand revenue after value and density exist.",
  },
  {
    title: "Trust",
    value: "Private memory stays private",
    detail:
      "Commercial Memory is tenant-private and never sold. Intelligence uses only aggregated/anonymized or explicitly permissioned information.",
  },
  {
    title: "Investor lens",
    value: "Users + usage + revenue density",
    detail:
      "Verified organizations, MAO, MAU, interactions, retention, liquidity and revenue/MAO measure whether the network is compounding.",
  },
] as const;

export const productPillars = [
  {
    key: "commercial-memory",
    title: "Commercial Memory",
    label: "Private system of record",
    description:
      "Turns fragmented email, RFQs, offers, orders, contacts and price history into reusable company intelligence.",
    value:
      "Less time searching for old commercial information; faster quoting, follow-up and account reactivation.",
  },
  {
    key: "network",
    title: "Steel Industry Network",
    label: "Trusted discovery layer",
    description:
      "Claimable company profiles, industrial taxonomy, relationships, follows, trust and identity governance.",
    value:
      "A structured map of who produces, trades, processes and buys steel and tubes.",
  },
  {
    key: "marketplace",
    title: "Marketplace",
    label: "Demand activation layer",
    description:
      "Structured buyer demand matched to relevant suppliers with governed unlock and response flows.",
    value:
      "Transforms latent demand into measurable commercial opportunities without exposing private tenant data.",
  },
  {
    key: "school",
    title: "Scuola",
    label: "Public technical acquisition layer",
    description:
      "Open standards, grades, tube dimensions, calculators and technical content designed for search discovery.",
    value:
      "Builds authority and organic acquisition while keeping public knowledge separate from private commercial memory.",
  },
] as const;

export const marketEvidence = [
  {
    metric: "144",
    label: "ASSOFERMET Acciai member companies",
    detail:
      "ASSOFERMET states that its steel-distribution members represent about 80% of Italian steel distribution.",
    implication:
      "The Italian distribution beachhead is concentrated enough for account-based GTM and association-led discovery.",
    source: "ASSOFERMET Acciai",
    sourceUrl: "https://www.assofermet.it/settore-acciai",
  },
  {
    metric: ">160k",
    label: "downstream customer companies served",
    detail:
      "ASSOFERMET's industry brochure describes the distribution sector as serving more than 160,000 customer companies across Italian industry.",
    implication:
      "Distributors sit at a high-connectivity point in the value chain and can seed both buyer and supplier network effects.",
    source: "ASSOFERMET industry brochure",
    sourceUrl:
      "https://www.assofermet.it/source/Brochure/brochure_assofermet.pdf",
  },
  {
    metric: "~3,500",
    label: "European distribution/intermediation companies",
    detail:
      "EUROMETAL says its associated federations represent about 3,500 companies across stockholding, service centres, processors and traders.",
    implication:
      "A distributor-first wedge has a credible European expansion path after an Italy-first launch.",
    source: "EUROMETAL",
    sourceUrl: "https://eurometal.net/membership/",
  },
  {
    metric: "130",
    label: "Federacciai member companies",
    detail:
      "Federacciai reports 130 member companies representing more than 95% of Italian steel production and transformation, with 20.7 Mt produced in 2025.",
    implication:
      "Producers form a concentrated second ICP with strong strategic value, but a more enterprise-oriented buying motion.",
    source: "Federacciai",
    sourceUrl: "https://federacciai.it/profilo-e-storia/",
  },
  {
    metric: "75.6%",
    label: "Italian enterprises buying cloud services",
    detail:
      "Eurostat reports Italy among Europe's highest-cloud-adoption markets in 2025.",
    implication:
      "Cloud delivery is not the main adoption barrier for the target geography.",
    source: "Eurostat",
    sourceUrl:
      "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260203-1",
  },
  {
    metric: "21.1%",
    label: "Italian SMEs using CRM",
    detail:
      "ISTAT reports CRM use at 21.1% among Italian SMEs in 2025, versus 48.8% for ERP.",
    implication:
      "Commercial digitisation materially lags core management-software adoption, leaving room for a focused commercial layer.",
    source: "ISTAT · Imprese e ICT 2025",
    sourceUrl:
      "https://www.istat.it/comunicato-stampa/imprese-e-ict-anno-2025/",
  },
  {
    metric: "+0.1%",
    label: "EU apparent steel consumption forecast for 2026",
    detail:
      "EUROFER's September 2026 outlook expects almost-flat EU steel demand in 2026, followed by +2.3% in 2027.",
    implication:
      "In a low-growth environment, better commercial execution, retention and account reactivation become economically relevant wedges.",
    source: "EUROFER · Q3 2026 outlook",
    sourceUrl:
      "https://ftp.eurofer.eu/publications/economic-market-outlook/economic-and-steel-market-outlook-2026-2027-third-quarter",
  },
] as const;

export const marketSizingMethodology = {
  asOf: "2 Oct 2026",
  principle:
    "Use concentric market layers instead of one inflated TAM. Association/company/site counts overlap, so core, serviceable and broad universes are shown separately and are never added together without deduplication.",
  layers: [
    "Core steel network = distributors, service centres, steel/tube producers and processors closest to the daily SSS workflow.",
    "Serviceable industrial network = metal/engineering companies with recurring steel purchasing, processing or commercial relationships.",
    "Broad discovery universe = downstream industrial companies that can derive Network, Marketplace, Scuola or intelligence value even if they never buy a paid software module.",
  ],
  caveat:
    "Membership figures measure represented companies, while production-site and downstream-user figures measure different units. They are market-structure evidence, not a deduplicated census.",
} as const;

export const targetMarketLayers = [
  {
    geography: "Italy",
    core: {
      metric: "144 + 130",
      label: "distribution + production association footprints",
      detail:
        "ASSOFERMET Acciai has 144 member companies representing about 80% of Italian steel distribution. Federacciai has 130 member companies representing more than 95% of Italian steel production and transformation. These memberships are not summed as a deduplicated company count.",
      source: "ASSOFERMET + Federacciai",
      sourceUrls: [
        "https://www.assofermet.it/settore-acciai",
        "https://federacciai.it/profilo-e-storia/",
      ],
    },
    serviceable: {
      metric: "~14,000",
      label: "Federmeccanica member companies",
      detail:
        "Federmeccanica says it associates about 14,000 Italian metalworking/mechatronics companies employing around 900,000 people. This is a useful serviceable industrial adjacency, not a steel-only count.",
      source: "Federmeccanica",
      sourceUrls: ["https://www.federmeccanica.it/chi-siamo.html"],
    },
    broad: {
      metric: ">160,000",
      label: "downstream customer companies served by steel distribution",
      detail:
        "ASSOFERMET's sector brochure says its steel-distribution members serve more than 160,000 customer companies across Italian industry.",
      source: "ASSOFERMET industry brochure",
      sourceUrls: [
        "https://www.assofermet.it/source/Brochure/brochure_assofermet.pdf",
      ],
    },
  },
  {
    geography: "Europe",
    core: {
      metric: "~3,500 + 500 sites",
      label: "distribution ecosystem + EU steel production footprint",
      detail:
        "EUROMETAL's associated federations represent about 3,500 distributors, service centres, processors and traders. EUROFER reports about 500 steel production sites across 22 EU Member States. Sites are not companies and are shown separately inside the same core footprint.",
      source: "EUROMETAL + EUROFER",
      sourceUrls: [
        "https://eurometal.net/membership/",
        "https://www.eurofer.eu/about-steel/learn-about-steel",
      ],
    },
    serviceable: {
      metric: ">200,000",
      label: "MET industry member companies",
      detail:
        "Ceemet's national federations across 20 countries represent more than 200,000 companies in metal, engineering and technology-based industries, the vast majority SMEs.",
      source: "Ceemet",
      sourceUrls: ["https://ceemet.org/about/"],
    },
    broad: {
      metric: "770,000",
      label: "European technology-industry companies",
      detail:
        "Orgalim reports 770,000 companies across mechanical engineering, electrical engineering, electronics, ICT and metal technology. This is a broad industrial expansion envelope, not a steel-specific TAM.",
      source: "Orgalim",
      sourceUrls: [
        "https://orgalim.eu/en/orgalim-at-the-european-commissions-eu-trade-policy-day-driving-competitiveness-from-the-inside/",
      ],
    },
  },
] as const;

export const marketOpportunityHighlights = [
  {
    metric: ">160k",
    label: "Italian downstream companies",
    detail:
      "Documented customer-company reach of the Italian steel-distribution ecosystem.",
    geography: "Italy",
    sourceUrl:
      "https://www.assofermet.it/source/Brochure/brochure_assofermet.pdf",
  },
  {
    metric: "17.6%",
    label: "Italy share of EU apparent steel use",
    detail:
      "23.8 Mt in Italy out of 135.2 Mt EU27 apparent steel use in 2025.",
    geography: "Italy",
    sourceUrl:
      "https://worldsteel.org/data/world-steel-in-figures/world-steel-in-figures-2026/",
  },
  {
    metric: "~3,500",
    label: "European distribution companies",
    detail:
      "EUROMETAL federation footprint across stockholders, service centres, processors and traders.",
    geography: "Europe",
    sourceUrl: "https://eurometal.net/membership/",
  },
  {
    metric: "770k",
    label: "European technology-industry companies",
    detail:
      "Broad industrial company universe represented by Orgalim across major technology and metal branches.",
    geography: "Europe",
    sourceUrl:
      "https://orgalim.eu/en/orgalim-at-the-european-commissions-eu-trade-policy-day-driving-competitiveness-from-the-inside/",
  },
] as const;

export const steelMarketEconomicContext = [
  {
    geography: "Italy",
    metric: ">€10bn",
    label: "steel-distribution turnover",
    detail:
      "ASSOFERMET's industry brochure describes more than €10 billion of turnover in the Italian steel distribution/pre-processing sector and over 13,000 employees.",
    source: "ASSOFERMET",
    sourceUrl:
      "https://www.assofermet.it/source/Brochure/brochure_assofermet.pdf",
  },
  {
    geography: "Italy",
    metric: "23.8 Mt",
    label: "apparent steel use in 2025",
    detail:
      "World Steel Association reports 23.8 Mt of apparent finished-steel use in Italy in 2025, versus 135.2 Mt for EU27 — about 17.6% of EU use.",
    source: "worldsteel · World Steel in Figures 2026",
    sourceUrl:
      "https://worldsteel.org/data/world-steel-in-figures/world-steel-in-figures-2026/",
  },
  {
    geography: "Europe",
    metric: "€215bn",
    label: "EU steel-sector turnover",
    detail:
      "EUROFER describes the EU steel sector as roughly €215 billion in turnover, with about 500 production sites and around 298,000 direct employees.",
    source: "EUROFER",
    sourceUrl: "https://www.eurofer.eu/",
  },
  {
    geography: "Europe",
    metric: "10.6 Mt",
    label: "EU tubular steel market in 2023",
    detail:
      "EUROMETAL research cited a 10.6 Mt tubular-steel market in 2023, split evenly between distributors and direct mill sales at roughly 5.3 Mt each.",
    source: "EUROMETAL",
    sourceUrl:
      "https://eurometal.net/european-distributors-lose-volume-in-2020s/",
  },
  {
    geography: "Europe",
    metric: "€2.755tn",
    label: "technology-industry annual turnover",
    detail:
      "Orgalim reports more than €2.755 trillion in annual turnover across 770,000 European technology-industry companies and 11.6 million direct jobs.",
    source: "Orgalim",
    sourceUrl:
      "https://orgalim.eu/en/orgalim-at-the-european-commissions-eu-trade-policy-day-driving-competitiveness-from-the-inside/",
  },
] as const;

export const moduleRevenueMarketEnvelope = {
  disclaimer:
    "Software-only market envelopes, not forecasts. Each case asks what annual recurring module revenue would result if 5% of the referenced organization universe paid €29/month versus 10% paying €39/month. Marketplace, sponsored visibility, intelligence and API revenue are excluded.",
  cases: [
    {
      scope: "Italy · serviceable industrial adjacency",
      organizations: "~14,000",
      basis: "Federmeccanica member companies",
      lowCase: "€244k ARR",
      highCase: "€655k ARR",
      lowAssumption: "5% paid × €29/month",
      highAssumption: "10% paid × €39/month",
    },
    {
      scope: "Italy · broad downstream universe",
      organizations: ">160,000",
      basis: "customer companies served by ASSOFERMET distribution members",
      lowCase: "€2.78m ARR",
      highCase: "€7.49m ARR",
      lowAssumption: "5% paid × €29/month",
      highAssumption: "10% paid × €39/month",
    },
    {
      scope: "Europe · serviceable MET adjacency",
      organizations: ">200,000",
      basis: "Ceemet member-company footprint",
      lowCase: "€3.48m ARR",
      highCase: "€9.36m ARR",
      lowAssumption: "5% paid × €29/month",
      highAssumption: "10% paid × €39/month",
    },
    {
      scope: "Europe · broad technology-industry envelope",
      organizations: "770,000",
      basis: "Orgalim company footprint",
      lowCase: "€13.4m ARR",
      highCase: "€36.0m ARR",
      lowAssumption: "5% paid × €29/month",
      highAssumption: "10% paid × €39/month",
    },
  ],
} as const;

export const marketPenetrationSanityChecks = [
  {
    scenario: "Italy network sensitivity",
    penetration: "6.25%",
    comparison:
      "10,000 activated organizations equals 6.25% of the >160,000 Italian downstream customer-company universe documented by ASSOFERMET.",
    economicRead:
      "The existing €533k annualized multi-stream Italy scenario is roughly 0.005% of the >€10bn steel-distribution turnover context — illustrating a very low monetization burden relative to sector economics, not a take-rate claim.",
  },
  {
    scenario: "European network sensitivity",
    penetration: "~6.5%",
    comparison:
      "50,000 activated organizations equals about 6.5% of Orgalim's 770,000-company technology-industry envelope.",
    economicRead:
      "The existing €4.61m annualized European scenario therefore does not require high subscription ARPA; it requires meaningful but still minority network penetration plus diversified monetization.",
  },
  {
    scenario: "Long-range network scale",
    penetration: "~26%",
    comparison:
      "200,000 activated organizations equals about 26% of the 770,000-company broad European technology-industry envelope.",
    economicRead:
      "This remains a deliberately long-range sensitivity case and should never be presented as a near-term SOM or forecast.",
  },
] as const;

export const investorMarketSizingConclusion = {
  headline: "The launch market is concentrated; the network market is large.",
  points: [
    "Italy is unusually attractive as a launch market: a small number of high-connectivity steel distributors and producers sit in front of a downstream base exceeding 160,000 customer companies.",
    "Italy accounted for about 17.6% of EU27 apparent steel use in 2025, supporting an Italy-first strategy despite the country's smaller overall economy.",
    "Europe offers a documented core distribution footprint of about 3,500 companies, then expands into more than 200,000 MET companies and a 770,000-company technology-industry envelope.",
    "The investment case should not call all broad industrial companies immediate paying TAM. Core network density drives acquisition; a minority self-service paid attach plus later marketplace, visibility and intelligence revenue creates the economic upside.",
  ],
} as const;

export const icpDecisionCriteria = [
  { key: "pain", label: "Pain intensity", weight: "25%" },
  { key: "frequency", label: "Workflow frequency", weight: "20%" },
  { key: "wedge", label: "Commercial Memory fit", weight: "20%" },
  { key: "access", label: "GTM accessibility", weight: "15%" },
  { key: "digital", label: "Digital readiness", weight: "10%" },
  { key: "network", label: "Network leverage", weight: "10%" },
] as const;

export const icpScorecard = [
  {
    rank: 1,
    segment: "Commercianti / stockholder",
    score: 4.9,
    confidence: "Medium-high",
    scores: {
      pain: 5,
      frequency: 5,
      wedge: 5,
      access: 5,
      digital: 4,
      network: 5,
    },
    decision:
      "Beachhead ICP. Start in Italy with steel/tube distributors and stockholders managing recurring B2B accounts, multi-supplier sourcing and quote-heavy workflows.",
  },
  {
    rank: 2,
    segment: "Produttori",
    score: 4.0,
    confidence: "Medium",
    scores: {
      pain: 4,
      frequency: 4,
      wedge: 4,
      access: 4,
      digital: 4,
      network: 4,
    },
    decision:
      "Second ICP. Strong strategic fit for Commercial Memory and demand visibility, but likely a more enterprise-led sales and integration motion.",
  },
  {
    rank: 3,
    segment: "Terzisti / processor",
    score: 3.8,
    confidence: "Medium-low",
    scores: {
      pain: 4,
      frequency: 4,
      wedge: 3.5,
      access: 3.5,
      digital: 3.5,
      network: 4,
    },
    decision:
      "Network/Marketplace expansion segment. Validate whether quote history and capability discovery are strong enough to justify a standalone paid seat.",
  },
  {
    rank: 4,
    segment: "Utilizzatori industriali",
    score: 2.9,
    confidence: "Low",
    scores: {
      pain: 3,
      frequency: 3,
      wedge: 2.5,
      access: 2,
      digital: 3,
      network: 4,
    },
    decision:
      "Demand-side segment, not first paid wedge. Prioritise Marketplace, supplier discovery and Scuola before the full Commercial Memory proposition.",
  },
] as const;

export const beachheadProfile = {
  name: "Italian steel/tube distributor or stockholder",
  status: "Evidence-supported hypothesis",
  mustHave: [
    "Recurring B2B RFQs and quotations rather than occasional transactional sales.",
    "Multiple commercial users sharing customer, supplier and product knowledge.",
    "Meaningful price-history and prior-quote reuse in daily selling.",
    "Commercial information fragmented across email, PDFs, spreadsheets and ERP screens.",
    "Frequent need to source products, compare suppliers or reactivate dormant accounts.",
  ],
  positiveSignals: [
    "Sales Director or owner asks for visibility across reps and account history.",
    "New salesperson onboarding requires reconstructing years of commercial context.",
    "Quote response speed and historical price retrieval are recurring pain points.",
    "Company already uses cloud/ERP but lacks a satisfying commercial intelligence layer.",
    "Company serves many industrial customers and can contribute to Network density.",
  ],
  deprioritise: [
    "Single-person brokers with little reusable company memory.",
    "Companies looking primarily for warehouse, accounting or production ERP replacement.",
    "End users with low RFQ frequency and no commercial sales-memory use case.",
    "Large enterprises requiring deep bespoke integration before any usable pilot.",
  ],
} as const;

export const icpSegments = [
  {
    rank: 1,
    fit: "Beachhead ICP",
    segment: "Commercianti / stockholder di tubi e acciaio",
    whyNow:
      "The segment combines high quotation frequency, repeat-customer history, supplier discovery and a concentrated Italian market structure. External market evidence now supports keeping this segment first.",
    coreJobs: [
      "Recuperare rapidamente prezzi, offerte e trattative precedenti.",
      "Trasformare RFQ e email in memoria commerciale interrogabile.",
      "Riattivare domanda dormiente e seguire opportunità.",
      "Trovare supplier e buyer pertinenti senza perdere contesto.",
    ],
    valueProposition:
      "Un workspace commerciale verticale che si affianca all'ERP e trasforma anni di email, offerte e relazioni in memoria operativa e nuove opportunità.",
    validationStatus: "Evidence-supported hypothesis",
  },
  {
    rank: 2,
    fit: "Second ICP",
    segment: "Produttori di tubi e prodotti steel",
    whyNow:
      "Italian steel production is concentrated and strategically important. Commercial Memory, account intelligence and demand visibility fit, but the buying motion is expected to be more enterprise-led.",
    coreJobs: [
      "Consolidare memoria di clienti, prodotti, RFQ e offerte.",
      "Aumentare visibilità su domanda e account dormienti.",
      "Rendere più veloce la ricerca commerciale interna.",
      "Ricevere opportunità compatibili con capability e gamma.",
    ],
    valueProposition:
      "Commercial intelligence verticale per sales team industriali, collegata a un network e a domanda qualificata.",
    validationStatus: "Supported hypothesis",
  },
  {
    rank: 3,
    fit: "Expansion ICP",
    segment: "Terzisti / processor / service provider",
    whyNow:
      "Processors are structurally part of the distribution ecosystem and benefit from capability discovery, recurring quotation history and buyer access, but paid-seat intensity still needs interviews.",
    coreJobs: [
      "Essere trovati per capability specifiche.",
      "Gestire richieste e storico quotazioni.",
      "Collegarsi a buyer e commercianti rilevanti.",
    ],
    valueProposition:
      "Più discovery qualificata e meno dispersione nella gestione commerciale delle lavorazioni.",
    validationStatus: "Needs interviews",
  },
  {
    rank: 4,
    fit: "Demand-side ICP",
    segment: "Utilizzatori industriali",
    whyNow:
      "The downstream base is very broad and valuable for Marketplace density, but the full Commercial Memory wedge is less universal than it is for distributors and producers.",
    coreJobs: [
      "Trovare supplier affidabili e compatibili.",
      "Pubblicare domanda strutturata.",
      "Confrontare risposta commerciale e capability.",
      "Accedere a riferimenti tecnici steel/tube.",
    ],
    valueProposition:
      "Un punto unico per discovery, domanda e conoscenza tecnica, con accesso graduale alle funzioni commerciali.",
    validationStatus: "Needs interviews",
  },
] as const;

export const competitiveAlternatives = [
  {
    category: "Status quo",
    examples: "Email + Excel + shared folders + existing ERP",
    strength:
      "Already paid for, familiar and deeply embedded in daily work.",
    gap:
      "Commercial context stays fragmented; retrieval, cross-rep visibility and dormant-account activation remain manual.",
    implication:
      "This is the primary competitor. Smart Steel Sales must create value before asking the customer to change core ERP processes.",
  },
  {
    category: "Generic CRM",
    examples: "Salesforce, Dynamics CRM, HubSpot and similar",
    strength:
      "Strong account, pipeline, workflow and ecosystem capabilities.",
    gap:
      "Not natively organised around steel grades, standards, dimensions, RFQ lines, quote history and supplier/buyer industry relationships.",
    implication:
      "Position against configuration burden and missing steel context, not against CRM as a category.",
  },
  {
    category: "Metals ERP",
    examples: "INVEX, unitop, Metols, MetalTrax",
    strength:
      "Deep inventory, order, pricing, processing, traceability and operational workflows built for metals.",
    gap:
      "Their centre of gravity is operational ERP. Several also offer CRM/AI, so Smart Steel Sales should not claim an empty market.",
    implication:
      "Integrate and coexist where possible. The wedge is commercial memory + industry graph + demand activation, not replacing warehouse/accounting systems.",
  },
  {
    category: "Digital commerce / revenue layer",
    examples: "Stella Source and adjacent quoting/customer-portal tools",
    strength:
      "Strong digital quoting, ordering, customer portals and revenue execution.",
    gap:
      "Does not by itself reproduce the combination of private historical memory, claimable network, technical discovery and governed marketplace.",
    implication:
      "Watch closely as an adjacent category and potential future integration/competition vector.",
  },
  {
    category: "Associations & market networks",
    examples: "ASSOFERMET, EUROMETAL",
    strength:
      "Trusted industry relationships, market intelligence, events and sector authority.",
    gap:
      "Not a tenant-level commercial operating system and not a private company memory layer.",
    implication:
      "Potential distribution and credibility partners rather than direct substitutes.",
  },
] as const;


export const interviewCohortPlan = {
  purpose:
    "Directional customer discovery, not a statistically representative market survey.",
  totalInterviews: 18,
  primaryGate: {
    segment: "Commercianti / stockholder",
    interviews: 10,
    minimumCompanies: 7,
    roleMix: [
      "At least 4 owner / Sales Director / commercial decision-maker interviews.",
      "At least 4 frontline commercial / Area Manager interviews.",
      "Up to 2 commercial operations / inside-sales interviews to test workflow reality.",
    ],
  },
  comparisonCohort: [
    { segment: "Produttori", interviews: 4, minimumCompanies: 3 },
    { segment: "Terzisti / processor", interviews: 2, minimumCompanies: 2 },
    { segment: "Utilizzatori industriali", interviews: 2, minimumCompanies: 2 },
  ],
} as const;

export const interviewPrinciples = [
  "Past behaviour before future intention: start from a real recent RFQ, quote or customer follow-up.",
  "No product pitch during the problem-discovery section; concept testing comes only after the current workflow is understood.",
  "Ask for concrete frequency, elapsed time, tools opened, hand-offs and failure modes instead of abstract satisfaction.",
  "Capture disconfirming evidence with the same weight as supporting evidence.",
  "Compliments do not count as traction; only concrete next-step behaviour counts as commitment.",
  "Score the interview immediately after the call before reading the aggregate results.",
] as const;

export const interviewScript = [
  {
    phase: "1 · Context",
    minutes: "3–5",
    objective: "Understand role, commercial model and who owns the workflow.",
    questions: [
      "Qual è il tuo ruolo e quante persone partecipano normalmente al processo commerciale?",
      "Che tipo di clienti, prodotti e richieste gestite più spesso?",
      "Quali sistemi usate oggi tra email, ERP, CRM, Excel, cartelle e strumenti interni?",
    ],
  },
  {
    phase: "2 · Recent behaviour",
    minutes: "8–10",
    objective: "Anchor the interview in a recent real commercial episode.",
    questions: [
      "Raccontami l’ultima RFQ o richiesta cliente che hai gestito dall’inizio alla fine.",
      "Quando hai dovuto recuperare un prezzo o un’offerta precedente, come hai fatto esattamente?",
      "Quanti strumenti o persone hai dovuto coinvolgere per ricostruire il contesto?",
      "Dove si è perso più tempo o dove hai avuto più incertezza?",
    ],
  },
  {
    phase: "3 · Frequency & impact",
    minutes: "5–7",
    objective: "Measure recurrence and economic/operational severity.",
    questions: [
      "Quanto spesso si presenta questo problema: ogni giorno, ogni settimana, ogni mese?",
      "Quando non trovi subito lo storico, cosa succede concretamente?",
      "Riesci a stimare tempo perso, ritardo di risposta, rischio prezzo o opportunità persa?",
      "Chi altro in azienda soffre lo stesso problema?",
    ],
  },
  {
    phase: "4 · Alternatives & priority",
    minutes: "5–7",
    objective: "Understand incumbents, previous attempts and buying trigger.",
    questions: [
      "Come lo risolvete oggi e quanto siete soddisfatti di questa soluzione?",
      "Avete già provato CRM, moduli ERP, cartelle condivise o procedure interne diverse?",
      "Perché quelle soluzioni hanno funzionato o non hanno funzionato?",
      "Cosa dovrebbe succedere perché questo problema diventi una priorità di investimento?",
    ],
  },
  {
    phase: "5 · Buying process",
    minutes: "4–5",
    objective: "Identify sponsor, authority and practical adoption constraints.",
    questions: [
      "Chi dovrebbe essere coinvolto per adottare uno strumento commerciale di questo tipo?",
      "Chi decide e chi potrebbe bloccare la decisione?",
      "Quali requisiti di sicurezza, dati o integrazione sarebbero obbligatori?",
      "Quale risultato dovrebbe essere visibile nei primi 30–60 giorni per giustificare il progetto?",
    ],
  },
  {
    phase: "6 · Concept test",
    minutes: "5–7",
    objective: "Test the wedge only after the problem is established.",
    questions: [
      "Guardando il concetto Commercial Memory + Network, quale parte useresti davvero nel lavoro di domani?",
      "Quale parte invece è irrilevante o troppo complessa?",
      "Cosa dovrebbe integrarsi con il vostro ERP o mailbox per essere credibile?",
      "Qual è il motivo principale per cui non lo adotteresti?",
    ],
  },
  {
    phase: "7 · Commitment",
    minutes: "2–3",
    objective: "Replace stated interest with observable next-step behaviour.",
    questions: [
      "Quale prossimo passo concreto avrebbe senso: seconda demo, coinvolgere un collega, condividere un esempio anonimizzato o valutare un pilot?",
      "Chi altro dovremmo ascoltare nella vostra azienda per capire se il problema è reale?",
    ],
  },
] as const;

export const interviewScoreDimensions = [
  {
    key: "frequency",
    label: "Problem frequency",
    zero: "Rare / monthly or less",
    one: "Weekly",
    two: "Several times per week / daily",
  },
  {
    key: "impact",
    label: "Measurable impact",
    zero: "Minor annoyance; no consequence described",
    one: "Clear time loss, delay or operational risk",
    two: "Quantified hours, margin/revenue risk or recurring customer impact",
  },
  {
    key: "fragmentation",
    label: "Workflow fragmentation",
    zero: "One current system solves it adequately",
    one: "Manual workaround around one main system",
    two: "Two or more tools/people plus manual reconciliation",
  },
  {
    key: "priority",
    label: "Buying urgency",
    zero: "No initiative or trigger",
    one: "Recognised problem / medium-term priority",
    two: "Active trigger, project or management priority",
  },
  {
    key: "authority",
    label: "Sponsor / authority",
    zero: "No route to a sponsor",
    one: "Influencer or user willing to introduce decision-maker",
    two: "Budget owner / decision-maker directly engaged",
  },
  {
    key: "commitment",
    label: "Behavioural commitment",
    zero: "Positive words only",
    one: "Agrees to concrete follow-up or second stakeholder",
    two: "Shares data/example, schedules pilot step or commits internal resources",
  },
] as const;

export const interviewFitBands = [
  {
    band: "Strong fit",
    score: "9–12 / 12",
    rule:
      "Requires problem frequency >= 1 and behavioural commitment >= 1; a high score without recurrence or commitment cannot be strong fit.",
  },
  {
    band: "Medium fit",
    score: "6–8 / 12",
    rule:
      "Problem exists but urgency, authority, impact or commitment is incomplete.",
  },
  {
    band: "Weak fit",
    score: "0–5 / 12",
    rule:
      "Low recurrence, low impact, satisfactory incumbent workflow or no credible buying path.",
  },
] as const;

export const icpValidationGate = {
  sampleGate: [
    "10 distributor/stockholder interviews completed across at least 7 distinct companies.",
    "At least 4 decision-maker interviews and at least 4 frontline commercial-user interviews.",
    "Comparison cohort completed: 4 producers, 2 processors and 2 industrial end users.",
  ],
  validateThresholds: [
    ">=70% of distributor interviews report the core commercial-memory problem at least weekly.",
    ">=60% use two or more systems/people or manual reconciliation to reconstruct commercial context.",
    ">=50% provide concrete evidence of material time, delay, risk or commercial impact.",
    ">=50% of interviewed distributor companies expose a reachable sponsor or decision-maker.",
    ">=40% of distinct distributor companies make a behavioural commitment beyond verbal interest.",
    "At least 3 distinct distributor companies accept a pilot-oriented next step: data example, second stakeholder, or controlled pilot discussion.",
  ],
  disconfirmThresholds: [
    "<40% of distributor interviews experience the problem weekly.",
    ">=60% say the current ERP/CRM/workflow solves the problem adequately with no meaningful workaround.",
    "<20% of distributor companies make any concrete next-step commitment after concept testing.",
    "A repeated blocker appears in >=40% of companies and cannot be addressed without changing the core product thesis.",
  ],
  decisionLogic: [
    {
      status: "Validated",
      rule:
        "Sample gate complete, at least 5 of 6 validation thresholds pass, and no disconfirmation threshold triggers.",
    },
    {
      status: "Needs evidence",
      rule:
        "Sample gate incomplete or only 3–4 validation thresholds pass without a decisive disconfirmation signal.",
    },
    {
      status: "Rejected / pivot",
      rule:
        "Two or more disconfirmation thresholds trigger, or the core weekly-pain threshold fails after the complete primary sample.",
    },
  ],
} as const;

export const interviewEvidenceTemplate = [
  "Company / segment / company-size band",
  "Interviewee role and decision influence",
  "Recent commercial episode used as evidence",
  "Current tools and hand-offs",
  "Problem frequency",
  "Observed or quantified impact",
  "Current workaround and satisfaction",
  "Buying trigger / urgency",
  "Security or integration blockers",
  "Concept-test reaction: useful / irrelevant / missing",
  "Behavioural commitment",
  "Verbatim evidence quote",
  "6-dimension score /12",
  "Strong / Medium / Weak fit",
] as const;


export const syntheticInterviewSimulation = {
  disclaimer:
    "Synthetic scenario only. These are not customer interviews, traction, willingness-to-pay evidence or validation. The scenario is calibrated from current steel-market structure, Italian digital-adoption data, existing product evidence and current CRM price anchors.",
  cohort: "10 simulated distributor/stockholder interviews across 8 synthetic companies",
  sentimentMix: [
    { label: "Strong positive", count: 4 },
    { label: "Positive / cautious", count: 4 },
    { label: "Sceptical / conditional", count: 1 },
    { label: "Low fit", count: 1 },
  ],
  aggregate: [
    { label: "Weekly core pain", value: "80%", gate: ">=70%", result: "Pass in simulation" },
    { label: "Fragmented workflow", value: "80%", gate: ">=60%", result: "Pass in simulation" },
    { label: "Material impact evidence", value: "60%", gate: ">=50%", result: "Pass in simulation" },
    { label: "Reachable sponsor", value: "62.5%", gate: ">=50%", result: "Pass in simulation" },
    { label: "Behavioural commitment", value: "50%", gate: ">=40%", result: "Pass in simulation" },
    { label: "Pilot-oriented companies", value: "3", gate: ">=3", result: "Pass in simulation" },
  ],
  likelyPositiveSignals: [
    "Historical quote and price retrieval feels immediately understandable because it maps to an existing daily workflow.",
    "Sales Directors value shared commercial memory more than another generic pipeline view.",
    "Frontline users respond best when the product removes search/reconstruction work rather than adding CRM data-entry work.",
    "Network and supplier discovery increase perceived upside after the Commercial Memory wedge is understood.",
  ],
  likelyObjections: [
    "ERP/email integration must feel additive rather than requiring process replacement.",
    "Customers will ask where commercial emails, prices and customer data are stored and who can access them.",
    "Teams may resist a new tool if ingestion/search is not automatic enough.",
    "ROI must be demonstrated through response speed, recovered context, reactivated opportunities or fewer manual searches.",
    "Marketplace value is attractive but should not be the only reason to pay before network density is proven.",
  ],
  implication:
    "If real interviews resemble this base case, the ICP gate would pass. Until those interviews exist, the only valid conclusion is that the distributor-first thesis is plausible enough to justify pricing experiments.",
} as const;

export const pricingMarketAnchors = [
  {
    vendor: "Salesforce Sales Cloud",
    anchor: "€25–€100/user/month for Starter–Pro; higher editions rise materially beyond that",
    implication:
      "Generic CRM establishes that European B2B sales software can support meaningful per-seat pricing, but Smart Steel Sales should avoid direct feature-for-feature CRM comparison.",
    asOf: "2 Oct 2026",
    sourceUrl: "https://www.salesforce.com/eu/sales/pricing/",
  },
  {
    vendor: "Microsoft Dynamics 365 Sales",
    anchor: "€56.30 / €91 / €130 per user/month for Professional / Enterprise / Premium in Italy",
    implication:
      "A five-user commercial team already sits around €281–€650/month before implementation or adjacent tooling.",
    asOf: "2 Oct 2026",
    sourceUrl: "https://www.microsoft.com/it-it/dynamics-365/products/sales/pricing",
  },
  {
    vendor: "HubSpot Sales Hub",
    anchor: "Professional about €90/user/month plus one-time onboarding; Enterprise about €150/user/month",
    implication:
      "Mature sales software combines recurring seats with onboarding and usage/credit mechanics, providing an upper reference for a vertical early-stage offer.",
    asOf: "2 Oct 2026",
    sourceUrl: "https://www.hubspot.com/pricing/sales?currencyCode=EUR",
  },
] as const;

export const pricingArchitectureDecision = {
  preferredModel: "Permanent Free Base + optional low-cost modules + simple self-service bundle",
  rationale: [
    "Smart Steel Sales should be useful before payment: the free product must create real day-one value and network density, not function as a disguised trial.",
    "Monetization should happen through optional capability unlocks after users have already reached value, reducing dependence on demos, procurement calls and a dedicated sales force.",
    "Paid modules should be inexpensive enough to sit below the threshold that normally triggers a formal software-buying process for an SME.",
    "The default commercial path is self-service activation, in-product upgrade and card billing; human sales remains exceptional rather than necessary.",
    "Organization-level module pricing avoids punishing collaboration while still allowing cost controls through fair-use allowances for AI, ingestion and storage.",
  ],
  rejectedForNow: [
    "A mandatory paid pilot before the customer can experience the product.",
    "A €299–€799 Core/Pro ladder as the default route to monetization.",
    "A GTM model that requires outbound sales, demos or negotiation to create every paying customer.",
    "Mandatory onboarding fees or annual contracts for normal SME usage.",
    "Pure per-seat pricing as the primary expansion mechanism.",
  ],
} as const;

export const packagingBoundaryDecision = {
  status: "Product-led architecture reset · unit-economics validation pending",
  principle:
    "Keep a permanently useful Free Base and charge only when an organization voluntarily unlocks deeper automation, memory, AI or team capabilities. Every paid boundary must follow an experienced value moment rather than precede it.",
  boundaries: [
    {
      transition: "Free Base → Memory+",
      trigger: "The company wants deeper, persistent and more automated commercial memory",
      paidValue:
        "Extended historical ingestion, richer email/RFQ/offer retrieval, larger memory/storage envelope and automated synchronization where available.",
      staysOutside:
        "Basic Workspace, customers, contacts, RFQs/offers and a useful Memory Lite experience remain free.",
      reason:
        "Users should understand the value of company memory from real use before deciding whether deeper history and automation are worth a small monthly fee.",
    },
    {
      transition: "Free Base → AI+",
      trigger: "The company repeatedly uses AI assistance beyond the included free allowance",
      paidValue:
        "Higher AI allowance, structured extraction, assisted drafting/summarization and advanced commercial queries.",
      staysOutside:
        "A small recurring AI allowance remains free so users can experience the workflow without a credit card.",
      reason:
        "AI cost should scale with optional usage, but first value must be discoverable for free.",
    },
    {
      transition: "Free Base → Team+",
      trigger: "The organization needs more coordination rather than more individual usage",
      paidValue:
        "Advanced roles, team analytics, workflow automation, governance and a larger collaboration envelope.",
      staysOutside:
        "Basic multi-user collaboration remains free and is never blocked merely to force seat expansion.",
      reason:
        "The paid boundary follows organizational complexity, not the act of inviting another colleague.",
    },
    {
      transition: "Marketplace → Premium actions",
      trigger: "Network liquidity creates a premium action with measurable transaction value",
      paidValue:
        "Optional micro-credits or a low-cost Marketplace add-on for premium distribution/unlock actions only after recurring response value is proven.",
      staysOutside:
        "Discovery, company visibility and the basic demand/supply loop stay free while network density is still being built.",
      reason:
        "Marketplace monetization must never slow network formation before liquidity exists.",
    },
  ],
} as const;

export const valueMetricDecision = {
  primaryMetric: "Optional paid module adoption per organization",
  status: "Preferred PLG metric · L27.2C cost validation required",
  why:
    "The user should pay for a capability they actively choose to deepen, not for access to the platform itself. Module attach rate and self-service retention therefore measure value alignment better than seat count or negotiated contract value.",
  secondaryLevers: [
    {
      metric: "Low-cost module subscription",
      role: "Primary monetization",
      rule:
        "Charge a small organization-level monthly amount for Memory+, AI+ or Team+ only after the corresponding free capability has demonstrated value.",
    },
    {
      metric: "SSS Plus bundle",
      role: "Simple expansion path",
      rule:
        "Offer one inexpensive bundle for organizations that want all paid modules, avoiding a complex pricing calculator or sales negotiation.",
    },
    {
      metric: "Fair-use AI / ingestion / storage",
      role: "Cost guardrail",
      rule:
        "Use generous but finite allowances to protect unit economics. Ordinary usage should feel predictable, not metered action by action.",
    },
    {
      metric: "Marketplace premium actions",
      role: "Future usage layer",
      rule:
        "Introduce only after P5.6/L27.5 proves recurring response value; keep the basic network loop free.",
    },
  ],
  doNotMeter: [
    "Company profile, claim, Network discovery/follow and public Scuola.",
    "Basic Workspace objects: customers, contacts, RFQs and offers.",
    "A useful Memory Lite experience and a small recurring AI allowance.",
    "Basic collaboration among a small commercial team.",
    "Normal browsing of Marketplace demand/supply while liquidity is being created.",
  ],
} as const;

export const valueMetricAlternatives = [
  {
    candidate: "Permanent free base + optional modules",
    decision: "Preferred",
    valueAlignment:
      "Maximizes product-led adoption and lets companies buy only the incremental capability they already understand.",
  },
  {
    candidate: "All-in Core subscription",
    decision: "Superseded",
    valueAlignment:
      "Creates a larger buying decision too early and tends to require sales assistance before enough value has been experienced.",
  },
  {
    candidate: "Pure per-seat",
    decision: "Reject as default",
    valueAlignment:
      "Discourages team adoption and makes the product feel expensive as soon as collaboration succeeds.",
  },
  {
    candidate: "Pure usage / AI credits",
    decision: "Guardrail only",
    valueAlignment:
      "Useful for cost control but too unpredictable to become the main value proposition or headline price.",
  },
] as const;

export const packagingBoundaryValidationGate = {
  evidenceRequired: [
    "Observe whether free organizations reach a meaningful activation event without demos or onboarding calls.",
    "Measure which paid capability users attempt to unlock after experiencing the corresponding free workflow.",
    "Track module attach rate, self-service checkout completion, downgrade/cancel reasons and 30/60/90-day paid retention.",
    "Separate cost-driven limits from artificial paywalls: the free product must remain genuinely useful.",
  ],
  directionalPassSignals: [
    "At least 5 distinct organizations purchase a module or SSS Plus through a self-service path without a negotiated sales process.",
    "At least 80% of early paid activations complete without a mandatory demo, custom proposal or manual onboarding.",
    "At least 3 paid organizations remain paid after 60 days once enough calendar time has elapsed.",
    "More than one paid module shows organic demand, indicating monetization is not dependent on a single forced paywall.",
  ],
  disconfirmSignals: [
    "Most activated organizations require a sales call to understand why or how to upgrade.",
    "Users encounter a paywall before they have reached the corresponding free value moment.",
    "The Free Base is too weak to create repeat usage or too complete to create any optional module demand.",
    "L27.2C shows that a low-impact module price cannot sustain infrastructure/support cost even with fair-use limits.",
  ],
  decisionRule:
    "The freemium architecture is directionally supported only when users reach value for free and a subset voluntarily upgrades through self-service. Sales-assisted conversions may be recorded but must not be the primary proof.",
} as const;

export const pricingHypotheses = [
  {
    name: "SSS Free",
    price: "€0 · permanent",
    audience: "Every verified/registered steel-industry organization",
    purpose: "Useful product + acquisition + network density",
    includes: [
      "Scuola, standards and technical calculators",
      "Company profile / claim + Network discovery/follow",
      "Basic Workspace for customers, contacts, RFQs and offers",
      "Memory Lite with a modest history/import envelope",
      "Small recurring AI allowance",
      "Basic multi-user collaboration",
      "Marketplace discovery and basic participation",
    ],
    excludes: [
      "Large automated history/sync envelope",
      "High AI usage",
      "Advanced team analytics/governance/automation",
    ],
    status: "New baseline",
  },
  {
    name: "Memory+",
    price: "Working anchor €15 / organization / month",
    audience: "Teams that outgrow Memory Lite",
    purpose: "Deeper commercial history without a large software purchase",
    includes: [
      "Extended Commercial Memory",
      "Larger historical ingestion/storage envelope",
      "Advanced email/RFQ/offer search",
      "Automated synchronization where available",
    ],
    excludes: ["High AI allowance", "Advanced team governance"],
    status: "Low-cost module hypothesis",
  },
  {
    name: "AI+",
    price: "Working anchor €15 / organization / month",
    audience: "Teams with recurring AI-assisted commercial work",
    purpose: "Optional higher AI capacity",
    includes: [
      "Higher AI allowance",
      "Structured extraction and summarization",
      "Assisted commercial queries and drafting",
      "Fair-use protection rather than per-click metering",
    ],
    excludes: ["Custom AI workflows", "Unbounded consumption"],
    status: "Low-cost module hypothesis",
  },
  {
    name: "Team+",
    price: "Working anchor €15 / organization / month",
    audience: "Organizations that need more coordination and governance",
    purpose: "Monetize complexity, not seats",
    includes: [
      "Advanced roles/permissions",
      "Team analytics",
      "Workflow automation",
      "Larger collaboration envelope",
    ],
    excludes: ["Enterprise SSO/API/SLA"],
    status: "Low-cost module hypothesis",
  },
  {
    name: "SSS Plus",
    price: "Working anchor €39 / organization / month",
    audience: "Organizations that want the full self-service paid experience",
    purpose: "One simple all-in upgrade",
    includes: [
      "Memory+",
      "AI+",
      "Team+",
      "One predictable monthly price",
      "Self-service activation and cancellation",
    ],
    excludes: ["Bespoke enterprise implementation"],
    status: "Preferred bundle hypothesis",
  },
  {
    name: "Marketplace premium",
    price: "Keep core free; future micro-credit / low-cost add-on",
    audience: "Only users creating measurable premium transaction value",
    purpose: "Monetize liquidity after it exists",
    includes: [
      "Potential premium distribution or response unlocks",
      "Small optional credits/add-on only after value evidence",
    ],
    excludes: ["Basic network participation", "Core discovery"],
    status: "Deferred until P5.6/L27.5 evidence",
  },
] as const;

export const pricingExperimentBands = [
  {
    test: "Module micro-price",
    offer: "Test €9 / €15 / €19 per organization/month for one optional module",
    goal:
      "Find a low-friction price that converts self-service after the user has already experienced the free capability; L27.2C sets the economic floor.",
  },
  {
    test: "All-in bundle",
    offer: "Test €29 / €39 / €49 per organization/month for SSS Plus",
    goal:
      "Keep the typical paying SME below a material procurement threshold while providing a simple alternative to buying modules individually.",
  },
  {
    test: "Marketplace premium action",
    offer: "No paid test before liquidity; later test micro-credit or €9–€19 low-cost add-on",
    goal:
      "Protect network growth now and only introduce payment when a premium response/distribution action has measurable recurring value.",
  },
] as const;

export const pricingDecisionRules = [
  "The Free Base is permanent and must remain genuinely useful; do not convert it into a time-limited trial.",
  "No mandatory demo, proposal or onboarding call should be required for standard module purchase.",
  "The default target is a typical paying SME spend of roughly €15–€49/month before optional Marketplace usage.",
  "Never raise prices simply because a company adds ordinary collaborators; monetize advanced coordination through Team+ instead.",
  "L27.2C can raise a module floor only if real AI/storage/support costs make the working micro-price unsustainable.",
  "Paid conversion is measured from activated free organizations, not from raw signups.",
  "Human sales can support complex/custom accounts later, but it must not be required for the core growth engine.",
  "Marketplace remains free-first until liquidity and supplier-response value are proven.",
] as const;

export const freemiumModuleCards = [
  {
    code: "FREE",
    name: "SSS Free",
    price: "€0 forever",
    audience: "Any steel-industry organization",
    scope: [
      "Scuola + calculators",
      "Company profile and Network",
      "Basic Workspace",
      "Memory Lite",
      "AI Lite",
      "Basic collaboration",
      "Marketplace base",
    ],
    rule:
      "No credit card and no countdown. Users must be able to reach repeatable product value before any upgrade prompt becomes important.",
    successSignal:
      "Activated organizations return and use Workspace/Memory/Network without human onboarding.",
  },
  {
    code: "MEMORY+",
    name: "Memory+",
    price: "Working anchor €15/month",
    audience: "Organizations with growing historical commercial data",
    scope: [
      "Extended memory/history",
      "Larger ingestion/storage envelope",
      "Advanced historical search",
      "Automated sync where available",
    ],
    rule:
      "Upgrade prompt appears only when Memory Lite has demonstrated value or a genuine cost/volume boundary is reached.",
    successSignal:
      "Self-service purchase directly after repeated Memory Lite use or a clearly understood history/sync need.",
  },
  {
    code: "AI+",
    name: "AI+",
    price: "Working anchor €15/month",
    audience: "Organizations repeatedly using AI assistance",
    scope: [
      "Higher AI allowance",
      "Extraction/summarization",
      "Commercial querying",
      "Assisted drafting",
    ],
    rule:
      "Keep a useful free recurring allowance. AI+ expands capacity rather than unlocking the concept for the first time.",
    successSignal:
      "Users voluntarily upgrade after exhausting or repeatedly approaching the free allowance.",
  },
  {
    code: "TEAM+",
    name: "Team+",
    price: "Working anchor €15/month",
    audience: "Organizations needing advanced coordination",
    scope: [
      "Advanced roles",
      "Team analytics",
      "Automation",
      "Governance controls",
    ],
    rule:
      "Do not charge for every normal seat. The module unlocks coordination depth rather than basic collaboration.",
    successSignal:
      "Upgrade follows a real governance/analytics need created by successful team adoption.",
  },
  {
    code: "PLUS",
    name: "SSS Plus",
    price: "Working anchor €39/month",
    audience: "Organizations wanting all paid modules",
    scope: [
      "Memory+",
      "AI+",
      "Team+",
      "Single predictable monthly bill",
    ],
    rule:
      "Always available through self-service with clear savings versus three separate modules; no negotiation required.",
    successSignal:
      "Becomes the natural self-service choice for organizations attaching two or more modules.",
  },
] as const;

export const selfServeMonetizationModel = {
  purpose:
    "Prove that Smart Steel Sales can monetize as a product-led network utility: users discover value for free, upgrade inside the product and remain paid without a sales-dependent acquisition engine.",
  activationCohort: {
    organizations: 50,
    initialPaidOrganizations: 5,
    definition:
      "Activated = a real organization that completes a meaningful workflow such as creating/importing commercial data, retrieving history, using AI assistance or repeatedly using Network/Marketplace—not merely registering.",
  },
  sequence: [
    "Acquire through public Scuola/SEO, company discovery, referrals, claim flow and Network activity.",
    "Let the organization activate the useful Free Base without a meeting or credit card.",
    "Detect a natural expansion signal such as memory volume, repeated AI use, advanced team coordination or a future premium Marketplace action.",
    "Show a contextual upgrade with a low monthly price and plain-language benefit.",
    "Complete checkout and module activation in-product without proposal negotiation.",
    "Measure repeat use, downgrade/cancel reason and paid retention before changing price.",
  ],
  guardrails: [
    "No mandatory free-trial expiry.",
    "No sales call required to unlock normal paid modules.",
    "No onboarding fee for standard self-service organizations.",
    "No annual commitment required at launch; annual billing can later be an optional discount.",
    "No artificial data hostage pattern: exports and normal customer data remain accessible.",
    "Paid limits should map to cost or advanced capability, not arbitrary friction.",
  ],
} as const;

export const productLedEvidenceScale = [
  {
    score: 5,
    label: "Retained self-service payer",
    evidence: "Organization buys without sales assistance and remains paid after the defined retention window.",
  },
  {
    score: 4,
    label: "Self-service paid",
    evidence: "Organization purchases a module/bundle and activates it without negotiated commercial intervention.",
  },
  {
    score: 3,
    label: "Upgrade intent in product",
    evidence: "Activated organization reaches a paid boundary and initiates checkout or pricing interaction.",
  },
  {
    score: 2,
    label: "Repeat free activation",
    evidence: "Organization repeatedly uses the free workflow and reaches a clear expansion signal.",
  },
  {
    score: 1,
    label: "Registered / claimed",
    evidence: "Organization exists on the platform but has not reached repeatable product value.",
  },
  {
    score: 0,
    label: "Inactive",
    evidence: "No meaningful workflow beyond registration or first visit.",
  },
] as const;

export const freemiumPricingGuardrails = {
  moduleTestCells: "€9 → €15 → €19",
  bundleTestCells: "€29 → €39 → €49",
  rule:
    "Run price tests only on comparable activated cohorts and only after users reach the same value moment. Never turn pricing tests into human negotiation.",
  target:
    "Keep normal SME self-service spend low enough that adoption can remain a card-level operating expense rather than a software procurement project.",
  unitEconomicsRule:
    "L27.2C defines the minimum sustainable price from AI, storage, email, support and payment costs before any public pricing is locked.",
} as const;

export const productLedValidationGate = {
  sampleGate: [
    "Reach at least 50 activated organizations before treating conversion percentages as more than early directional evidence.",
    "Record source, activation event, free feature usage, upgrade trigger, module purchased, price cell and whether human assistance was required.",
    "Exclude test/friendly accounts and manually comped subscriptions from paid conversion evidence.",
  ],
  earlyPass: [
    "At least 5 distinct organizations purchase a module or SSS Plus through self-service.",
    "At least 4 of the first 5 paid organizations complete purchase without a mandatory sales call or custom proposal.",
    "At least 3 paid organizations remain paid after 60 days once the observation window exists.",
    "At least two different paid modules or the Plus bundle receive organic purchases, reducing dependence on a single artificial paywall.",
  ],
  scaledSupport: [
    "A 5–10% activated-to-paid conversion band is the initial internal hypothesis to test, not an external benchmark.",
    "Typical self-service paid spend should remain in the low-impact €15–€49/month range unless optional usage creates additional value.",
    "Expansion should come from module attach/bundle adoption and product usage rather than from adding sales headcount.",
  ],
  disconfirmSignals: [
    "Paid conversion occurs mainly after demos, outbound persuasion or manually negotiated discounts.",
    "More than half of activated users hit a paywall before demonstrating repeat free value.",
    "Paid churn rapidly reverses module upgrades once users see the first invoice.",
    "L27.2C shows negative or fragile contribution margin at the intended low-impact price bands.",
  ],
  decisionRule:
    "Call the model product-led validated only when real organizations repeatedly activate for free, upgrade self-service and remain paid. Sales-assisted revenue can coexist later but is not required evidence for the core model.",
} as const;

export const productLedEvidenceTemplate = [
  "Organization / segment / acquisition source",
  "Activation date and activation event",
  "Free features used before upgrade",
  "Natural expansion signal",
  "Module / bundle selected",
  "Price cell shown",
  "Checkout started / completed",
  "Human sales or onboarding assistance required? yes/no",
  "30/60/90-day paid status",
  "Downgrade / cancel reason",
  "Estimated usage cost for L27.2C",
] as const;

export const networkEconomicsThesis = {
  headline: "Build the steel industry's business network first; monetize the value created on top of it.",
  principle:
    "SSS should become more valuable as verified companies, professionals, relationships, commercial data and marketplace interactions accumulate. Revenue can then attach to multiple high-value surfaces without making access to the network itself expensive.",
  investorLogic: [
    "Users and verified organizations create the distribution asset; they are not merely leads for a sales team.",
    "A permanent Free Base lowers friction for network formation and creates more data, relationships and recurring workflows.",
    "Low-cost modules monetize power users while preserving broad adoption.",
    "Marketplace, sponsored visibility and industry intelligence can add revenue as network density and usage mature.",
    "Enterprise/API revenue can monetize integration depth without dictating the default SME product.",
    "A diversified revenue mix reduces dependence on any single subscription price or feature paywall.",
  ],
} as const;

export const networkNorthStarMetrics = [
  {
    metric: "Verified organizations",
    why: "Measures trusted supply/demand identity in the steel graph.",
    targetLogic: "Growth asset",
  },
  {
    metric: "Monthly active organizations (MAO)",
    why: "Primary denominator for network usage, monetization and infrastructure economics.",
    targetLogic: "Core scale metric",
  },
  {
    metric: "Monthly active users (MAU)",
    why: "Shows professional reach and multi-user penetration inside organizations.",
    targetLogic: "Reach + engagement",
  },
  {
    metric: "Meaningful interactions / MAO",
    why: "RFQs, memory retrievals, follows, supplier discovery, messages/responses and marketplace actions measure real network utility.",
    targetLogic: "Usage density",
  },
  {
    metric: "Self-service paid attach rate",
    why: "Shows whether value monetizes without outbound persuasion.",
    targetLogic: "Monetization efficiency",
  },
  {
    metric: "Paid ARPA + revenue / MAO",
    why: "Separates direct subscription value from broader network monetization.",
    targetLogic: "Economic depth",
  },
  {
    metric: "30/60/90-day organization retention",
    why: "A network only compounds when companies continue to participate.",
    targetLogic: "Retention",
  },
  {
    metric: "Cross-side liquidity",
    why: "Measures whether demand receives relevant supplier response and discovery becomes commercially useful.",
    targetLogic: "Marketplace quality",
  },
] as const;

export const networkIncomeStreams = [
  {
    stream: "Freemium modules + SSS Plus",
    timing: "Launch / early",
    payer: "Organizations that want deeper Memory, AI or Team capability",
    model: "€9–€19/module or €29–€49 bundle working cells",
    strategicRole:
      "Early recurring revenue with minimal sales friction. Validates willingness to pay without restricting network access.",
    trustGuard:
      "Never degrade the Free Base into a useless lead-generation shell.",
  },
  {
    stream: "Marketplace premium actions",
    timing: "After liquidity",
    payer: "Organizations receiving measurable premium distribution/response value",
    model: "Low-cost add-on or micro-credits; exact mechanic deferred",
    strategicRole:
      "Monetizes commercial intent and usage rather than access to the network.",
    trustGuard:
      "Basic participation and discovery stay free until recurring response value is proven.",
  },
  {
    stream: "Sponsored industry visibility",
    timing: "After meaningful traffic",
    payer: "Suppliers, service centres and industry brands seeking targeted professional visibility",
    model: "Featured company/content/sponsorship packages; pricing deferred",
    strategicRole:
      "Turns sector-specific attention into revenue without raising core software prices.",
    trustGuard:
      "Sponsored placement must be clearly labeled and must not override relevance or trust ranking.",
  },
  {
    stream: "Aggregated industry intelligence",
    timing: "After sufficient data density",
    payer: "Organizations seeking market signals, benchmarks or aggregated demand/supply insight",
    model: "Premium intelligence subscription or report/data product",
    strategicRole:
      "Creates a high-margin information layer from network-level patterns rather than private tenant data.",
    trustGuard:
      "Only aggregated/anonymized or explicitly permissioned data; private commercial memory is never sold.",
  },
  {
    stream: "API / integrations / enterprise services",
    timing: "Selective / later",
    payer: "Large groups and software partners",
    model: "Higher-value API, integration or enterprise contract",
    strategicRole:
      "Adds higher-ARPA revenue without forcing enterprise complexity onto the standard product.",
    trustGuard:
      "Custom work must stay bounded so it does not turn the core company into a services business.",
  },
] as const;

export const unitEconomicsGuardrails = {
  philosophy:
    "L27.2C uses internal planning ceilings rather than pretending current costs are already measured. Production telemetry must replace these assumptions before launch economics are considered validated.",
  variableCostTargets: [
    {
      metric: "Free active organization variable cost",
      workingCeiling: "≤ €0.75 / MAO / month",
      reason:
        "A large Free Base is only strategically attractive if ordinary non-AI usage remains extremely cheap to serve.",
    },
    {
      metric: "Paid organization incremental variable cost",
      workingCeiling: "≤ €5 / paying organization / month before exceptional usage",
      reason:
        "Low-price modules require storage, email and baseline AI cost to remain tightly controlled.",
    },
    {
      metric: "AI-specific variable cost",
      workingCeiling: "≤ 20% of AI+ attributable revenue",
      reason:
        "AI+ should expand usage while preserving predictable contribution margin through fair-use envelopes.",
    },
    {
      metric: "Blended variable revenue cost",
      workingCeiling: "≤ 25% of revenue",
      reason:
        "Internal target implies ≥75% contribution before fixed product/company operating expense.",
    },
    {
      metric: "Standard support load",
      workingCeiling: "< 15 minutes / paying organization / month",
      reason:
        "A €15–€49 self-service model cannot economically depend on account-management intensity.",
    },
  ],
  acquisitionRules: [
    "Organic, referral, company-claim, Network and Scuola acquisition are the default growth channels.",
    "Paid acquisition is optional experimentation, not a dependency in the base model.",
    "Any paid acquisition cohort should target payback inside roughly 3 months of contribution margin before scaling.",
    "Founder or sales-assisted onboarding must be measured separately and excluded from the self-service CAC baseline.",
  ],
} as const;

export const networkScaleScenarios = [
  {
    name: "Validation",
    status: "Early evidence stage",
    activatedOrganizations: 500,
    paidAttachRate: "5%",
    payingOrganizations: 25,
    blendedPaidArpa: "€29",
    moduleMrr: "€725",
    marketplaceMrr: "€0",
    sponsoredMrr: "€0",
    intelligenceApiMrr: "€0",
    totalMrr: "€725",
    annualizedRevenue: "€8.7k",
    interpretation:
      "This stage proves self-service monetization mechanics; it is not designed to demonstrate venture-scale revenue.",
  },
  {
    name: "Italy network",
    status: "Internal planning scenario",
    activatedOrganizations: 10000,
    paidAttachRate: "8%",
    payingOrganizations: 800,
    blendedPaidArpa: "€35",
    moduleMrr: "€28.0k",
    marketplaceMrr: "€7.5k",
    sponsoredMrr: "€4.9k",
    intelligenceApiMrr: "€4.0k",
    totalMrr: "€44.4k",
    annualizedRevenue: "€533k",
    interpretation:
      "Illustrates how a meaningful domestic network can monetize through several small streams without high SME subscription pricing.",
  },
  {
    name: "European network",
    status: "Internal planning scenario",
    activatedOrganizations: 50000,
    paidAttachRate: "10%",
    payingOrganizations: 5000,
    blendedPaidArpa: "€39",
    moduleMrr: "€195k",
    marketplaceMrr: "€80k",
    sponsoredMrr: "€79k",
    intelligenceApiMrr: "€29.9k",
    totalMrr: "€383.9k",
    annualizedRevenue: "€4.61m",
    interpretation:
      "Shows why user/organization scale and usage density matter more than extracting high ARPA from each customer.",
  },
  {
    name: "Network scale",
    status: "Long-range sensitivity case",
    activatedOrganizations: 200000,
    paidAttachRate: "12%",
    payingOrganizations: 24000,
    blendedPaidArpa: "€42",
    moduleMrr: "€1.008m",
    marketplaceMrr: "€500k",
    sponsoredMrr: "€594k",
    intelligenceApiMrr: "€159.6k",
    totalMrr: "€2.262m",
    annualizedRevenue: "€27.14m",
    interpretation:
      "Sensitivity case for a broad European/global steel-business network. It is not a forecast and assumes multiple mature monetization surfaces.",
  },
] as const;

export const scenarioAssumptions = {
  disclaimer:
    "These are internal sensitivity scenarios, not forecasts, guidance, traction or market-size claims. They exist to test whether the business architecture can become attractive at scale.",
  formulas: [
    "Module MRR = activated organizations × paid attach rate × blended paid ARPA.",
    "Marketplace MRR = activated organizations × monetized marketplace rate × average monthly premium usage.",
    "Sponsored MRR = activated organizations × sponsor penetration × average sponsor spend.",
    "Intelligence/API MRR = paying intelligence/API accounts × average monthly contract value.",
    "Annualized revenue = total modeled MRR × 12.",
  ],
  scenarioInputs: [
    {
      scenario: "Validation",
      marketplace: "0% monetized",
      sponsored: "0%",
      intelligenceApi: "0 accounts",
    },
    {
      scenario: "Italy network",
      marketplace: "5% × €15/month",
      sponsored: "1% × €49/month",
      intelligenceApi: "20 × €199/month",
    },
    {
      scenario: "European network",
      marketplace: "8% × €20/month",
      sponsored: "2% × €79/month",
      intelligenceApi: "100 × €299/month",
    },
    {
      scenario: "Network scale",
      marketplace: "10% × €25/month",
      sponsored: "3% × €99/month",
      intelligenceApi: "400 × €399/month",
    },
  ],
} as const;

export const breakEvenFramework = {
  principle:
    "Do not invent a single break-even date before real cost telemetry and team budgets exist. Track the break-even equation transparently instead.",
  formula:
    "Monthly network contribution = total revenue − free-base variable cost − paid/usage variable cost − payment cost − support/moderation variable cost. Break-even occurs when this contribution covers fixed monthly operating expense.",
  requiredInputs: [
    "MAO and MAU by cohort",
    "Actual Supabase / Vercel / Railway / email cost per active organization",
    "AI cost by free, AI+ and high-usage cohort",
    "Storage and ingestion cost per organization",
    "Payment processing cost",
    "Support/moderation hours per 100 active organizations",
    "Actual module attach rate and blended paid ARPA",
    "Marketplace premium usage and take economics",
    "Sponsored visibility and intelligence/API revenue once launched",
    "Fixed product, engineering, data, legal and operating expense",
  ],
  investmentMessage:
    "The investable thesis is not that €39/month alone funds the company. It is that a low-friction industry network can aggregate professional attention, commercial workflows and transaction intent, creating several monetization layers on one shared distribution asset.",
} as const;

export const investorMilestones = [
  {
    stage: "Product-market utility",
    evidence:
      "Organizations repeatedly use Free Workspace / Memory / Network without assisted onboarding.",
  },
  {
    stage: "Product-led monetization",
    evidence:
      "At least 5 self-service payers, then measurable free→paid attach and 60/90-day retention.",
  },
  {
    stage: "Network density",
    evidence:
      "Growing MAO/MAU, verified company graph, follows/relationships and repeated cross-company discovery.",
  },
  {
    stage: "Marketplace liquidity",
    evidence:
      "Demand receives relevant supplier response often enough that premium marketplace actions become optional monetizable value.",
  },
  {
    stage: "Revenue diversification",
    evidence:
      "At least three independent income streams contribute recurring revenue without weakening trust or Free Base utility.",
  },
  {
    stage: "Scalable economics",
    evidence:
      "Measured variable cost and support load stay inside guardrails while revenue/MAO and contribution margin improve with scale.",
  },
] as const;

export const buyerPersonas = [
  {
    persona: "Sales Director / Direttore Commerciale",
    pain:
      "Visibilità frammentata su trattative, attività dei commerciali, account dormienti e memoria prezzi.",
    outcome:
      "Controllo commerciale, riuso della conoscenza aziendale e migliore conversione senza introdurre un CRM generico pesante.",
  },
  {
    persona: "Commerciale / Area Manager",
    pain:
      "Tempo perso tra email, PDF, Excel e memoria personale per ricostruire clienti, prezzi, offerte e contesto.",
    outcome:
      "Risposte più rapide, follow-up più informato e ricerca immediata della storia commerciale.",
  },
  {
    persona: "Owner / Sales-led SME",
    pain:
      "Conoscenza commerciale concentrata in poche persone e processi poco trasferibili.",
    outcome:
      "Memoria aziendale strutturata, network più ampio e maggiore resilienza organizzativa.",
  },
] as const;

export const jobsToBeDone = [
  "Quando arriva una nuova RFQ, voglio sapere immediatamente cosa abbiamo già quotato, a chi, quando e a che prezzo.",
  "Quando un cliente torna dopo mesi, voglio ricostruire il contesto senza cercare manualmente in mailbox e cartelle.",
  "Quando il pipeline rallenta, voglio individuare domanda dormiente e account da riattivare.",
  "Quando cerco un nuovo supplier o buyer, voglio partire da aziende industrialmente pertinenti e identità affidabili.",
  "Quando emerge una domanda reale, voglio distribuirla a supplier compatibili senza perdere controllo su privacy e relazione commerciale.",
] as const;

export const differentiation = [
  {
    title: "Vertical data model",
    body:
      "RFQ, offer, order, product, grade, standard, dimension and company relationships are modeled for steel/tube workflows rather than adapted from a generic CRM.",
  },
  {
    title: "Two knowledge layers",
    body:
      "Private company memory stays tenant-isolated while public technical and company-network knowledge becomes a distribution asset.",
  },
  {
    title: "Network identity + trust",
    body:
      "Claim, verification, provenance and company taxonomy create a governed industry graph rather than a scraped directory.",
  },
  {
    title: "Demand-to-response loop",
    body:
      "Marketplace connects the network to structured demand, enabling a path from discovery to governed commercial response.",
  },
] as const;

export const evidenceLedger = [
  {
    label: "Product hardening",
    status: "Completed",
    detail: "HP1–HP18 + L27.1 complete; production journey and release gates are green.",
  },
  {
    label: "Market structure evidence",
    status: "Completed",
    detail:
      "L27.2A.1 now anchors the first ICP decision in ASSOFERMET, EUROMETAL, Federacciai, EUROFER, ISTAT and Eurostat evidence.",
  },
  {
    label: "ICP / value proposition",
    status: "In progress",
    detail:
      "Distributor-first is an evidence-supported hypothesis. L27.2A.2 now fixes the primary-interview sample, scoring rubric and objective validation / rejection thresholds before any interviews are counted.",
  },
  {
    label: "Pricing / packaging",
    status: "In progress",
    detail:
      "L27.2B.3 resets monetization around a permanent Free Base, optional low-cost modules and self-service conversion. The previous sales-led pilot/Core/Pro framework is superseded."
  },
  {
    label: "Unit economics",
    status: "In progress",
    detail:
      "L27.2C reframes economics around network scale: free-user cost ceilings, product-led paid attach, multiple income streams and transparent scenario sensitivity. Production telemetry is still required before the model is validated.",
  },
  {
    label: "Commercial evidence",
    status: "Pre-launch",
    detail: "L27.5 / P5.6C–E will validate activation, self-service upgrades, paid retention, Marketplace liquidity and product-led expansion with real companies.",
  },
] as const;

export const businessPlanRoadmap = [
  { code: "L27.2A.1", title: "ICP Evidence & Market Segmentation", status: "Completed" },
  { code: "L27.2A.2", title: "ICP Interview & Validation Framework", status: "Framework completed" },
  { code: "L27.2B.1", title: "Packaging Boundary & Value Metric Validation", status: "Superseded" },
  { code: "L27.2B.2", title: "Sales-led Offer & WTP Framework", status: "Superseded" },
  { code: "L27.2B.3", title: "Freemium & Product-Led Pricing Reset", status: "Completed" },
  { code: "L27.2C", title: "Network Economics & Multi-Stream Financial Model", status: "Completed" },
  { code: "L27.2D", title: "Business Plan v2 Consolidation", status: "Active" },
] as const;
