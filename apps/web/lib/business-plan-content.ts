export const BUSINESS_PLAN_VERSION = "Investor Draft 0.1";

export const businessPlanSnapshot = {
  stage: "Product-ready web SaaS",
  currentFocus: "Business & Market Build",
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

export const icpSegments = [
  {
    rank: 1,
    fit: "Primary ICP",
    segment: "Commercianti / stockholder di tubi e acciaio",
    whyNow:
      "High volume of quotations, email-driven commercial history, repeat customers, price memory and frequent supplier/buyer discovery.",
    coreJobs: [
      "Recuperare rapidamente prezzi, offerte e trattative precedenti.",
      "Trasformare RFQ e email in memoria commerciale interrogabile.",
      "Riattivare domanda dormiente e seguire opportunità.",
      "Trovare supplier e buyer pertinenti senza perdere contesto.",
    ],
    valueProposition:
      "Un unico workspace commerciale verticale che trasforma anni di email e offerte in memoria operativa e nuove opportunità.",
    validationStatus: "Working hypothesis",
  },
  {
    rank: 2,
    fit: "High-fit ICP",
    segment: "Produttori di tubi e prodotti steel",
    whyNow:
      "Sales teams manage many accounts, product scopes and price histories; Network and Marketplace add distribution reach.",
    coreJobs: [
      "Consolidare memoria di clienti, prodotti, RFQ e offerte.",
      "Aumentare visibilità su domanda e account dormienti.",
      "Rendere più veloce la ricerca commerciale interna.",
      "Ricevere opportunità compatibili con capability e gamma.",
    ],
    valueProposition:
      "Commercial intelligence verticale per sales team industriali, collegata a un network e a domanda qualificata.",
    validationStatus: "Working hypothesis",
  },
  {
    rank: 3,
    fit: "Focused ICP",
    segment: "Terzisti / processor / service provider",
    whyNow:
      "Need to surface capabilities, be discovered by industrial buyers and manage recurring quote history.",
    coreJobs: [
      "Essere trovati per capability specifiche.",
      "Gestire richieste e storico quotazioni.",
      "Collegarsi a buyer e commercianti rilevanti.",
    ],
    valueProposition:
      "Più discovery qualificata e meno dispersione nella gestione commerciale delle lavorazioni.",
    validationStatus: "Working hypothesis",
  },
  {
    rank: 4,
    fit: "Secondary ICP",
    segment: "Utilizzatori industriali",
    whyNow:
      "Strong buyer-side value in supplier discovery, technical knowledge and Marketplace, but lower initial fit for the full sales-memory wedge.",
    coreJobs: [
      "Trovare supplier affidabili e compatibili.",
      "Pubblicare domanda strutturata.",
      "Confrontare risposta commerciale e capability.",
      "Accedere a riferimenti tecnici steel/tube.",
    ],
    valueProposition:
      "Un punto unico per discovery, domanda e conoscenza tecnica, con accesso graduale alle funzioni commerciali.",
    validationStatus: "Working hypothesis",
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
    label: "ICP / value proposition",
    status: "In progress",
    detail: "L27.2A working hypotheses documented; external validation still required.",
  },
  {
    label: "Pricing / packaging",
    status: "Next",
    detail: "L27.2B will define what is free, paid, seat-based or usage/credit-based.",
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
  { code: "L27.2A", title: "ICP & Value Proposition", status: "Active" },
  { code: "L27.2B", title: "Packaging & Pricing Architecture", status: "Next" },
  { code: "L27.2C", title: "Unit Economics & Financial Model", status: "Next" },
  { code: "L27.2D", title: "Business Plan v2 Consolidation", status: "Next" },
] as const;
