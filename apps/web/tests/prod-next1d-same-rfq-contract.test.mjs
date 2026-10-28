import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const file = (p) => readFileSync(new URL(p, root), "utf8");
const workflow = file(".github/workflows/demotest2-3-chrome-auth.yml");
const launch = file("supabase/tests/prod_next1d_launch_saved_rfq.sql");
const approval = file("supabase/tests/prod_next1d_prepare_po_approval.sql");
const proof = file("supabase/tests/prod_next1d_assert_single_rfq.sql");
const browser = file("apps/web/tests/prod-next1d-chrome-single-rfq.mjs");
const token = file("apps/web/tests/prod-next1d-prepare-portal.mjs");

test("PROD-NEXT1.D uses the existing browser-created 1440 RFQ, not a new synthetic RFQ", () => {
  for (const source of [launch, approval, proof]) {
    assert.ok(source.includes("BD15 E2E LOCAL 1440"));
    assert.ok(source.includes("buyer_rfq_campaigns"));
  }
  assert.ok(launch.includes("source_distinta_id"));
  const buyerE2e = file("apps/web/tests/bd15-chrome-rfq-funnel.mjs");
  assert.ok(buyerE2e.includes("viewer denied same browser-created buyer RFQ"));
  assert.ok(buyerE2e.includes("viewerContext = await browser.newContext"));
  assert.ok(launch.includes("rfqh3_launch_campaign"));
  assert.ok(!launch.includes("insert into public.buyer_rfq_campaigns"));
  assert.ok(browser.includes('const id=readFileSync(path.join(temp,"prod-next1d-rfq-id.txt")'));
  assert.ok(browser.includes('const route="/rfq-hub/"+id;'));
  assert.ok(approval.includes("rfqh7_confirm_award"));
  assert.ok(approval.includes("rfqh13_request_approval"));
  assert.ok(proof.includes("buyer_rfq_quote_lines"));
  assert.ok(proof.includes("buyer_purchase_order_versions"));
  assert.ok(proof.includes("buyer_purchase_order_supplier_responses"));
  assert.ok(proof.includes("normalized_eur_t>0"));
  assert.ok(proof.includes("normalized_eur_m>0"));
});

test("PROD-NEXT1.D preserves tenant and external-send boundaries", () => {
  assert.ok(browser.includes('assert.equal(origin,"http://127.0.0.1:3000"'));
  assert.ok(browser.includes('assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321"'));
  assert.ok(token.includes('assert.equal(process.env.RESEND_API_KEY ?? "", "")'));
  assert.ok(browser.includes("same_rfq_cross_company_denial"));
  assert.ok(browser.includes("same_rfq_owner_cannot_self_approve"));
  assert.ok(browser.includes("same_rfq_independent_approval"));
  assert.ok(browser.includes("same_rfq_supplier_confirms_po"));
  assert.ok(proof.includes("buyer_rfq_dispatch_messages"));
  assert.ok(proof.includes("provider_message_id is not null"));
  assert.ok(proof.includes("decided_by=current_setting('prod_next1d.approver_uid')"));
  assert.doesNotMatch(browser,/https:\/\/(www\.)?smartsteelsales\.com/i);
});

test("PROD-NEXT1.D executes real UI flow and local SQL proof after BD15 and original PO smoke", () => {
  const existing = workflow.indexOf('name: "BD15 — Consecutive second Chrome run');
  const originalPo = workflow.indexOf('name: "RFQH14.2b — Assert immutable PO and no provider sends');
  const oneRfq = workflow.indexOf('name: "PROD-NEXT1.D — Generate fresh local-only supplier tokens');
  const assertion = workflow.indexOf('name: "PROD-NEXT1.D — SQL identity/price/authorization/provenance proof');
  const aggregate = workflow.indexOf('name: "PROD-NEXT1.C — Strict buyer/supplier/viewer');
  assert.ok(existing >= 0 && originalPo > existing && oneRfq > originalPo
    && assertion > oneRfq && aggregate > assertion);
  assert.ok(workflow.includes("node tests/prod-next1d-chrome-single-rfq.mjs quote"));
  assert.ok(workflow.includes("node tests/prod-next1d-chrome-single-rfq.mjs po"));
  assert.ok(workflow.includes("supabase/tests/prod_next1d_assert_single_rfq.sql"));
  assert.ok(workflow.includes("prod-next1d-single-rfq-qa"));
});
