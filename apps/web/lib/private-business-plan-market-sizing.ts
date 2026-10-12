/**
 * BP-MKT1 — Confidential, hypothesis-driven SaaS market model.
 * These are NOT registered/verified unique counts from our network crawler.
 * Update the cohorts only after a dated, deduplicated organization census.
 *
 * Source universes differ: Orgalim's EU technology companies are not the
 * same as ASSOFERMET's Italian customer-company count. They are never added.
 */
export const marketModelVersion = "BP-MKT1 · 12 October 2026";

export const sourceLedger = [
  {
    label: "ASSOFERMET Acciai · member companies",
    number: 144,
    unit: "companies",
    geography: "Italy",
    url: "https://www.assofermet.it/settore-acciai",
    limitation: "Association members; around 80% of distribution volume, NOT 80% of company count.",
  },
  {
    label: "Federacciai · member companies",
    number: 130,
    unit: "companies",
    geography: "Italy",
    url: "https://federacciai.it/profilo-e-storia/",
    limitation: "Production/transformation association membership, not a census; can overlap other lists.",
  },
  {
    label: "ASSOFERMET · distributor customers",
    number: 160000,
    unit: "minimum customer companies",
    geography: "Italy",
    url: "https://www.assofermet.it/source/Brochure/brochure_assofermet.pdf",
    limitation: "Brochure states OVER 160k customers, broad sectors; 160k is a conservative reference floor, not unique verified SSS ICPs.",
  },
  {
    label: "Federmeccanica · represented companies",
    number: 14000,
    unit: "approximate companies",
    geography: "Italy",
    url: "https://www.federmeccanica.it/chi-siamo.html",
    limitation: "Industrial adjacency with overlaps; not added to downstream universe.",
  },
  {
    label: "EUROMETAL · federation represented companies",
    number: 3500,
    unit: "approximate companies",
    geography: "Europe",
    url: "https://eurometal.net/membership/",
    limitation: "Distributor/trader/service-centre footprint, association-based, may overlap with Italy.",
  },
  {
    label: "Ceemet · represented companies",
    number: 200000,
    unit: "more than represented companies",
    geography: "Europe",
    url: "https://ceemet.org/about/",
    limitation: "Metal/engineering/technology membership, broad and overlapping; context only.",
  },
  {
    label: "Orgalim · technology industry companies",
    number: 770000,
    unit: "companies",
    geography: "Europe",
    url: "https://orgalim.eu/en/",
    limitation: "Mechanical, electrical, electronic, ICT and metal technology firms: many are NOT recurring steel-RFQ software buyers.",
  },
] as const;

export const marketModelInputs = {
  italianBroadOrganizations: 160000,
  europeanBroadOrganizations: 770000,
  italianRelevantShare: 0.15,
  italianServiceableShare: 0.40,
  europeanRelevantShare: 0.15,
  usersPerActivatedOrganization: 2.5,
  modulePriceEurPerOrganizationMonth: 15,
  plusPriceEurPerOrganizationMonth: 39,
  moduleShareAmongPayers: 0.40,
  plusShareAmongPayers: 0.60,
  windowMonths: 36,
} as const;

export const somHypotheses = [
  { key: "cautious", labelIt: "Prudente", labelEn: "Cautious", activatedShareOfSam: 0.08, paidShareOfActivated: 0.08 },
  { key: "base", labelIt: "Base", labelEn: "Base", activatedShareOfSam: 0.20, paidShareOfActivated: 0.12 },
  { key: "upside", labelIt: "Ambizioso", labelEn: "Upside", activatedShareOfSam: 0.35, paidShareOfActivated: 0.18 },
] as const;

const round = (n: number) => Math.round(n);

