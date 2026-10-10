import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
test("PLR5.2 prioritization is explicit, accessible, read-only and does not invent SLA", () => {
 const control=read("components/governance-queue-controls.tsx");
 assert.match(control,/priorityValues\.includes\(value\)/);
 assert.match(control,/Da gestire/);
 assert.match(control,/non sono una misura di urgenza temporale/);
 assert.doesNotMatch(control,/supabase|\.rpc\(|fetch\(/);
 for (const [area, priorities] of [
  ["registrations", '["pending_review", "approved"]'],
  ["company-claims", '["requested", "under_review"]'],
  ["knowledge", '["in_review", "changes_requested"]']
 ]) {
   const page=read("app/(platform)/platform/"+area+"/page.tsx");
   assert.ok(page.includes("priorityValues={"+priorities+"}"));
   assert.match(page,/requirePlatformPermission/);
 }
});
