export const COMPANY_DIRECTORY_ART14_NOTICE_VERSION = "2026-10-04-lr4-v1";

export const COMPANY_DIRECTORY_PRIVACY_CONTRACT = {
  contract: "LR4-company-directory-claim-governance-v1",
  networkPublic: false,
  publicLookupPersonalData: false,
  personalContactBasis: "art6_1_f_legitimate_interest_after_lia",
  reviewValidityMonths: 12,
  art14TimingRule:
    "one_month_or_first_communication_or_first_disclosure_whichever_is_earlier",
  safeguards: [
    "PA1.5 source terms and database-rights gate remains mandatory",
    "company/legal-entity data is preferred over person-linked data",
    "personal contacts fail closed until per-record LIA and Article 14 readiness",
    "late Article 14 delivery does not unlock publication automatically",
    "Article 14 exceptions must be documented case by case",
    "claim ownership does not equal Network verification",
    "claim ownership does not authorize publication of personal contacts",
    "company-managed contact edits return the record to privacy review",
    "Commercial Memory never feeds the directory",
  ],
} as const;
