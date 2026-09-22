import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/conversations/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/conversations/page.tsx", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../app/(workspace)/review/conversations/conversation-backfill-button.tsx", import.meta.url), "utf8");
const relationships = fs.readFileSync(new URL("../app/(workspace)/review/relationships/page.tsx", import.meta.url), "utf8");

test("PA2.22 loads Conversation backfill readiness from controlled RPC", () => {
  assert.match(actions, /p1_conversation_backfill_readiness/);
  assert.match(actions, /p_organization_id/);
  assert.match(page, /source_message exact: abilitato/);
  assert.match(page, /source_conversation_id exact/);
});

test("Conversation backfill is explicit and single-entity", () => {
  assert.match(actions, /p1_apply_conversation_backfill/);
  assert.match(button, /Collega Conversation/);
  assert.match(page, /Bulk auto-backfill: disabilitato/);
});

test("PA2.22 explicitly forbids heuristic Conversation inference", () => {
  assert.match(page, /oggetto email/);
  assert.match(page, /dominio/);
  assert.match(page, /testo libero/);
  assert.match(page, /thread legacy/);
  assert.match(relationships, /review\/conversations/);
});
