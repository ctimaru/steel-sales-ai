import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
test("PLR5.4 shared feedback separates errors from successful actions with accessible roles", () => {
 const feedback=read("components/governance-queue-feedback.tsx");
 assert.match(feedback,/role="alert"/);
 assert.match(feedback,/role="status" aria-live="polite"/);
 assert.match(feedback,/Operazione non completata/);
 assert.match(feedback,/Operazione completata/);
 assert.doesNotMatch(feedback,/fetch\(|\.rpc\(|supabase/);
});
test("PLR5.4 empty states distinguish filtered no-match from an empty queue", () => {
 for(const [segment,filterVar] of [["registrations","activeStatus || query"],["company-claims","activeStatus"],["knowledge","activeStatus"]]) {
  const page=read("app/(platform)/platform/"+segment+"/page.tsx");
  assert.match(page,/GovernanceQueueFeedback/);
  assert.match(page,/Nessun risultato con/);
  assert.match(page,/Coda senza pratiche|Coda editoriale vuota/);
  assert.match(page,/FirstUseEmptyState/);
  assert.ok(page.includes(filterVar));
  assert.match(page,/requirePlatformPermission/);
 }
});
