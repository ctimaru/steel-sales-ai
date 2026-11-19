import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const view=read("components/network-producers-experience.tsx");
const chat=read("components/eu-producer-intelligence-chat.tsx");
const page=read("app/(italian)/(workspace)/network/pro/producers/page.tsx");

test("UX4.A: one dominant AI search with a compact hero",()=>{
  assert.match(view,/Quale tubo cerchi\?/);
  assert.match(view,/<EuProducerIntelligenceChat\/>/);
  assert.equal((view.match(/<EuProducerIntelligenceChat\/>/g)||[]).length,1);
  assert.match(chat,/Ricerca tecnica AI/);
  assert.match(view,/Come leggere le evidenze tecniche/);
  assert.match(view,/Nessuna combinazione norma, grado, dimensione e spessore viene dedotta/);
  assert.ok(chat.indexOf('<form onSubmit={submit}') < chat.indexOf('Domande di esempio'),
    "AI query field must precede example chips on mobile");
  assert.match(chat,/void runSearch\(example\.question\)/);

  assert.doesNotMatch(view,/rounded-\[24px\].*bg-\[linear-gradient/);
  assert.doesNotMatch(view,/Funzioni in arricchimento|Dal produttore alla RFQ/);
  assert.doesNotMatch(view,/Apri anteprima →/);
  assert.doesNotMatch(chat,/Risposte con fonti · PRO/);
});

test("UX4.A: secondary producer/company browse remains accessible and fully functional",()=>{
  assert.match(view,/<details className="group/);
  assert.match(view,/data-testid="network-producers-browse-toggle"/);
  assert.match(view,/Sfoglia per azienda o Paese/);
  assert.match(view,/open=\{Boolean\(query\)\}/);
  assert.match(view,/<Form action="\/network\/pro\/producers"/);
  assert.match(view,/name="country" defaultValue=\{country\}/);
  assert.match(view,/name="q" type="search"/);
  assert.match(view,/Cerca aziende/);
  assert.match(view,/href="\/network\/cataloghi"/);
  assert.match(view,/data-testid="network-producers-list"/);
});

test("UX4.A: source-bound trust, locked state and comparison are unchanged",()=>{
  assert.match(view,/result\.status==="locked"/);
  assert.match(view,/result\.status==="unavailable"/);
  assert.match(view,/result\.status==="ready"\?result\.data\.items/);
  assert.match(view,/Dati tecnici con fonte · \{evidence\.length\}/);
  assert.match(view,/data-testid="producer-compare-bar"/);
  assert.match(view,/href="#producer-compare"/);
  assert.match(view,/href=\{item\.sourceUrl\}/);
  assert.match(chat,/data-testid="eu-producer-source-match"/);
  assert.match(chat,/Prepara Distinta \/ RFQ/);
  assert.match(view,/style=\{\{color:"#ffffff",WebkitTextFillColor:"#ffffff"\}\}/);
  assert.match(chat,/style=\{\{color:"#ffffff",WebkitTextFillColor:"#ffffff"\}\}/);

  assert.match(chat,/sourceUrl/);
  assert.match(page,/getNetworkProScopedDirectory/);
  assert.doesNotMatch(view,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(chat,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("UX4.A: mobile constraints stay fluid, readable and keyboard-accessible",()=>{
  assert.match(view,/max-w-\[1320px\]/);
  assert.match(view,/flex flex-col gap-3 sm:flex-row/);
  assert.match(view,/min-w-0/);
  assert.match(view,/focus-visible:outline-2/);
  assert.match(view,/min-h-12/);
  assert.match(view,/overflow-x-auto/);
  assert.match(chat,/min-h-12/);
});
