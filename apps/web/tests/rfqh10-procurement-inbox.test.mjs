import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006155731_rfqh10_procurement_inbox.sql", import.meta.url),
  "utf8",
);
const hardening = fs.readFileSync(
  new URL("../../../supabase/migrations/20261006155911_rfqh10_procurement_inbox_hardening.sql", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/inbox/page.tsx", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(
  new URL("../lib/routes.ts", import.meta.url),
  "utf8",
);
const ia = fs.readFileSync(
  new URL("../lib/workspace-information-architecture.ts", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const hub = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/page.tsx", import.meta.url),
  "utf8",
);

test("RFQH10 exposes one owner-scoped procurement inbox read model", () => {
  assert.match(migration, /rfqh10_procurement_inbox_impl/);
  assert.match(migration, /r\.owner_user_id=v_user_id/);
  assert.match(migration, /status not in\('closed','cancelled'\)/);
  assert.match(migration, /stable/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /Authentication required/);
});

test("RFQH10 prioritizes supplier PO changes and delivery failures ahead of passive waiting", () => {
  assert.match(migration, /p\.status='change_requested' then 5/);
  assert.match(migration, /p\.status='supplier_rejected' then 8/);
  assert.match(migration, /v\.delivery_status='failed' then 12/);
  assert.match(migration, /p\.status='issued'.*v\.confirmation_due_at<now\(\).*then 15/s);
  assert.match(migration, /else 85/);
});

test("RFQH10 surfaces negotiations requiring buyer action and overdue supplier follow-up", () => {
  assert.match(migration, /n\.status in\('awaiting_buyer','bafo_received'\)/);
  assert.match(migration, /review_bafo/);
  assert.match(migration, /respond_negotiation/);
  assert.match(migration, /follow_up_negotiation/);
  assert.match(migration, /request_due_at<now\(\)/);
});

test("RFQH10 covers RFQ launch, dispatch recovery, quote review and follow-up", () => {
  assert.match(migration, /recover_dispatch/);
  assert.match(migration, /add_suppliers/);
  assert.match(migration, /launch_rfq/);
  assert.match(migration, /review_quotes/);
  assert.match(migration, /follow_up_rfq/);
  assert.match(migration, /submitted_quote_count/);
});

test("RFQH10 summary hardening counts active RFQs outside the expired CTE scope", () => {
  assert.match(hardening, /'active_rfqs'/);
  assert.match(hardening, /from public\.buyer_rfq_campaigns r/);
  assert.match(hardening, /r\.owner_user_id=v_user_id/);
  assert.doesNotMatch(hardening, /from my_rfq\)/);
});

test("RFQH10 is a read-only cockpit and never performs irreversible procurement actions", () => {
  const implStart = hardening.indexOf("create or replace function private.rfqh10_procurement_inbox_impl");
  const implEnd = hardening.indexOf("notify pgrst");
  const impl = hardening.slice(implStart, implEnd);
  assert.doesNotMatch(impl, /insert into public\./i);
  assert.doesNotMatch(impl, /update public\./i);
  assert.doesNotMatch(impl, /delete from public\./i);
  assert.match(page, /non esegue automaticamente invii, solleciti, assegnazioni o emissioni PO/);
});

test("RFQH10 workspace has attention/waiting filters and deterministic priority lanes", () => {
  assert.match(page, /Cosa richiede attenzione adesso/);
  assert.match(page, /Da fare/);
  assert.match(page, /In attesa/);
  assert.match(page, /Priorità immediata/);
  assert.match(page, /Prossime decisioni/);
  assert.match(page, /Monitoraggio/);
  assert.match(page, /item\.requires_action/);
});

test("RFQH10 actions navigate back to the governed RFQ workflow", () => {
  assert.match(page, /appRoutes\.rfqHub\.campaign\(item\.rfq_id\)/);
  assert.match(page, /item\.action_label/);
  assert.doesNotMatch(page, /confirmRfqAward|issuePurchaseOrder|sendNegotiation|launchCampaign/);
});

test("RFQH10 keeps legacy routes and is now owned by private RFQ Hub", () => {
  assert.match(routes, /procurementInbox: "\/marketplace\/inbox"/);
  assert.match(ia, /"marketplace:inbox"/);
  assert.match(ia, /appRoutes\.marketplace\.procurementInbox/);
  assert.match(shell, /label: "Inbox acquisti"/);
  assert.match(ia, /"rfq:inbox"/);
  assert.match(hub, /Apri Inbox/);
});
