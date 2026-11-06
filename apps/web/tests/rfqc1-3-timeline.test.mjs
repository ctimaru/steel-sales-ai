import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRfqc1SupplierTimeline } from "../lib/rfqc1-timeline.ts";

const t = "2026-11-06T10:00:00.000Z";
function fixture() {
  return {
    supplierId: "supplier-a",
    dispatches: [
      { id: "da", supplier_id: "supplier-a", sent_at: t, delivered_at: "2026-11-06T10:01:00.000Z" },
      { id: "db", supplier_id: "supplier-b", sent_at: t }
    ],
    messages: [
      { id: "ma", supplier_id: "supplier-a", sender_role: "buyer", message_type: "counter_target", body: "1000 €/t solo A", created_at: "2026-11-06T10:02:00.000Z" },
      { id: "mb", supplier_id: "supplier-b", sender_role: "supplier", message_type: "message", body: "Segreto B", created_at: t }
    ],
    quotes: [
      { id: "qa", supplier_id: "supplier-a", revision_no: 2, status: "submitted", submitted_at: "2026-11-06T10:03:00.000Z", payment_terms: "60 gg" },
      { id: "qb", supplier_id: "supplier-b", revision_no: 1, status: "submitted", submitted_at: t }
    ],
    quoteLines: [
      { quote_id: "qa", rfq_line_id: "line-1", line_position: 1, normalized_eur_t: 1050, normalized_eur_m: 12.3, response_status: "quoted" },
      { quote_id: "qb", rfq_line_id: "line-1", line_position: 1, normalized_eur_t: 900, normalized_eur_m: 9, response_status: "quoted" }
    ],
    events: [
      { id: "e1", supplier_id: "supplier-a", event_type: "rfq_award_confirmed", created_at: "2026-11-06T10:04:00.000Z" },
      { id: "e2", supplier_id: "supplier-b", event_type: "supplier_added", created_at: t },
      { id: "e3", supplier_id: null, event_type: "private_buyer_target_updated", created_at: t }
    ]
  };
}
test("RFQC1.3 isolates supplier IDs and never forwards arbitrary event metadata", () => {
  const items = buildRfqc1SupplierTimeline(fixture());
  assert.ok(items.length > 0);
  assert.ok(items.every(item => item.supplierId === "supplier-a"));
  assert.equal(items.filter(item => item.kind === "quote").length, 1);
  assert.equal(items.find(item => item.kind === "quote").quote.lines[0].priceEurT, 1050);
  assert.ok(!JSON.stringify(items).includes("Segreto B"));
  assert.ok(!JSON.stringify(items).includes("900"));
  assert.ok(!JSON.stringify(items).includes("private_buyer_target_updated"));
});
test("RFQC1.3 keeps stable chronology and excludes drafts", () => {
  const data = fixture();
  data.quotes.push({ id: "draft", supplier_id: "supplier-a", revision_no: 3, status: "draft", submitted_at: t });
  const items = buildRfqc1SupplierTimeline(data);
  assert.deepEqual(items.slice(0, 3).map(item => item.kind), ["invitation", "delivery", "message"]);
  assert.ok(!items.some(item => item.sourceId === "draft"));
  assert.deepEqual(items.map(item => item.id), buildRfqc1SupplierTimeline(data).map(item => item.id));
});
test("RFQC1.3 does not fabricate items from invalid timestamps", () => {
  const data = fixture();
  data.dispatches[0].opened_at = "invalid";
  assert.equal(buildRfqc1SupplierTimeline(data).filter(item => item.kind === "opened").length, 0);
});
