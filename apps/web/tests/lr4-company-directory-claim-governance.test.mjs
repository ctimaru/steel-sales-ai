import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261004165000_lr4_company_directory_claim_governance.sql",
    import.meta.url,
  ),
  "utf8",
);
const contract = fs.readFileSync(
  new URL("../lib/company-directory-privacy.ts", import.meta.url),
  "utf8",
);
const notice = fs.readFileSync(
  new URL("../app/privacy/company-directory/page.tsx", import.meta.url),
  "utf8",
);
const privacy = fs.readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
const claim = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260927190000_p3_6_company_claim_ownership_verification.sql",
    import.meta.url,
  ),
  "utf8",
);
const publicClaim = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261003185000_pa1_4_claim_conversion_registration_handoff.sql",
    import.meta.url,
  ),
  "utf8",
);

test("LR4 creates a fail-closed per-contact privacy governance contract", () => {
  assert.match(migration, /privacy_classification/);
  assert.match(migration, /company_channel/);
  assert.match(migration, /personal_contact/);
  assert.match(migration, /art6_1_f_legitimate_interest/);
  assert.match(migration, /lia_status/);
  assert.match(migration, /art14_status/);
  assert.match(migration, /privacy_review_expires_at/);
  assert.match(migration, /LR4 privacy governance blocks contact disclosure/);
});

test("LR4 withdraws legacy published contacts until explicit review", () => {
  assert.match(
    migration,
    /update public\.network_contacts[\s\S]*publication_status='pending_review'/,
  );
  assert.match(migration, /where publication_status='published'/);
});

test("LR4 requires Article 14 evidence before a personal contact is disclosure-ready", () => {
  assert.match(migration, /network_art14_notice_log/);
  assert.match(migration, /outcome in \('delivered','delivered_late','exempt_documented'\)/);
  assert.match(migration, /interval '1 month'/);
  assert.match(migration, /delivered_late/);
  assert.match(migration, /contact is not LR4-ready for disclosure/);
  assert.match(migration, /2026-10-04-lr4-v1/);
});

test("LR4 makes Article 14 exceptions explicit instead of automatic", () => {
  assert.match(migration, /exception requires a documented reason/);
  assert.match(migration, /exempt_documented/);
  assert.match(notice, /non viene presunta automaticamente/);
});

test("LR4 expires disclosure approval after 12 months", () => {
  assert.match(migration, /now\(\)\+interval '12 months'/);
  assert.match(migration, /privacy_review_expires_at>now\(\)/);
  assert.match(notice, /validità massima di 12 mesi/);
});

test("LR4 keeps paid Network entitlement while replacing privileged contact projections", () => {
  assert.match(
    migration,
    /perform private\.pa1_3_require_current_network_access\(\)/,
  );
  assert.match(migration, /private\.lr4_public_company_profile_impl/);
  assert.match(migration, /private\.p3_7d_public_identity_contacts_impl/);
  assert.match(migration, /private\.lr4_contact_privacy_ready/);
});

test("LR4 sends company-managed contact edits back to privacy review", () => {
  assert.match(migration, /v_publication_status:=case[\s\S]*'pending_review'/);
  assert.match(migration, /privacy_classification='unreviewed'/);
  assert.match(migration, /privacy_review_required/);
});

test("LR4 preserves claim ownership proof and keeps it separate from verification", () => {
  assert.match(claim, /approved company claim requires verified ownership proof/);
  assert.match(claim, /authenticated_corporate_email/);
  assert.match(claim, /manual_review/);
  assert.match(claim, /claim approval remains Superadmin-controlled and separate from Network verification/);
  assert.match(publicClaim, /network_access_included',false/);
  assert.doesNotMatch(publicClaim, /'email'\s*,\s*v_company/);
});

test("LR4 public lookup remains company-only while Network contacts remain private/paid", () => {
  assert.match(contract, /publicLookupPersonalData: false/);
  assert.match(contract, /networkPublic: false/);
  assert.match(notice, /lookup pubblico espone solo dati minimi riferiti all’azienda, non contatti personali/);
  assert.match(notice, /entitlement Network attivo/);
});

test("LR4 publishes a dedicated Article 14 information surface and links it from privacy", () => {
  assert.match(notice, /GDPR · Art\. 14 · Company Directory/);
  assert.match(notice, /art\. 6, par\. 1, lett\. f\)/i);
  assert.match(notice, /entro un mese/i);
  assert.match(notice, /prima\/al momento della prima divulgazione/i);
  assert.match(privacy, /\/privacy\/company-directory/);
});

test("LR4 SQL and web notice use the same notice version", () => {
  assert.match(contract, /COMPANY_DIRECTORY_ART14_NOTICE_VERSION = "2026-10-04-lr4-v1"/);
  assert.match(migration, /'2026-10-04-lr4-v1'/);
});