export function calculateMarketModel(
  inputs: {
    italianBroadOrganizations: number;
    europeanBroadOrganizations: number;
    italianRelevantShare: number;
    italianServiceableShare: number;
    europeanRelevantShare: number;
    usersPerActivatedOrganization: number;
    modulePriceEurPerOrganizationMonth: number;
    plusPriceEurPerOrganizationMonth: number;
    moduleShareAmongPayers: number;
    plusShareAmongPayers: number;
    windowMonths: number;
  } = marketModelInputs,
) {
  if (Math.abs(inputs.moduleShareAmongPayers + inputs.plusShareAmongPayers - 1) > 1e-9) {
    throw new Error("Paid module and Plus mix must sum to 100%.");
  }
  if ([inputs.italianRelevantShare, inputs.italianServiceableShare, inputs.europeanRelevantShare,
       inputs.moduleShareAmongPayers, inputs.plusShareAmongPayers].some((value) => value < 0 || value > 1)) {
    throw new Error("Share inputs must be between 0 and 1.");
  }

  // Company-based billing: employees using a paid org's account aren't billed
  // again. Users are an adoption indicator, NEVER an ARR multiplier.
  const paidArpaMonthly = inputs.moduleShareAmongPayers * inputs.modulePriceEurPerOrganizationMonth
    + inputs.plusShareAmongPayers * inputs.plusPriceEurPerOrganizationMonth;
  const monthlyPriceCents = Math.round(paidArpaMonthly * 100);
  const annualValuePerPayingOrganization = monthlyPriceCents * 12 / 100;
  const annualSpend = (organizations: number) => Math.round(organizations * monthlyPriceCents * 12) / 100;
  const monthlySpend = (organizations: number) => Math.round(organizations * monthlyPriceCents) / 100;

  const euroEligibleOrganizations = round(inputs.europeanBroadOrganizations * inputs.europeanRelevantShare);
  const italianEligibleOrganizations = round(inputs.italianBroadOrganizations * inputs.italianRelevantShare);
  const italianSamOrganizations = round(italianEligibleOrganizations * inputs.italianServiceableShare);

  const som = somHypotheses.map((scenario) => {
    const activatedOrganizations = round(italianSamOrganizations * scenario.activatedShareOfSam);
    const payingOrganizations = round(activatedOrganizations * scenario.paidShareOfActivated);
    return {
      ...scenario,
      activatedOrganizations,
      payingOrganizations,
      estimatedActiveUsers: round(activatedOrganizations * inputs.usersPerActivatedOrganization),
      usersWithinPayingOrganizations: round(payingOrganizations * inputs.usersPerActivatedOrganization),
      mrrEur: monthlySpend(payingOrganizations),
      arrEur: annualSpend(payingOrganizations),
    };
  });
  return {
    paidArpaMonthly,
    annualValuePerPayingOrganization,
    tam: {
      scope: "EU industrial technology proxy, filtered by steel-RFQ fit",
      organizations: euroEligibleOrganizations,
      potentialUsers: round(euroEligibleOrganizations * inputs.usersPerActivatedOrganization),
      annualSoftwareSpendCeilingEur: annualSpend(euroEligibleOrganizations),
    },
    italyQualified: {
      organizations: italianEligibleOrganizations,
      potentialUsers: round(italianEligibleOrganizations * inputs.usersPerActivatedOrganization),
    },
    sam: {
      scope: "Italy first; relevant organizations multiplied by delivery/geographic reach",
      organizations: italianSamOrganizations,
      potentialUsers: round(italianSamOrganizations * inputs.usersPerActivatedOrganization),
      annualSoftwareSpendCeilingEur: annualSpend(italianSamOrganizations),
    },
    som,
  };
}

export const marketModelGovernance = {
  classification: "PRIVATE · PLATFORM SUPERADMIN ONLY",
  confidence: "LOW · model, not audited company census",
  economicBasis: "Only recurring SaaS modules: Marketplace premium, advertising, lead fees, enterprise/API, VAT and churn excluded.",
  tamCaveat: "The EU Orgalim sector basket is broader than Italy's ASSOFERMET distribution customers. They are different evidence universes, NOT a strictly nested census.",
  formula: "Potential paid ARR = organizations × weighted € / organization / month × 12; SOM activated orgs = SAM × activation; paying orgs = activated × paid attach.",
  calibration: [
    "Deduplicate crawler profiles by normalized VAT/tax ID, legal entity and group; exclude inactive and ambiguous entities.",
    "Map producers / traders / processors / industrial users with ISTAT ATECO and province evidence; do not equate plants with legal companies.",
    "Use RFQ frequency, operational fit and explicit consent/engagement to replace 15% industry-fit assumption.",
    "Validate sellable reach using real acquisition channels, claimed companies and pilot conversion instead of assuming 40% reach is measured.",
    "Run willingness-to-pay at €15 modules and €39 bundle in segmented, consented pilots; observe 30/60/90-day retention and AI/cloud unit costs.",
    "Replace 2.5 users/company assumption with actual active seat distribution and report company payers separately from employees/users.",
    "Reconcile EU/Italy region scopes and overlaps; no addition of Orgalim, Ceemet, EUROMETAL and Italian memberships.",
    "Version and date all sources and scenarios; update the investment deck only after owner validation.",
  ],
} as const;
