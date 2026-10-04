import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const matrix = fs.readFileSync(
  new URL("../lib/privacy-legal-decision-matrix.ts", import.meta.url),
  "utf8",
);
const privacy = fs.readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");

test("LR3.2 creates one decision record for every LR3.1 activity", () => {
  assert.match(matrix, /LEGAL_DECISION_MATRIX_VERSION = "2026-10-04-lr3\.2"/);
  for (let i = 1; i <= 12; i += 1) {
    const id = `LR3-A${String(i).padStart(2, "0")}`;
    assert.equal(
      (matrix.match(new RegExp(`activityId: "${id}"`, "g")) ?? []).length,
      1,
      `expected exactly one decision for ${id}`,
    );
  }
  assert.match(matrix, /MISSING_LEGAL_DECISION_ACTIVITY_IDS/);
});

test("LR3.2 keeps public-source personal data blocked until LR4", () => {
  assert.match(matrix, /activityId: "LR3-A06"[\s\S]*decisionState: "blocked-until-lr4"/);
  assert.match(matrix, /before first public disclosure or first communication/i);
  assert.match(matrix, /no later than one month/);
  assert.match(matrix, /LR4 legitimate-interest assessment/);
  assert.match(matrix, /LR4 Art\. 14 notice workflow/);
});

test("LR3.2 does not use consent as a catch-all basis", () => {
  assert.equal((matrix.match(/primaryBasis: "art6-1-a-consent"/g) ?? []).length, 1);
  assert.match(matrix, /activityId: "LR3-A07"[\s\S]*primaryBasis: "art6-1-a-consent"/);
  assert.match(matrix, /activityId: "LR3-A02"[\s\S]*primaryBasis: "art6-1-b-contract"/);
  assert.match(matrix, /activityId: "LR3-A01"[\s\S]*primaryBasis: "art6-1-f-legitimate-interest"/);
});

test("LR3.2 requires an LIA wherever legitimate interest is relied on", () => {
  assert.match(matrix, /LIA_REQUIRED_ACTIVITY_IDS/);
  assert.match(matrix, /legitimateInterestAssessmentRequired: true/);
  assert.match(matrix, /balancing test/);
});

test("LR3.2 separates tenant-controlled Commercial Memory", () => {
  assert.match(matrix, /activityId: "LR3-A10"[\s\S]*decisionState: "tenant-controller-owned"/);
  assert.match(matrix, /primaryBasis: "tenant-controller-determined"/);
  assert.match(matrix, /noticePath: "processor-dpa"/);
  assert.match(matrix, /dsarOwner: "tenant-controller"/);
  assert.match(matrix, /LR8 DPA/);
});

test("LR3.2 creates concrete maximum default retention targets", () => {
  for (const value of [30, 90, 183, 365, 730]) {
    assert.ok(matrix.includes(`retentionMaxDays: ${value}`), `missing retention target ${value}`);
  }
  assert.match(matrix, /documented legal hold/);
  assert.match(matrix, /backup ageing out within 90 days/);
});

test("LR3.2 targets the minimum GA4 event-level retention and preserves LR2 consent", () => {
  assert.match(matrix, /Configure GA4 user\/event-level retention to the minimum available 2 months/);
  assert.match(matrix, /Local consent evidence remains current for 6 months/);
  assert.match(matrix, /withdraw-consent/);
});

test("LR3.2 exposes applicable rights and avoids fake portability for purely legitimate-interest processing", () => {
  assert.match(matrix, /LEGITIMATE_INTEREST_RIGHTS/);
  assert.match(matrix, /"objection"/);
  assert.match(matrix, /CONTRACT_RIGHTS/);
  assert.match(matrix, /"portability-where-applicable"/);
});

test("LR3.2 aligns the public privacy notice with the new retention baseline", () => {
  assert.match(privacy, /Baseline LR3\.2/);
  assert.match(privacy, /90 giorni/);
  assert.match(privacy, /12 mesi/);
  assert.match(privacy, /24 mesi/);
  assert.match(privacy, /30 giorni/);
  assert.match(privacy, /2 mesi/);
  assert.match(privacy, /Commercial Memory/);
});
