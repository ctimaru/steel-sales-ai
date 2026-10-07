export const investorOutreachPack = {
  positioning:
    "Smart Steel Sales is building the vertical Commercial OS for steel & tube: commercial memory, multi-supplier procurement workflows and an industrial company graph in one governed platform.",
  idealInvestor: [
    "B2B SaaS / vertical software investors",
    "Industrial-tech and procurement workflow investors",
    "European Seed funds comfortable with pre-launch / early pilot evidence",
    "Investors who value founder-market fit and capital-efficient product execution",
  ],
  disqualifiers: [
    "Requires material ARR before first conversation",
    "Consumer-only thesis",
    "Pure AI-wrapper thesis with no interest in vertical workflow/data moat",
    "Mandate incompatible with Italy-first / Europe expansion",
  ],
  templates: [
    {
      key: "intro",
      label: "Warm intro",
      subject: "Smart Steel Sales — vertical Commercial OS for steel & tube",
      body: `Hi {Name},

I'm building Smart Steel Sales, a vertical Commercial OS for companies buying and selling steel & tube.

The product combines commercial memory, multi-supplier RFQ/procurement workflows and an industrial company graph. We are pre-launch and moving into pilot validation, with a production-oriented multi-module product already built.

I'm opening a small number of investor conversations around a €1.0M working Seed target to fund roughly 24 months of evidence: paid conversion, retention, repeatable GTM and network liquidity.

If the thesis is relevant for you, I can share our confidential Investor Room and 14-slide deck.

Best,
Claudiu`,
    },
    {
      key: "cold",
      label: "Cold outreach",
      subject: "Steel & tube software — pre-launch Seed conversation",
      body: `Hi {Name},

I'm reaching out because your investment focus appears relevant to Smart Steel Sales.

We are building a vertical B2B platform for the steel & tube value chain: private commercial memory, RFQ/procurement workflows, pricing intelligence and a governed industrial network.

The wedge is workflow utility first; the network/data advantage compounds with use. We are still pre-launch, so we explicitly separate shipped product from traction.

We are preparing a €1.0M working Seed raise to validate paid adoption, retention and a repeatable Italy-to-Europe GTM.

Would a short introductory call be relevant?

Best,
Claudiu`,
    },
    {
      key: "follow-up",
      label: "Post-meeting follow-up",
      subject: "Smart Steel Sales — materials and next step",
      body: `Hi {Name},

Thank you for the conversation.

As discussed, I'm sharing the Smart Steel Sales Investor Room. It contains the governed deck, Business Plan and KPI view according to the access scope assigned to your invite.

The core point remains simple: we have built substantial product infrastructure, but we do not present pre-launch activity as traction. The next financing milestone is to convert product readiness into measurable paid adoption, retention and network activity.

Happy to follow up on any diligence question or schedule the next discussion.

Best,
Claudiu`,
    },
  ],
} as const;
