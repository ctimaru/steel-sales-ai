export const BUSINESS_PLAN_VERSION = "Investor Draft 0.5";

export const businessPlanSnapshot = {
  stage: "Product-ready web SaaS",
  currentFocus: "Packaging boundary & value metric validation",
  launchWindow: "2027 controlled launch",
  thesis:
    "Smart Steel Sales is the vertical commercial operating system for the steel and tube industry: private commercial memory, trusted industry network, demand marketplace and technical knowledge in one governed product.",
} as const;

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
  preferredModel: "Organization subscription + included seats + optional usage layer",
  rationale: [
    "The core asset is company memory and shared context, so value accrues at organization level rather than only per individual seat.",
    "Included seats reduce the adoption penalty that pure per-seat pricing creates when a Sales Director wants the whole team using the same memory.",
    "Additional seats remain useful as a scaling lever without becoming the primary value metric.",
    "Marketplace credits can later become a separate usage layer after supplier-response value is proven.",
    "Public Scuola and basic Network identity should remain free to preserve acquisition and network-density loops.",
  ],
  rejectedForNow: [
    "Pure per-seat pricing as the only model.",
    "Pure Marketplace success fee before transaction attribution and marketplace liquidity are proven.",
    "Unlimited AI/ingestion promises before unit economics are measured in L27.2C.",
  ],
} as const;

export const packagingBoundaryDecision = {
  status: "Architecture decision · customer validation pending",
  principle:
    "Keep public discovery and network-density loops open; start the paid boundary when a company activates private Commercial Memory and expects persistent, shared, governed commercial intelligence.",
  boundaries: [
    {
      transition: "Free → Core",
      trigger: "Private company memory becomes operational",
      paidValue:
        "Connect/import private commercial data, persist it as organization memory, search historical email/RFQ/offer context and share it across the sales team.",
      staysOutside:
        "Public Scuola, technical calculators, company identity/claim, basic Network discovery/follow and limited Marketplace visibility remain open.",
      reason:
        "The first durable economic value is not profile visibility; it is turning proprietary commercial history into reusable company infrastructure.",
    },
    {
      transition: "Core → Pro",
      trigger: "Coordination and management complexity increases",
      paidValue:
        "Larger included team envelope, advanced analytics, automation, governance and higher AI/ingestion allowances.",
      staysOutside:
        "Core Commercial Memory jobs stay usable in Core; Pro must not be created by artificially withholding basic historical search or daily RFQ context.",
      reason:
        "The second tier should monetize organizational complexity and management value, not punish successful adoption of the core workflow.",
    },
    {
      transition: "Pro → Enterprise",
      trigger: "Security, integration and procurement requirements become material",
      paidValue:
        "Custom integration/API scope, SSO or advanced security where available, contractual support, dedicated onboarding and negotiated usage envelope.",
      staysOutside:
        "Standard product workflows remain standardized; bespoke requirements are not silently absorbed into lower tiers.",
      reason:
        "Enterprise value is created by governance, integration depth and deployment complexity rather than by a cosmetic feature bundle.",
    },
  ],
} as const;

export const valueMetricDecision = {
  primaryMetric: "Organization subscription anchored to active private Commercial Memory",
  status: "Preferred value metric · directional validation required",
  why:
    "Commercial Memory compounds across the company: prior quotes, relationships, pricing context and account history remain valuable when users change. Pricing the organization captures that shared asset better than charging for each individual action.",
  secondaryLevers: [
    {
      metric: "Included seats + additional seats",
      role: "Expansion lever",
      rule:
        "Use seats to reflect larger team scale after a useful included-user envelope; do not make every invited colleague a new purchasing decision.",
    },
    {
      metric: "AI / ingestion / storage allowance",
      role: "Cost guardrail",
      rule:
        "Use fair-use envelopes to protect gross margin and infrastructure capacity. Do not make normal retrieval of company memory feel like a taxi meter.",
    },
    {
      metric: "Marketplace unlock / response credits",
      role: "Future transaction-value layer",
      rule:
        "Keep separate from the core subscription until L27.5/P5.6 demonstrates recurring qualified supplier-response value and attribution.",
    },
    {
      metric: "Onboarding / migration services",
      role: "Potential one-time fee",
      rule:
        "Price only against measured setup/import effort in L27.2C; never use onboarding as an arbitrary margin surcharge.",
    },
  ],
  doNotMeter: [
    "Searches of the customer's own commercial history.",
    "Number of customers, contacts, RFQs or offers stored during normal use.",
    "Basic company-profile and Network discovery actions that support network density.",
    "Routine collaboration inside the included-user envelope.",
  ],
} as const;

