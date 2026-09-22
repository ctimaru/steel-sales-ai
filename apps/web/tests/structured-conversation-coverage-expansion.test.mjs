import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/conversation-coverage/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/conversation-coverage/page.tsx", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../app/(workspace)/review/conversation-coverage/conversation-expansion-button.tsx", import.meta.url), "utf8");
const backfill = fs.readFileSync(new URL("../app/(workspace)/review/conversations/page.tsx", import.meta.url), "utf8");

test("PA2.23 loads structured Conversation coverage readiness", () => {
  assert.match(actions, /p1_structured_conversation_coverage_readiness/);
  assert.match(actions, /p_organization_id/);
  assert.match(page, /source_conversation_id/);
  assert.match(page, /external_thread_id/);
});

test("Conversation expansion is explicit and single-thread", () => {
  assert.match(actions, /p1_expand_structured_conversation/);
  assert.match(button, /Crea Conversation/);
  assert.match(page, /Bulk auto-expansion: disabilitata/);
});

test("PA2.23 explicitly forbids Message synthesis and Company inference", () => {
  assert.match(page, /Message synthesis: disabilitata/);
  assert.match(page, /Company\s+inference: disabilitata/);
  assert.match(page, /email_count aggregato/);
  assert.match(backfill, /review\/conversation-coverage/);
});
