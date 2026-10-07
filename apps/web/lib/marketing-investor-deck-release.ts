import type { BusinessPlanLocale } from "@/lib/business-plan-locale";

export const investorDeckRelease = {
  version: "MKT7-RC1",
  releasedAt: "2026-10-07",
  requiredScope: "marketing" as const,
  investorVisible: true,
  confidential: true,
  readOnly: true,
  noIndex: true,
  includesPrivateDemoScreenshots: false,
  privateVisualQa: "pending" as const,
  includedApprovedPublicVisuals: ["public-home", "school"] as const,
  excludedInternalAssets: [
    "pitch-deck-foundation",
    "fundraising-readiness",
    "visual-evidence-qa",
    "private-demo-room",
    "approved-screenshots",
  ] as const,
} as const;

const footers = {
  it: {
    1: "Pre-lancio · pilot readiness",
    2: "Problem thesis · validazione esterna in corso",
    3: "Technology thesis · economics da validare",
    4: "Moduli prodotto già implementati",
    5: "GTM hypothesis · conversione da misurare",
    6: "Market sizing dettagliato nel Business Plan",
    7: "Pricing hypothesis · paid cohort non ancora validata",
    8: "Moat thesis · network/data effects ancora da dimostrare",
    9: "Stima · replacement cost ≠ valuation",
    10: "Pre-lancio · nessuna traction esterna dichiarata",
    11: "GTM hypothesis · repeatability non ancora dimostrata",
    12: "Milestone operative · non forecast garantito",
    13: "Founder-market fit · fase founder-led",
    14: "Working recommendation · valuation & terms TBD",
  },
  en: {
    1: "Pre-launch · pilot readiness",
    2: "Problem thesis · external validation in progress",
    3: "Technology thesis · economics still to validate",
    4: "Product modules already implemented",
    5: "GTM hypothesis · conversion still to measure",
    6: "Detailed market sizing lives in the Business Plan",
    7: "Pricing hypothesis · paid cohort not yet validated",
    8: "Moat thesis · network/data effects still to prove",
    9: "Estimate · replacement cost ≠ valuation",
    10: "Pre-launch · no external traction claimed",
    11: "GTM hypothesis · repeatability not yet proven",
    12: "Operating milestones · not guaranteed forecast",
    13: "Founder-market fit · founder-led stage",
    14: "Working recommendation · valuation & terms TBD",
  },
} as const;

export function investorDeckReleaseFooter(
  slide: number,
  locale: BusinessPlanLocale,
) {
  const map = footers[locale] as Record<number, string>;
  return map[slide] ?? "";
}
