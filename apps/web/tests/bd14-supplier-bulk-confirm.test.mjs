import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const actions = read("../app/(workspace)/marketplace/rfq-hub/actions.ts");
const page = read("../app/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
const selector = read("../components/rfq-supplier-add-form.tsx");
const dispatch = read("../components/rfq-dispatch-panel.tsx");
const helper = ts.transpileModule(read("../lib/rfq-dispatch-recipient-check.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { matchesConfirmedRecipients } = await import("data:text/javascript;base64," + Buffer.from(helper).toString("base64"));
const ids = [
  "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  "cccccccc-cccc-4ccc-cccc-cccccccccccc",
];

test("BD14: recipient confirmation rejects missing, added, duplicate or invalid identities", () => {
  assert.equal(matchesConfirmedRecipients(ids.slice(0,2), ids.slice(0,2).reverse()), true);
  assert.equal(matchesConfirmedRecipients(ids.slice(0,2), ids), false);
  assert.equal(matchesConfirmedRecipients(ids, ids.slice(0,2)), false);
  assert.equal(matchesConfirmedRecipients([ids[0], ids[0]], [ids[0], ids[1]]), false);
  assert.equal(matchesConfirmedRecipients([], []), false);
  assert.equal(matchesConfirmedRecipients(["not-a-uuid"], ["not-a-uuid"]), false);
});

test("BD14: multi-select is bounded, deduped by canonical identity and uses existing resolved add action", () => {
  assert.match(selector, /type="checkbox" aria-label=\{"Seleziona "/);
  assert.match(selector, /selectedByKey/);
  assert.match(selector, /selectedCandidates\.length/);
  assert.match(selector, /Aggiungi \$\{selectedCandidates\.length\} alla RFQ/);
  assert.match(selector, /existingKeys\.has\(candidate\.identity_key\)/);
  assert.match(selector, /emailsPresent\.has\(candidate\.email\.toLowerCase\(\)\)/);
  assert.match(selector, /20 per volta/);
  assert.match(actions, /addSuppliersToBuyerRfqBulk/);
  assert.match(actions, /input\.candidates\.length > 20/);
  assert.match(actions, /seen\.has\(key\)/);
  assert.match(actions, /await addSupplierToBuyerRfq\(\{/);
  assert.match(actions, /rfqh2_add_supplier/);
  assert.match(page, /existingIdentityKeys=\{supplierRows\.map/);
});

test("BD14: confirmation lists names/emails, hides prices and requires affirmative buyer consent", () => {
  assert.match(page, /name: supplier\.supplier_name/);
  assert.match(page, /email: supplier\.supplier_email_normalized/);
  assert.match(dispatch, /aria-label="Conferma finale invio RFQ"/);
  assert.match(dispatch, /suppliers\.map\(\(supplier, index\) =>/);
  assert.match(dispatch, /supplier\.email \|\| "Email mancante"/);
  assert.match(dispatch, /Partiranno email separate/);
  assert.match(dispatch, /Il Marketplace non verrà pubblicato/);
  assert.match(dispatch, /checked=\{confirmChecked\}/);
  assert.match(dispatch, /if \(!confirmOpen \|\| !confirmChecked/);
  assert.match(dispatch, /onClick=\{launch\}/);
  assert.match(dispatch, /Conferma e invia a /);
  assert.match(dispatch, /Annulla, modifica la RFQ/);
  assert.doesNotMatch(dispatch, /onClick=\{launch\}\s*disabled=\{launchPending \|\| suppliers\.length/);
});

test("BD14: the real mail action re-reads current suppliers and rejects stale confirmation", () => {
  assert.match(dispatch, /expectedSupplierIds: suppliers\.map\(supplier => supplier\.id\)/);
  assert.match(actions, /matchesConfirmedRecipients\(input\.expectedSupplierIds, context\.suppliers\.map/);
  assert.match(actions, /I destinatari sono cambiati dopo la conferma/);
  assert.match(dispatch, /launchLock\.current/);
  assert.match(actions, /"Idempotency-Key": input\.idempotencyKey/);
  assert.match(actions, /to: \[input\.recipient\]/);
  assert.match(dispatch, /disabled=\{launchPending \|\| suppliers\.length < 1 \|\| missingEmail > 0\}/);
});
