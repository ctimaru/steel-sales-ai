/**
 * CALC-INT3E.4 — finite, privacy-safe international public RFQ funnel taxonomy.
 * Stages are EVENT COUNTS, not unique visitors, cohorts or completed registrations.
 * No technical dimensions, company identifiers, prices or RFQ text.
 */
export const INTERNATIONAL_RFQ_LOCALES=["en","de","fr","es"] as const;
export type InternationalRfqLocale=(typeof INTERNATIONAL_RFQ_LOCALES)[number];
export const INTERNATIONAL_RFQ_STAGES=["handoff","bill_opened","email_copied","registration_click"] as const;
export type InternationalRfqStage=(typeof INTERNATIONAL_RFQ_STAGES)[number];
export type InternationalRfqSystem="eu"|"us"|"mixed"|"direct";
export type InternationalRfqStandard=
  "en10210"|"en10219"|"geometric"|"api5l"|"astm-a53"|"astm-a106"|"astm-a500"|"mixed"|"unknown";
export type InternationalRfqSegment={
  system:InternationalRfqSystem;
  standard:InternationalRfqStandard;
};
export type InternationalRfqEventName="intl_rfq_handoff_en"|"intl_rfq_handoff_de"|"intl_rfq_handoff_fr"|"intl_rfq_handoff_es"|"intl_rfq_bill_opened_en"|"intl_rfq_bill_opened_de"|"intl_rfq_bill_opened_fr"|"intl_rfq_bill_opened_es"|"intl_rfq_email_copied_en"|"intl_rfq_email_copied_de"|"intl_rfq_email_copied_fr"|"intl_rfq_email_copied_es"|"intl_rfq_registration_click_en"|"intl_rfq_registration_click_de"|"intl_rfq_registration_click_fr"|"intl_rfq_registration_click_es";

export function internationalRfqEventName(
  stage:InternationalRfqStage,locale:InternationalRfqLocale,
):InternationalRfqEventName{
  return ("intl_rfq_"+stage+"_"+locale) as InternationalRfqEventName;
}

export function internationalRfqSource(
  eu:ReadonlyArray<{standard:"en10210"|"en10219"|"geometric"}>,
  us:ReadonlyArray<{productStandard:"api5l"|"astm-a53"|"astm-a106"|"astm-a500"}>,
):InternationalRfqSegment{
  if(!eu.length&&!us.length)return {system:"direct",standard:"unknown"};
  const system=eu.length&&us.length?"mixed":eu.length?"eu":"us";
  const standards=new Set<InternationalRfqStandard>([
    ...eu.map(item=>item.standard),
    ...us.map(item=>item.productStandard),
  ]);
  return {system,standard:standards.size===1?[...standards][0]:"mixed"};
}

export type InternationalRfqLocaleCounts={
  locale:InternationalRfqLocale;
  handoff:number;
  billOpened:number;
  emailCopied:number;
  registrationClicks:number;
};
export function buildInternationalRfqCounts(eventMap:ReadonlyMap<string,number>):InternationalRfqLocaleCounts[]{
  const count=(stage:InternationalRfqStage,locale:InternationalRfqLocale)=>{
    const n=eventMap.get(internationalRfqEventName(stage,locale));
    return typeof n==="number"&&Number.isSafeInteger(n)&&n>=0?n:0;
  };
  return INTERNATIONAL_RFQ_LOCALES.map(locale=>({
    locale,
    handoff:count("handoff",locale),
    billOpened:count("bill_opened",locale),
    emailCopied:count("email_copied",locale),
    registrationClicks:count("registration_click",locale),
  }));
}
