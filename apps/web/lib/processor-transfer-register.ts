export const PROCESSOR_TRANSFER_REGISTER_VERSION = "2026-10-05-lr6-v1";

export type ProcessorLaunchState =
  | "approved-baseline"
  | "approved-with-transfer"
  | "conditional"
  | "blocked-for-customer-personal-data"
  | "operational-only";

export type ProcessorTransferEntry = {
  id: string;
  provider: string;
  service: string;
  role: string;
  activityIds: string[];
  dataCategories: string[];
  productionConfiguration: string;
  primaryProcessingLocation: string;
  transferMechanism: string;
  dpaStatus: string;
  subprocessorStatus: string;
  retention: string;
  launchState: ProcessorLaunchState;
  publicSummary: string;
  openActions: string[];
  officialSources: string[];
};

export const PROCESSOR_TRANSFER_REGISTER: ProcessorTransferEntry[] = [
  {
    id: "LR6-P01",
    provider: "Supabase",
    service: "PostgreSQL, Auth, Storage and Edge Functions",
    role: "processor / subprocessor depending on Smart Steel Sales role",
    activityIds: [
      "LR3-A02","LR3-A03","LR3-A04","LR3-A05","LR3-A06","LR3-A08",
      "LR3-A09","LR3-A10","LR3-A11"
    ],
    dataCategories: [
      "account and authentication data",
      "company registration and claim data",
      "Network and Marketplace data",
      "Commercial Memory stored data",
      "audit and governance records",
    ],
    productionConfiguration: "Production project region verified as eu-west-3 (Paris).",
    primaryProcessingLocation: "EEA primary storage/processing region selected: Paris, France; provider/subprocessor access may occur elsewhere under the DPA.",
    transferMechanism: "Supabase DPA; EU SCC Module 2 or 3 for restricted transfers, as applicable.",
    dpaStatus: "Published DPA verified; retain account-specific executed/accepted evidence before paid launch.",
    subprocessorStatus: "Published list with change-notification mechanism; subscription to updates required.",
    retention: "Product retention is controlled by Smart Steel Sales; provider operational/support retention remains subject to Supabase terms and service configuration.",
    launchState: "approved-baseline",
    publicSummary: "Database, authentication and storage are hosted primarily in the EU region selected for the production project. International access may occur under contractual safeguards.",
    openActions: [
      "retain evidence of the applicable DPA in the legal register",
      "subscribe to subprocessor-change notifications",
      "review any support feature that could move customer data outside the selected region",
    ],
    officialSources: [
      "https://supabase.com/legal/customer-resources/data-processing-addendum",
      "https://supabase.com/legal/customer-resources/subprocessor-list",
    ],
  },
  {
    id: "LR6-P02",
    provider: "Vercel",
    service: "Next.js hosting, edge/network delivery and server-side web runtime",
    role: "processor for Customer Data; separate controller roles may apply to service-generated/contact data under provider terms",
    activityIds: ["LR3-A01","LR3-A02","LR3-A03","LR3-A04","LR3-A05","LR3-A06","LR3-A07","LR3-A09","LR3-A11","LR3-A12"],
    dataCategories: [
      "technical request data",
      "session-bound server requests",
      "registration/account request payloads handled by server routes",
      "application logs and service-generated metadata",
    ],
    productionConfiguration: "Production deployment verified READY on Vercel; project plan/DPA eligibility cannot be read with the current connector authorization.",
    primaryProcessingLocation: "Vercel states primary processing facilities are in the United States and infrastructure may use AWS, Azure and GCP globally.",
    transferMechanism: "Vercel DPA provides SCC transfer mechanisms where applicable.",
    dpaStatus: "CONDITIONAL: current Vercel DPA states applicability to Enterprise and Pro plans. Account plan must be confirmed before paid commercial launch.",
    subprocessorStatus: "Published via Vercel Security/Trust Center; change notification requires subscription.",
    retention: "Customer Data can be exported/deleted during service use; post-termination deletion is described as within a commercially reasonable timeframe, subject to law.",
    launchState: "conditional",
    publicSummary: "Web hosting and delivery may involve processing in the United States and other locations under the provider's applicable contractual transfer safeguards.",
    openActions: [
      "confirm production account is on a plan covered by the current Vercel DPA",
      "retain DPA evidence",
      "subscribe to subprocessor notifications",
    ],
    officialSources: [
      "https://vercel.com/legal/dpa",
      "https://security.vercel.com",
    ],
  },
  {
    id: "LR6-P03",
    provider: "Railway",
    service: "FastAPI ingestion, parsing and Commercial Memory worker",
    role: "processor / subprocessor depending on Smart Steel Sales role",
    activityIds: ["LR3-A10","LR3-A11"],
    dataCategories: [
      "uploaded emails and documents",
      "customer/supplier contact data contained in tenant files",
      "RFQ, offer and order content",
      "worker operational logs",
    ],
    productionConfiguration: "Production worker deployment verified in Railway region sfo.",
    primaryProcessingLocation: "United States for the current worker deployment.",
    transferMechanism: "Railway DPA; EU SCCs and, where available/applicable, Data Privacy Framework mechanisms.",
    dpaStatus: "Published DPA verified; account-specific acceptance/evidence must be retained.",
    subprocessorStatus: "Current list published through Railway Trust Center with advance-change process.",
    retention: "Railway states unnecessary data is disposed of and customer content is purged/anonymized on account deletion; Smart Steel Sales must still enforce its own Commercial Memory lifecycle.",
    launchState: "approved-with-transfer",
    publicSummary: "The document-processing worker currently operates in the United States; the transfer is subject to the provider's contractual safeguards.",
    openActions: [
      "complete documented transfer-risk assessment for Commercial Memory",
      "evaluate migration of the production worker to an EU region before paid onboarding",
      "subscribe to subprocessor-change notifications where available",
    ],
    officialSources: [
      "https://railway.com/legal/dpa",
      "https://trust.railway.com/",
    ],
  },
  {
    id: "LR6-P04",
    provider: "Resend",
    service: "Transactional authentication and team-invitation email",
    role: "processor for customer email content; independent controller for its own account/billing/usage data under its policy",
    activityIds: ["LR3-A02","LR3-A05","LR3-A12"],
    dataCategories: ["recipient email address", "transactional message content", "delivery metadata"],
    productionConfiguration: "smartsteelsales.com verified; sending region eu-west-1; receiving disabled; open and click tracking disabled.",
    primaryProcessingLocation: "Email sending region is EU, but Resend states stored data is held in the United States.",
    transferMechanism: "Resend DPA incorporates EU SCCs; Resend also states participation in the EU-U.S. Data Privacy Framework.",
    dpaStatus: "Published/pre-signed DPA verified; signed account copy should be retained.",
    subprocessorStatus: "Published list; Resend states at least 14 days' notice for additions/replacements.",
    retention: "Resend states email/log data is retained 30 days on Free, Pro and Scale plans, backups 7 days, and remaining customer data deleted within 90 days after termination.",
    launchState: "approved-with-transfer",
    publicSummary: "Transactional email is sent from an EU sending region, while provider storage occurs in the United States under contractual transfer safeguards. Tracking is disabled.",
    openActions: ["download and retain the signed DPA from the Resend account Documents area"],
    officialSources: [
      "https://resend.com/legal/dpa",
      "https://resend.com/legal/subprocessors",
      "https://resend.com/security/gdpr",
    ],
  },
  {
    id: "LR6-P05",
    provider: "Google Analytics 4",
    service: "Consent-gated public website analytics",
    role: "processor for Google Analytics customer data under Google's Analytics processing terms, with separate controller contexts possible for configured data-sharing uses",
    activityIds: ["LR3-A07"],
    dataCategories: ["analytics identifiers", "public-site usage events", "technical request metadata"],
    productionConfiguration: "Loaded only after explicit analytics consent; private product routes excluded; no Smart Steel Sales user or organization ID intentionally sent.",
    primaryProcessingLocation: "Google may process/transfer data internationally, including transfers to the United States.",
    transferMechanism: "Google processing terms; EU-U.S. Data Privacy Framework where relied upon and SCCs for restricted transfers where applicable.",
    dpaStatus: "Provider processing terms verified; production property settings still require account-level confirmation.",
    subprocessorStatus: "Google contractual subprocessor framework applies to processor services.",
    retention: "Internal target is the minimum GA4 user/event retention setting of 2 months. Actual production property setting is not verifiable from the current toolset.",
    launchState: "conditional",
    publicSummary: "Public-site analytics runs only after consent. Google may process data internationally using its applicable transfer mechanisms.",
    openActions: [
      "verify GA4 property user/event retention is set to 2 months",
      "keep advertising/data-sharing integrations disabled unless separately assessed and consented",
      "retain evidence of applicable Google processing terms",
    ],
    officialSources: [
      "https://support.google.com/analytics/answer/3379636",
      "https://support.google.com/analytics/answer/6004245",
      "https://support.google.com/analytics/answer/7667196",
      "https://business.safety.google/adsdatatransfers/",
    ],
  },
  {
    id: "LR6-P06",
    provider: "Hugging Face Inference Providers",
    service: "External embedding and grounded RAG inference used by the worker",
    role: "routing/inference provider with downstream inference-provider processing",
    activityIds: ["LR3-A10"],
    dataCategories: [
      "tenant document chunks selected for embedding",
      "tenant evidence excerpts sent for grounded RAG generation",
    ],
    productionConfiguration: "HF_TOKEN, RAG_INFERENCE_PROVIDER and RAG_LLM_MODEL are configured in Railway production, but values are redacted to the current connector. Application code supports automatic/provider-specific routing.",
    primaryProcessingLocation: "UNRESOLVED until the production inference provider is pinned and its processing location is verified.",
    transferMechanism: "UNRESOLVED for the actual downstream inference provider.",
    dpaStatus: "UNRESOLVED for the current Inference Providers route. Hugging Face documents an Enterprise DPA for dedicated Inference Endpoints, but this does not establish the contractual chain for the currently configured routed provider.",
    subprocessorStatus: "Automatic routing can send requests to third-party inference providers whose own data/security policies apply.",
    retention: "Hugging Face states it does not store request/response bodies when routing and keeps debugging logs up to 30 days without user data/tokens; downstream provider retention remains provider-specific and unresolved.",
    launchState: "blocked-for-customer-personal-data",
    publicSummary: "External AI processing of customer personal data is not approved for commercial production until the exact inference provider, processing location and contractual safeguards are fixed.",
    openActions: [
      "pin the production inference provider instead of relying on automatic routing",
      "verify provider DPA/subprocessor chain and processing geography",
      "complete transfer-risk assessment",
      "prefer an EU-hosted or contractually controlled inference path for Commercial Memory",
    ],
    officialSources: [
      "https://huggingface.co/docs/inference-providers/en/security",
      "https://huggingface.co/docs/inference-providers/en/index",
      "https://huggingface.co/docs/inference-endpoints/security",
    ],
  },
  {
    id: "LR6-P07",
    provider: "GitHub",
    service: "Source control and CI/CD",
    role: "operational vendor; not approved as a customer-content processor in the product data path",
    activityIds: [],
    dataCategories: ["source code", "test fixtures", "CI metadata"],
    productionConfiguration: "Repository/CI only. Customer Commercial Memory and production personal data must not be committed to the repository.",
    primaryProcessingLocation: "Operational vendor locations; out of the customer-data production path by policy.",
    transferMechanism: "Not relied upon for customer personal-data processing in the LR6 baseline.",
    dpaStatus: "Not required for the declared no-customer-data scope; reassess if production personal data is introduced.",
    subprocessorStatus: "Out of scope for current customer-data path.",
    retention: "Repository/CI retention follows engineering policy and vendor account settings.",
    launchState: "operational-only",
    publicSummary: "Not part of the customer personal-data production path.",
    openActions: ["maintain secret scanning and prohibit production/customer datasets in repository fixtures"],
    officialSources: ["https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"],
  },
  {
    id: "LR6-P08",
    provider: "Notion",
    service: "Internal product/business documentation",
    role: "operational vendor; not approved as a customer-content processor in the product data path",
    activityIds: [],
    dataCategories: ["roadmap", "engineering and legal readiness documentation"],
    productionConfiguration: "Used as internal project OS. Customer Commercial Memory must not be copied into Notion as part of normal operations.",
    primaryProcessingLocation: "Operational vendor locations; out of the customer-data production path by policy.",
    transferMechanism: "Not relied upon for customer personal-data processing in the LR6 baseline.",
    dpaStatus: "Reassess only if customer personal data is intentionally stored there.",
    subprocessorStatus: "Out of scope for current customer-data path.",
    retention: "Workspace retention follows internal documentation policy and vendor account configuration.",
    launchState: "operational-only",
    publicSummary: "Not part of the customer personal-data production path.",
    openActions: ["keep customer documents, inbox content and exported account data out of the project workspace"],
    officialSources: ["https://www.notion.so/help/security-and-privacy"],
  },
];

export const LR6_ACTIVITY_PROCESSOR_COVERAGE = Object.fromEntries(
  PROCESSOR_TRANSFER_REGISTER.flatMap((entry) =>
    entry.activityIds.map((activityId) => [activityId, entry.id] as const),
  ),
);

export const LR6_COMMERCIAL_LAUNCH_BLOCKERS = PROCESSOR_TRANSFER_REGISTER.filter(
  (entry) =>
    entry.launchState === "blocked-for-customer-personal-data" ||
    entry.launchState === "conditional",
);
