import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const src=readFileSync(new URL("../components/commercial-unified-worklist.tsx",import.meta.url),"utf8");
test("selected deal fact brief uses only grounded visible fields without automatic AI disclosure",()=>{
 assert.match(src,/data-testid="commercial-deal-fact-brief"/);
 assert.match(src,/itemType\(item\)/);
 assert.match(src,/detail\?\.status \?\? item\.status/);
 assert.match(src,/item\.title/);
 assert.match(src,/item\.origin/);
 assert.match(src,/non vengono dedotti da questa sintesi/);
 assert.match(src,/href=\{appRoutes\.commercial\.assistant\}/);
 assert.match(src,/<CommercialDealFactBriefCopy key=\{item\.key\} kind=\{item\.kind\} dealId=\{item\.id\}/);
 assert.doesNotMatch(src,/href=\{[^}]*encodeURIComponent\(item\./);
});

test("copy to assistant requires manual action and exposes provenance caveat",()=>{
 const copy=readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx",import.meta.url),"utf8");
 assert.match(copy,/"use client"/);
 assert.match(copy,/onClick=\{\(\) => void copyFacts\(\)\}/);
 assert.match(copy,/navigator\.clipboard\.writeText/);
 assert.match(copy,/Non dedurre offerte, email o documenti/);
 assert.match(copy,/aria-live="polite"/);
 assert.match(copy,/aria-pressed=\{question === option\}/);
 assert.match(copy,/Domanda: " \+ question\.trim\(\)/);
 assert.match(copy,/setQuestion\(option\)/);
});

test("same-tab context handoff is explicit and does not use clipboard or URL",()=>{
 const copy=readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx",import.meta.url),"utf8");
 assert.match(copy,/onClick=\{\(\) => void copyFacts\(true\)\}/);
 assert.match(copy,/sessionStorage\.setItem\("sss:commercial-assistant-draft:v1"/);
 assert.match(copy,/router\.push\(appRoutes\.commercial\.assistant\)/);
 assert.match(copy,/Prepara nell’assistente/);
 assert.doesNotMatch(copy,/encodeURIComponent\(contextText\)/);
});

test("editable question and exact preview make copied facts transparent",()=>{
 const copy=readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx",import.meta.url),"utf8");
 assert.match(copy,/value=\{question\} onChange=/);
 assert.match(copy,/maxLength=\{500\}/);
 assert.match(copy,/Anteprima esatta del contesto da copiare/);
 assert.match(copy,/\{contextText\}/);
 assert.match(copy,/if \(!question\.trim\(\)\)/);
});

test("assistant reviews handoff before any AI submission",()=>{
 const assistant=readFileSync(new URL("../components/grounded-assistant.tsx",import.meta.url),"utf8");
 assert.match(assistant,/sessionStorage\.getItem\(key\)/);
 assert.match(assistant,/sessionStorage\.removeItem\(key\)/);
 assert.match(assistant,/commercial-assistant-context-review/);
 assert.match(assistant,/Nessun dato è stato inviato all’AI/);
 assert.match(assistant,/Usa questo contesto/);
 assert.match(assistant,/Scarta/);
 assert.match(assistant,/incomingDraft\.trim\(\)\.length >= 2 && incomingDraft\.length <= 1000/);
 assert.match(assistant,/setQuery\(incomingDraft\)/);
 assert.match(assistant,/Nessun testo verrà tagliato automaticamente/);
 assert.match(assistant,/id="commercial-context-edit"/);
 assert.match(assistant,/setIncomingDraft\(event\.target\.value\)/);
});

test("NEXT6 uses only already visible linked activity facts and never invents linked offers",()=>{
 const copy=readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx",import.meta.url),"utf8");
 assert.match(src,/relatedActivities=\{related\.slice\(0, 4\)\.map/);
 assert.match(copy,/relatedActivities\.slice\(0, 4\)\.map/);
 assert.match(copy,/Attività collegate: non disponibili in questo riepilogo/);
 assert.match(copy,/verificare il dettaglio originale/);
});

test("NEXT6 source lookup is explicit and evidence-bound",()=>{
 const copy=readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx",import.meta.url),"utf8");
 assert.match(copy,/Cerca nelle email e nei documenti disponibili le offerte/);
 assert.match(copy,/cita le fonti e indica cosa non è verificabile/);
 assert.match(copy,/if \(contextText\.length > 1000\)/);
});

test("NEXT6 authorized evidence lookup requires auth and canonical ID",()=>{
 const action=readFileSync(new URL("../app/(italian)/(workspace)/assistant/deal-context-actions.ts",import.meta.url),"utf8");
 const copy=readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx",import.meta.url),"utf8");
 assert.match(action,/supabase\.auth\.getUser\(\)/);
 assert.match(action,/uuid\.test\(id\)/);
 assert.match(action,/getOperationalEntityData\(operationalKind, id\)/);
 assert.match(action,/detail\.mode !== "live"/);
 assert.match(action,/detail\.lines\.slice\(0, 3\)/);
 assert.match(copy,/loadAuthorizedDealEvidence\(kind, dealId\)/);
 assert.match(copy,/onClick=\{\(\) => void verifyEvidence\(\)\}/);
 assert.match(copy,/setVerifiedFacts\(result\.facts\)/);
});

test("deal switching isolates context and provenance identifies partial evidence",()=>{
 const action=readFileSync(new URL("../app/(italian)/(workspace)/assistant/deal-context-actions.ts",import.meta.url),"utf8");
 assert.match(src,/CommercialDealFactBriefCopy key=\{item\.key\}/);
 assert.match(action,/sourceObservationId !== null/);
 assert.match(action,/Altri articoli disponibili nel dettaglio originale/);
 assert.match(action,/Articoli mostrati nel riepilogo/);
});
