import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/company-certification-display.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { certificationValidityState: validity, certificationVerification: verification, formatCertificationDate } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const today = "2026-11-27";

test("certificate date limits include the first and last day", () => {
  const dates = { valid_from: "2026-11-27", valid_to: "2026-12-01" };
  assert.equal(validity(dates, "2026-11-26"), "not_yet_valid");
  assert.equal(validity(dates, "2026-11-27"), "valid");
  assert.equal(validity(dates, "2026-12-01"), "valid");
  assert.equal(validity(dates, "2026-12-02"), "expired");
  assert.equal(validity({ valid_from: today, valid_to: today }, today), "valid");
});

test("missing dates follow the canonical partial-range rules without inventing dates", () => {
  assert.equal(validity({ valid_from: null, valid_to: null }, today), "unknown");
  assert.equal(validity({ valid_from: "2026-01-01", valid_to: null }, today), "valid");
  assert.equal(validity({ valid_from: "2026-12-01", valid_to: null }, today), "not_yet_valid");
  assert.equal(validity({ valid_from: null, valid_to: today }, today), "valid");
  assert.equal(validity({ valid_from: null, valid_to: "2026-11-26" }, today), "expired");
});

test("verification does not override a certificate's dates or imply current validity", () => {
  const expired = { valid_from: "2025-01-01", valid_to: "2026-01-01", verification_status: "verified" };
  assert.equal(validity(expired, today), "expired");
  assert.equal(verification(expired.verification_status).label, "Verificata dalla piattaforma");
  const current = { valid_from: "2026-01-01", valid_to: "2027-01-01", verification_status: "unverified" };
  assert.equal(validity(current, today), "valid");
  assert.equal(verification(current.verification_status).label, "Non verificata");
});

test("all verification outcomes remain distinguishable and unknown statuses never confirm verification", () => {
  const statuses = ["unverified", "pending", "verified", "rejected", "expired", "revoked"];
  assert.equal(new Set(statuses.map((status) => verification(status).label)).size, 6);
  assert.equal(verification("pending").label, "Verifica in corso");
  assert.equal(verification("rejected").label, "Verifica respinta");
  assert.equal(verification("expired").label, "Verifica scaduta");
  assert.equal(verification("revoked").label, "Verifica revocata");
  assert.deepEqual(statuses.filter((status) => verification(status).tone === "confirmed"), ["verified"]);
  for (const status of ["", "future-status", "company_managed", "public_web", "platform_verified"]) {
    assert.equal(verification(status).tone, "neutral");
    assert.equal(verification(status).label, "Stato di verifica non disponibile");
  }
});

test("calendar dates do not shift across timezone offsets and invalid ranges stay unknown", () => {
  assert.equal(formatCertificationDate("2024-02-29"), "29/02/2024");
  assert.equal(formatCertificationDate("2026-11-27"), "27/11/2026");
  for (const invalid of ["2026-02-29", "2026-13-01", "2026-11-27T00:00:00Z", "not-a-date"]) {
    assert.equal(formatCertificationDate(invalid), "Data non disponibile");
    assert.equal(validity({ valid_from: invalid, valid_to: null }, today), "unknown");
  }
  assert.equal(validity({ valid_from: "2027-01-01", valid_to: "2026-01-01" }, today), "unknown");
});