export const valueMetricAlternatives = [
  {
    candidate: "Organization + included users",
    decision: "Preferred",
    valueAlignment:
      "Matches the shared company-memory asset and keeps adoption friction low while preserving seat-based expansion.",
  },
  {
    candidate: "Pure per-seat",
    decision: "Secondary only",
    valueAlignment:
      "Easy to understand but misaligned when value increases because knowledge is shared across the team; can discourage inviting the people required for memory completeness.",
  },
  {
    candidate: "Pure AI / usage consumption",
    decision: "Reject as headline metric",
    valueAlignment:
      "Tracks infrastructure consumption better than customer value, makes spend less predictable and can suppress the very usage that creates retention.",
  },
  {
    candidate: "Marketplace success fee / credits only",
    decision: "Premature",
    valueAlignment:
      "Could align with transaction value later, but liquidity, attribution and recurring supplier-response value are not yet commercially proven.",
  },
] as const;

export const packagingBoundaryValidationGate = {
  evidenceRequired: [
    "Present the same organization-level Core framing to target distributor companies; do not switch to seat-only pricing mid-test just to remove objections.",
    "Record which boundary creates confusion: private memory, included users, usage allowances, Pro differentiation or Marketplace credits.",
    "Count procurement progression, paid-pilot acceptance and concrete budget discussion above stated preference.",
    "Capture disconfirming evidence from companies that believe core private Commercial Memory should be free or that insist on a fundamentally different value metric.",
  ],
  directionalPassSignals: [
    "At least 3 distinct beachhead companies progress toward a paid pilot, procurement step or budget-owner discussion under an organization-level offer.",
    "Organization + included users is understandable without a recurring request to reframe the entire offer as pure per-seat pricing.",
    "Core buyers identify private Commercial Memory as the paid wedge rather than expecting it inside the free Network layer.",
    "Pro differentiation is not published as a final tier until at least 2 target companies independently value analytics, automation, governance or higher operational envelopes.",
  ],
  disconfirmSignals: [
    "A structural objection appears in >=40% of completed beachhead companies that the organization metric does not match how they budget or perceive value.",
    "A structural objection appears in >=40% of completed beachhead companies that private Commercial Memory belongs in the free layer.",
    "Customers repeatedly ask to meter only individual AI actions because shared organization value is not perceived.",
    "Marketplace economics become the only credible reason to pay before Commercial Memory produces a buying signal.",
  ],
  decisionRule:
    "B.1 fixes the packaging architecture for testing, not final pricing. Mark the value metric commercially validated only after real offer behaviour clears the directional pass signals without a structural disconfirmation signal.",
} as const;

