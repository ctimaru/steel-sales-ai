import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p,root),"utf8");
test("PLR4.2 all five domains share role-aware queue summary", () => {
 const c = read("components/governance-queue-controls.tsx");
 assert.match(c,/readOnly \? "Consultazione/);
 assert.match(c,/aria-label=\{title \+ " · gestione coda"\}/);
 assert.match(c,/aria-current=\{active \? "page"/);
 for(const segment of ["registrations","company-discovery","company-claims","network-trust","knowledge"]){
  const p=read("app/(platform)/platform/"+segment+"/page.tsx");
  assert.match(p, /GovernanceQueueControls/);
  assert.match(p, /readOnly=\{/);
  assert.match(p, /GovernanceWorkspaceNav/);
 }
});
test("PLR4.2 no database calls or mutations in reusable queue UI", () => {
 const c=read("components/governance-queue-controls.tsx");
 assert.doesNotMatch(c,/supabase|\.rpc\(|fetch\(|<form|useEffect/);
 assert.match(c,/encodeURIComponent\(value\)/);
});
