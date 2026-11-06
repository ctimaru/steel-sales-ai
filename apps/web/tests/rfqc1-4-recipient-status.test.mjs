import assert from "node:assert/strict";
import { test } from "node:test";
import { rfqc1RecipientState, rfqc1ResponseSummary } from "../lib/rfqc1-recipient-status.ts";

test("RFQC1.4 counts formal outcomes rather than chat messages", () => {
  const suppliers = [1,2,3,4,5,6].map(n => ({ id: "s" + n, status: "sent" }));
  const quotes = [
    { supplier_id: "s1", status: "submitted", revision_no: 1 },
    { supplier_id: "s2", status: "superseded", revision_no: 2 },
    { supplier_id: "s3", status: "declined", revision_no: 1 },
    { supplier_id: "s4", status: "submitted", revision_no: 2 },
    { supplier_id: "s5", status: "draft", revision_no: 1 },
  ];
  assert.deepEqual(rfqc1ResponseSummary({ suppliers, quotes }), { total: 6, answered: 4, offered: 3, declined: 1, label: "4/6" });
});
test("RFQC1.4 keeps error, expired, draft and opened distinct", () => {
  const supplier = { id: "a", status: "sent" };
  const dueAt = "2026-01-01T00:00:00Z";
  assert.equal(rfqc1RecipientState({ supplier, dueAt, now: "2026-02-01T00:00:00Z" }), "expired");
  assert.equal(rfqc1RecipientState({ supplier, dispatch: { supplier_id: "a", status: "bounced" } }), "delivery_error");
  assert.equal(rfqc1RecipientState({ supplier, dispatch: { supplier_id: "a", status: "opened" } }), "opened");
  assert.equal(rfqc1RecipientState({ supplier: { id: "a", status: "draft" } }), "draft");
});
test("RFQC1.4 ignores unrelated supplier offers and shows work in progress", () => {
  const supplier = { id: "a", status: "sent" };
  assert.equal(rfqc1RecipientState({
    supplier,
    quotes: [{ supplier_id: "b", status: "submitted", revision_no: 1 }],
    thread: { supplier_id: "a", status: "awaiting_supplier", last_message_at: "2026-11-06T11:00:00Z" },
  }), "working");
});