export const pricingHypotheses = [
  {
    name: "Free Network",
    price: "€0",
    audience: "Any claimed or discoverable company",
    purpose: "Acquisition + network density",
    includes: [
      "Public Scuola and technical calculators",
      "Company profile / claim foundation",
      "Network browse, follow and basic discovery",
      "Limited Marketplace visibility",
    ],
    excludes: [
      "Private Commercial Memory",
      "Historical email/RFQ intelligence",
      "Advanced team analytics and automations",
    ],
    status: "Structural hypothesis",
  },
  {
    name: "Core",
    price: "Test band €299–€399 / organization / month",
    audience: "Small-to-mid distributor sales teams",
    purpose: "Primary paid wedge",
    includes: [
      "3–5 commercial users included",
      "Commercial Memory",
      "Email/RFQ ingestion and historical search",
      "Customer/contact/RFQ/offer workspace",
      "Network and company intelligence",
      "Baseline AI query allowance",
    ],
    excludes: [
      "Advanced admin/security/integration package",
      "High-volume AI/ingestion",
      "Enterprise SLA",
    ],
    status: "Primary pricing hypothesis",
  },
  {
    name: "Pro",
    price: "Test band €649–€799 / organization / month",
    audience: "Larger distributor teams and second-stage producers",
    purpose: "Expansion + higher operational value",
    includes: [
      "8–10 users included",
      "Higher ingestion and AI allowances",
      "Advanced team/commercial analytics",
      "Automation and governance features",
      "Priority support",
      "Initial Marketplace response/unlock allowance if validated",
    ],
    excludes: [
      "Bespoke enterprise integrations",
      "Dedicated SLA / SSO package unless separately contracted",
    ],
    status: "Expansion pricing hypothesis",
  },
  {
    name: "Enterprise",
    price: "Custom; working floor from ~€1,250/month",
    audience: "Multi-team producers, large distributors and complex groups",
    purpose: "Governance + integration + scale",
    includes: [
      "Custom seat/usage envelope",
      "SSO / advanced security when available",
      "API and integration scope",
      "Dedicated onboarding / success plan",
      "Contractual support and governance",
    ],
    excludes: [],
    status: "Do not publish before enterprise discovery",
  },
] as const;

export const pricingExperimentBands = [
  {
    test: "Paid design-partner pilot",
    offer: "€199/month for 90 days, up to 3 users; onboarding waived",
    goal:
      "Test whether real companies will pay something now rather than accept a free pilot. Success requires usage plus a paid conversion discussion.",
  },
  {
    test: "Core anchor",
    offer: "€349/month, 5 users included; extra users tentatively €39/month",
    goal:
      "Test organization-level willingness-to-pay against familiar CRM alternatives while preserving team adoption.",
  },
  {
    test: "Pro anchor",
    offer: "€749/month, 10 users included",
    goal:
      "Test whether analytics, automation, governance and higher usage limits create a meaningful second tier.",
  },
] as const;

export const pricingDecisionRules = [
  "Do not call any price validated based on the synthetic cohort.",
  "Prefer offer acceptance, paid pilot or procurement progression over direct 'what would you pay?' answers.",
  "Core price is viable only if customers perceive Commercial Memory as organization-wide infrastructure rather than a personal productivity tool.",
  "If teams strongly resist €349/month but accept €199 paid pilots, keep value scope constant and investigate proof/ROI before cutting list price.",
  "If real customers accept €349–€399 with little friction, test higher value before optimizing downward.",
  "Marketplace credits remain optional until P5.6/L27.5 proves supplier-response value and recurring usage.",
  "Onboarding fees should reflect real setup/import work measured in L27.2C, not become an arbitrary margin lever.",
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
      "L27.2B.1 now fixes the free/paid boundary and organization-level primary value metric for testing. Pricing and packaging remain commercially unvalidated until real paid behaviour or procurement progression is observed.",
  },
  {
    label: "Unit economics",
    status: "Next",
    detail: "L27.2C will quantify infrastructure, AI, support, CAC and margin assumptions.",
  },
  {
    label: "Commercial evidence",
    status: "Pre-launch",
    detail: "L27.5 / P5.6C–E will validate usage, friction and willingness-to-pay with real companies.",
  },
] as const;

export const businessPlanRoadmap = [
  { code: "L27.2A.1", title: "ICP Evidence & Market Segmentation", status: "Completed" },
  { code: "L27.2A.2", title: "ICP Interview & Validation Framework", status: "Framework completed" },
  { code: "L27.2B.1", title: "Packaging Boundary & Value Metric Validation", status: "Active" },
  { code: "L27.2B.2", title: "Offer & Willingness-to-Pay Validation", status: "Next" },
  { code: "L27.2C", title: "Unit Economics & Financial Model", status: "Next" },
  { code: "L27.2D", title: "Business Plan v2 Consolidation", status: "Next" },
] as const;
