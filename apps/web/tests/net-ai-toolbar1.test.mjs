import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../components/network-compact-experience.tsx");
const dock=read("../components/network-ai-search-dock.tsx");
const chat=read("../components/network-conversation.tsx");
const search=read("../components/network-live-search.tsx");

test("NET-AI-TOOLBAR1: the map is alone in the left rail; search and AI share the results toolbar",()=>{
  const rail=page.indexOf('data-testid="network-side-column"');
  const railEnd=page.indexOf("</aside>",rail);
  const toolbar=page.indexOf('data-testid="network-filter-toolbar"');
  const list=page.indexOf('id="network-results"');
  assert.ok(rail>0&&railEnd>rail&&toolbar>railEnd&&list>toolbar);
  assert.match(page.slice(rail,railEnd),/<NetworkEuropeanMap /);
  assert.doesNotMatch(page.slice(rail,railEnd),/<NetworkConversation|<NetworkLiveSearch/);
  assert.match(page,/aria-label="Mappa europea e regioni"/);
  assert.match(page,/<NetworkAiSearchDock search=\{<NetworkLiveSearch filters=\{filters\}\/>\}/);
  assert.match(page,/assistant=\{<NetworkConversation userId=\{userId\} organizationId=\{organizationId\}/);
  assert.match(page,/canCompose=\{canCompose\} embedded\/>/);
  assert.equal((page.match(/<NetworkConversation /g)||[]).length,1);
  assert.equal((page.match(/<NetworkLiveSearch /g)||[]).length,1);
});

test("NET-AI-TOOLBAR1: one accessible search-row toggle opens a non-modal panel",()=>{
  assert.match(dock,/data-testid="network-ai-search-row"/);
  assert.match(dock,/data-testid="network-ai-launcher"/);
  assert.match(dock,/Chiedi all’AI/);
  assert.match(dock,/aria-expanded=\{open\}/);
  assert.match(dock,/aria-controls="network-ai-assistant-panel"/);
  assert.match(dock,/id="network-ai-assistant-panel"/);
  assert.match(dock,/hidden=\{!open\}/);
  assert.match(dock,/role="region" aria-label="Assistente AI del Network"/);
  assert.match(dock,/if\(event.key==="Escape"\)/);
  assert.match(dock,/toggleRef\.current\?\.focus\(\)/);
  assert.match(dock,/querySelector<HTMLInputElement>\("#network-chat-input"\)\?\.focus\(\)/);
  assert.match(dock,/min-h-11/);
  assert.match(dock,/flex-col gap-2 sm:flex-row/);
  assert.doesNotMatch(dock,/role="dialog"/);
});

test("NET-AI-TOOLBAR1: closing the panel keeps chat mounted; voice and RFQ contracts stay intact",()=>{
  assert.match(dock,/\{assistant\}/);
  assert.doesNotMatch(dock,/\{open\?assistant:null\}/);
  assert.match(chat,/embedded=false/);
  assert.match(chat,/if\(embedded\)return <div className="min-w-0" data-testid="network-conversational-discovery">\{content\}<\/div>/);
  assert.match(chat,/askNetworkConversation\(query,latestFilters\.current\)/);
  assert.match(chat,/NetworkRfqBridge/);
  assert.match(chat,/getByTestId|network-chat-privacy/);
  assert.match(chat,/voiceSupported/);
  assert.match(search,/router\.replace\(href,\{scroll:false\}\)/);
});
