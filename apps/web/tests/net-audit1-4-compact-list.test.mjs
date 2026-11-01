import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const ui=read("../components/network-compact-experience.tsx");
const auto=read("../components/network-auto-submit-select.tsx");
const listing=read("../lib/network-compact-directory.ts");
const actions=read("../app/(italian)/(workspace)/network/conversation-actions.ts");

test("NET-AUDIT1.4 18 rows per page, aligned with every governed source",()=>{
  assert.match(listing,/export const COMPACT_NETWORK_PAGE_SIZE=18;/);
});

test("NET-AUDIT1.4 selects apply immediately; no-JS submit stays reachable",()=>{
  assert.match(auto,/"use client"/);
  assert.match(auto,/event\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(ui,/<NetworkAutoSubmitSelect name=\{group\.name\}/);
  assert.match(ui,/sr-only inline-flex[^"]*focus:not-sr-only">Applica filtri/);
});

test("NET-AUDIT1.4 active filters are removable chips",()=>{
  assert.match(ui,/data-testid="network-active-filters"/);
  assert.match(ui,/aria-label=\{"Rimuovi filtro "\+chip\.text\}/);
  for(const key of ["q","role","product","capability","market","spec","steel"])
    assert.match(ui,new RegExp('key:"'+key+'"'));
});

test("NET-AUDIT1.4 chat beside the list, sort control, whole-row link",()=>{
  const side=ui.indexOf('data-testid="network-side-column"');
  const chat=ui.indexOf("<NetworkConversation ");
  const results=ui.indexOf('id="network-results"');
  assert.ok(side>0&&chat>side&&results>chat,"chat sits in the side column before the results");
  assert.equal((ui.match(/<NetworkConversation /g)||[]).length,1);
  assert.match(ui,/data-testid="network-sort"/);
  assert.match(ui,/>\s*Pertinenza\s*</);
  assert.match(ui,/after:absolute after:inset-0/);
  assert.match(ui,/ui-action ui-action-secondary relative z-10 inline-flex min-h-10 w-full/);
  assert.ok((ui.match(/className="relative z-10 /g)||[]).length>=4,"source links stay clickable above the row link");
});

test("NET-AUDIT1.4 a count question is answered with the number of the same list",()=>{
  assert.match(actions,/Nel Network ci sono "\+count\.toLocaleString\("it-IT"\)\+" aziende"/);
  assert.match(actions,/await getCompactNetworkPage\(organizationId,isPro\?"pro":"free",\{\.\.\.result\.filters\}\)/);
  assert.match(actions,/if\(result\.intent!=="count"\)return null;/);
});
