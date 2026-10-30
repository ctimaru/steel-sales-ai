import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const ui=read("../app/(italian)/(platform)/platform/steel-pulse/workflow/page.tsx");
const actions=read("../app/(italian)/(platform)/platform/steel-pulse/workflow/actions.ts");
const inventory=read("../lib/platform-ia-contract.ts");
const knowledge=read("../app/(italian)/(platform)/platform/knowledge/page.tsx");
test("SP8.B role scoped editorial experience",()=>{
 for(const token of ['requirePlatformConsoleContext','knowledge.read_drafts','knowledge.edit','knowledge.review'])assert.ok(ui.includes(token),token);
 assert.ok(inventory.includes('/platform/steel-pulse/workflow'));
 assert.ok(knowledge.includes('/platform/steel-pulse/workflow'));
 assert.ok(actions.includes('await authorize("knowledge.edit")'));
 assert.ok(actions.includes('await authorize("knowledge.review")'));
});
test("SP8.B keeps SP7.2 suspended and actions restricted",()=>{
 for(const token of ['sp3_save_draft','sp3_decide','editor_approve','editor_reject','p_expected_revision','current.card.revision','current.source.source_status'])assert.ok(actions.includes(token),token);
 for(const forbidden of ['sp2_ingest','legal_approve','legal_reject','publish','withdraw','service_role'])assert.ok(!actions.includes(forbidden),forbidden);
 assert.ok(ui.includes('SP7.2 sospeso'));
});
