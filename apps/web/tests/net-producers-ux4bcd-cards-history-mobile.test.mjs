import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const view=read("components/network-producers-experience.tsx");
const chat=read("components/eu-producer-intelligence-chat.tsx");
const page=read("app/(italian)/(workspace)/network/pro/producers/page.tsx");

test("UX4.B: company row shows at most one source-status chip and a linked domain",()=>{
  assert.match(view,/evidence\.length>0\?<Chip tone="tech">Dati tecnici con fonte · \{evidence\.length\}<\/Chip>:\s*docs\.length>0\?<Chip tone="docs">Cataloghi ufficiali · \{docs\.length\}<\/Chip>:\s*mentions\.length>0\?<Chip tone="mention">Menzioni da qualificare · \{mentions\.length\}<\/Chip>/);
  assert.match(view,/aria-label=\{"Sito ufficiale di "\+company\.name\}/);
  assert.match(view,/\{domain\} ↗/);
  assert.doesNotMatch(view,/>\s*Sito <span aria-hidden="true">↗<\/span>/);
  assert.match(view,/Dettagli tecnici e fonti/);
  assert.match(view,/href=\{doc\.sourceUrl\} target="_blank" rel="noopener noreferrer"/);
  assert.match(view,/href=\{m\.sourceUrl\}/);
  assert.match(view,/href=\{item\.sourceUrl\}/);
});

test("UX4.C: old searches are grouped in an accessible native history, last result remains visible",()=>{
  assert.match(chat,/function renderTurn\(turn:Turn\)/);
  assert.match(chat,/data-testid="eu-producer-chat-history"/);
  assert.match(chat,/Ricerche precedenti · \{turns\.length-1\}/);
  assert.match(chat,/turns\.slice\(0,-1\)\.map\(renderTurn\)/);
  assert.match(chat,/turns\.length>0\?renderTurn\(turns\[turns\.length-1\]!\):null/);
  assert.match(chat,/<summary className="flex min-h-11 cursor-pointer/);
  assert.match(chat,/data-testid="eu-producer-source-match"/);
  assert.match(chat,/newRequestHref\(\{network:company\.companyId,fromNetwork:true\}\)/);
  assert.match(chat,/Nessun invio automatico/);
  assert.doesNotMatch(chat,/localStorage\.setItem\(/);
});

test("UX4.D: phone comparison uses vertical evidence cards, desktop retains the full matrix",()=>{
  assert.match(view,/data-testid="producer-compare-mobile"/);
  assert.match(view,/grid gap-3 p-3 md:hidden/);
  assert.match(view,/selectedCompanies\.map\(company=>\{/);
  assert.match(view,/<dl className="mt-3 space-y-3">/);
  assert.match(view,/technicalKinds\.map\(group=><div key=\{group\.kind\}>/);
  assert.match(view,/items=\{scopedClaims\} kind=\{group\.kind\}/);
  assert.match(view,/data-testid="producer-compare-desktop"/);
  assert.match(view,/hidden w-full overflow-x-auto md:block/);
  assert.match(view,/min-w-\[580px\]/);
  assert.match(view,/data-testid="producer-compare-bar"/);
  assert.match(view,/selection\.scope===selectionScope\?selection\.ids:\[\]/);
});

test("UX4.BCD: protected and unsupported tenant states remain isolated",()=>{
  assert.match(page,/getNetworkProScopedDirectory/);
  assert.match(page,/module:"producers"/);
  assert.match(view,/result\.status==="ready"\?result\.data\.items:\[\]/);
  assert.match(view,/result\.status==="locked"/);
  assert.match(view,/result\.status==="unavailable"/);
  assert.match(view,/Nessuna combinazione norma, grado, dimensione e spessore viene dedotta/);
  assert.match(view,/non dimostrano una specifica combinazione/);
  assert.doesNotMatch(view,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(chat,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
