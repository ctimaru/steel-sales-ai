import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

test("PLR4.3 shared row contract covers status tones and accessible keyboard focus", () => {
 const c = read("lib/governance-row-contract.ts");
 for (const state of ["approved", "rejected", "pending_review", "revoked", "verified"]) assert.ok(c.includes('"' + state + '"'));
 assert.match(c, /focus-visible:outline/);
 assert.match(c, /GOVERNANCE_ROW_LINK_CLASS/);
});
test("PLR4.3 preserves existing mutation safeguards and uses shared visual language", () => {
 const expected = [
  ["company-discovery", "GOVERNANCE_ROW_CLASS"],
  ["company-claims", "GOVERNANCE_ROW_CLASS"],
  ["network-trust", "GOVERNANCE_ROW_CLASS"],
  ["knowledge", "GOVERNANCE_ROW_LINK_CLASS"],
 ];
 for (const [segment, style] of expected) {
   const s = read("app/(platform)/platform/" + segment + "/page.tsx");
   assert.ok(s.includes(style), segment + " missing shared row style");
   assert.ok(s.includes("requirePlatformPermission("), segment + " lost permission guard");
 }
 const claims = read("app/(platform)/platform/company-claims/page.tsx");
 const trust = read("app/(platform)/platform/network-trust/page.tsx");
 assert.match(claims, /ConfirmSubmitButton/);
 assert.match(trust, /ConfirmSubmitButton/);
});
