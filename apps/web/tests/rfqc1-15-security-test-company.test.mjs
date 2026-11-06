import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { buildRfqc1SupplierTimeline } from "../lib/rfqc1-timeline.ts";
import { rfqc1RecipientState, rfqc1ResponseSummary } from "../lib/rfqc1-recipient-status.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = file => readFileSync(join(root, file), "utf8");

// ONLY invented organization and supplier identities; no actual Supabase access.
const company = { id: "azienda-test-uuid-sintetico", name: "Azienda TEST" };
const buyer = { id: "buyer-test", organization_id: company.id };
const suppliers = [
  { id: "fornitore-fittizio-A", status: "responded" },
  { id: "fornitore-fittizio-B", status: "sent" },
  { id: "fornitore-fittizio-C", status: "declined" },
];
const time = "2026-11-06T09:00:00.000Z";
const data = {
  dispatches: suppliers.map((s, i) => ({
    id: "invito-" + i, supplier_id: s.id, status: "sent", sent_at: time,
  })),
  messages: [
    { id: "messaggio-A", supplier_id: suppliers[0].id, sender_role: "buyer", message_type: "counter_target", body: "Solo A: counter target 870 €/t", created_at: "2026-11-06T09:01:00.000Z" },
    { id: "messaggio-B", supplier_id: suppliers[1].id, sender_role: "supplier", message_type: "message", body: "Nota esclusiva B - CONFIDENZIALE", created_at: "2026-11-06T09:01:00.000Z" },
  ],
  quotes: [
    { id: "offerta-A", supplier_id: suppliers[0].id, status: "submitted", revision_no: 1, submitted_at: "2026-11-06T09:02:00.000Z", payment_terms: "Ri.Ba. 60 gg fm" },
    { id: "offerta-B", supplier_id: suppliers[1].id, status: "draft", revision_no: 1, submitted_at: null },
    { id: "declino-C", supplier_id: suppliers[2].id, status: "declined", revision_no: 1, declined_at: "2026-11-06T09:03:00.000Z" },
  ],
  quoteLines: [
    { quote_id: "offerta-A", rfq_line_id: "L1", line_position: 1, response_status: "quoted", normalized_eur_t: 890, normalized_eur_m: 13.35 },
    { quote_id: "offerta-B", rfq_line_id: "L1", line_position: 1, response_status: "quoted", normalized_eur_t: 990, normalized_eur_m: 14.85 },
  ],
  events: [
    { id: "evento-A", supplier_id: suppliers[0].id, event_type: "negotiation_counter_target_sent", created_at: time, metadata: { secret: "other_supplier" } },
  ],
};
test("RFQC1.15 - buyer sees independent private supplier A/B threads only", () => {
  assert.equal(buyer.organization_id, company.id);
  const a = buildRfqc1SupplierTimeline({ supplierId: suppliers[0].id, ...data });
  const b = buildRfqc1SupplierTimeline({ supplierId: suppliers[1].id, ...data });
  const c = buildRfqc1SupplierTimeline({ supplierId: suppliers[2].id, ...data });
  assert.ok(a.length > 0 && b.length > 0 && c.length > 0);
  assert.ok(a.every(item => item.supplierId === suppliers[0].id));
  assert.ok(b.every(item => item.supplierId === suppliers[1].id));
  assert.ok(!JSON.stringify(a).includes("CONFIDENZIALE"));
  assert.ok(!JSON.stringify(b).includes("870 €/t"));
  assert.ok(!JSON.stringify(a).includes("other_supplier"));
  assert.ok(!b.some(item => item.kind === "quote")); // draft is not a submitted offer
  assert.equal(c.filter(item => item.kind === "declined").length, 1);
});
test("RFQC1.15 - unsolicited other supplier ID has no access to conversation", () => {
  const entries = buildRfqc1SupplierTimeline({ supplierId: "unknown", ...data });
  assert.deepEqual(entries, []);
  assert.deepEqual(rfqc1ResponseSummary({ suppliers, quotes: data.quotes }), {
    total: 3, answered: 2, offered: 1, declined: 1, label: "2/3",
  });
  assert.equal(rfqc1RecipientState({
    supplier: suppliers[1], quotes: data.quotes,
    thread: { supplier_id: suppliers[1].id, status: "awaiting_buyer", last_message_at: time },
  }), "working");
});
test("RFQC1.15 - guest portal does not import buyer-only projection", () => {
  const guest = read("app/(italian)/(public)/rfq/respond/[token]/page.tsx");
  const model = read("lib/rfqc1-timeline.ts");
  const composer = read("components/rfqc1-chat-composer.tsx");
  const buyer = read("components/rfqc1-chat-workspace.tsx");
  assert.doesNotMatch(guest, /rfqc1-chat-workspace|rfqc1-timeline/);
  assert.doesNotMatch(model, /metadata\s*:/);
  assert.match(model, /eventKinds\.has\(event\.event_type\)/);
  assert.match(composer, /Confermo e invio/);
  assert.match(composer, /postBuyerRfqNegotiation/);
  assert.match(buyer, /<Rfqc1ChatComposer/);
  assert.doesNotMatch(composer, /setInterval\(|setTimeout\(/);
});
