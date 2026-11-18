import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// DISTINTA2 (founder decision, 18 Nov 2026): step 2 «A chi lo chiedi» is one
// focused screen while the RFQ is a draft; nothing is sent from the picker.

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const picker = read("../components/rfq-supplier-picker.tsx");
const page = read("../app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
const actions = read("../app/(italian)/(workspace)/marketplace/rfq-hub/actions.ts");
const migration = read("../../../supabase/migrations/20261118091500_distinta2_supplier_picker.sql");

test("the picker groups suppliers and never sends", () => {
  for (const title of ["Le tue aziende salvate", "Già usati nelle tue richieste", "I tuoi contatti", "Consigliati per questa distinta"]) {
    assert.match(picker, new RegExp(title));
  }
  assert.match(picker, /aria-label=\{"Seleziona " \+ name\}/);
  assert.match(picker, /"Aggiungi " \+ checkedRows.length \+ " alla RFQ"/);
  assert.match(picker, /fornitori aggiunti alla RFQ/);
  assert.match(picker, /disabled = !row.reachable \|\| !canEdit/);
  assert.match(picker, /Nessun contatto verificato/);
  assert.match(picker, /removeSupplierFromBuyerRfq/);
  assert.doesNotMatch(picker, /launchBuyerRfq|rfqh3_launch/);
  assert.match(picker, /href="#rfq-review-send"/);
});

test("the draft owner gets the step-2 screen instead of the chat", () => {
  const branch = page.slice(page.indexOf("if (isPreparation && canExecuteCritical) {"), page.indexOf("<Rfqc1ChatWorkspace"));
  assert.match(branch, /data-testid="rfq-step2"/);
  assert.match(branch, /<RfqSupplierPicker rfqId=\{campaign.id\}/);
  assert.match(branch, /removable: supplier.status === "draft"/);
  assert.doesNotMatch(branch, /CommercialAiCompanion|Rfqc1SupplierSuggestions/);
});

test("server actions call the governed RPCs and the office guard", () => {
  assert.match(actions, /rpc\("distinta2_supplier_picker"/);
  assert.match(actions, /rpc\("distinta2_remove_supplier"/);
  const remove = actions.slice(actions.indexOf("export async function removeSupplierFromBuyerRfq"));
  assert.match(remove.slice(0, 600), /officeWriteDenied\("purchasing"\)/);
});

test("migration: owner-only, draft-only removal, no anonymous access", () => {
  assert.match(migration, /r.owner_user_id=v_user_id/);
  assert.match(migration, /v_rfq.status not in \('draft','ready'\)/);
  assert.match(migration, /'supplier_removed'/);
  assert.match(migration, /revoke all on function public.distinta2_supplier_picker\(uuid\) from public, anon;/);
  assert.match(migration, /revoke all on function public.distinta2_remove_supplier\(uuid,uuid\) from public, anon;/);
  // Reachability reuses the privacy-reviewed RFQH2 contact rules.
  assert.match(migration, /private.rfqh2_best_network_contact/);
});

test("DISTINTA2B: the Network company the request started from is proposed at the top, never added", () => {
  const single = read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx");
  const builder = read("../components/buyer-distinta-builder.tsx");
  assert.match(single, /stepTwoNetworkCompanyId=\{networkContext\?\.id \?\? null\}/);
  assert.match(single, /non viene aggiunta in automatico/);
  assert.match(builder, /"\?dal=" \+ encodeURIComponent\(stepTwoNetworkCompanyId\)/);
  // The link's UUID is re-checked server-side (Network access + publication).
  assert.match(page, /getCommercialNetworkContext\(campaign.organization_id, fromNetwork\)/);
  assert.match(picker, /data-testid="rfq-picker-pinned"/);
  assert.match(picker, /Già tra i destinatari/);
  assert.match(picker, /pinnedPrechecked/);
  // Pre-checking is local state only: adding still needs «Aggiungi … alla RFQ».
  const pinnedBlock = picker.slice(picker.indexOf("DISTINTA2B: the starting company"), picker.indexOf("// Search by name"));
  assert.doesNotMatch(pinnedBlock, /addSupplierToBuyerRfq|addSuppliersToBuyerRfqBulk/);
});
