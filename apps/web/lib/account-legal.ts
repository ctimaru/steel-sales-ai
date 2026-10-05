export const ACCOUNT_PRIVACY_NOTICE_VERSION = "2026-10-04-lr5-v1";
export const ACCOUNT_TERMS_VERSION = "2026-10-04-lr5-v1";
export const ACCOUNT_EXPORT_VERSION = "2026-10-04-lr5-v1";

export const ACCOUNT_LEGAL_CONTRACT = {
  privacyNoticeVersion: ACCOUNT_PRIVACY_NOTICE_VERSION,
  termsVersion: ACCOUNT_TERMS_VERSION,
  privacyAcknowledgementIsConsent: false,
  termsAcceptanceRequired: true,
  hardDeleteAutomatic: false,
  accountClosure: "immediate-access-suspension-plus-erasure-review",
  exportScope:
    "user-level-account-data-excludes-organization-controlled-commercial-memory",
} as const;
