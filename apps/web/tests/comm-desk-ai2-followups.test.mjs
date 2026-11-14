import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const out = ts.transpileModule(read("../lib/commercial-desk-intent.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { commercialDeskIntent: desk } = await import("data:text/javascript;base64," + Buffer.from(out).toString("base64"));
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const shell = read("../components/commercial-ai-native-shell.tsx");
const worklist = read("../components/commercial-unified-worklist.tsx");
const nav = read("../lib/commercial-director-navigation.ts");

test("COMM-DESK-AI2 le domande sulla scrivania diventano filtri esistenti", () => {
  const href = (text) => desk(text)?.href ?? null;
  assert.equal(href("Quali richieste scadono questa settimana?"), "/commercial?focus=due");
  assert.equal(href("Mostrami le trattative in scadenza"), "/commercial?focus=due");
  assert.equal(href("Quali richieste sono da rispondere?"), "/commercial?focus=reply");
  assert.equal(href("Fammi vedere le offerte in attesa"), "/commercial?focus=waiting");
  assert.equal(href("Mostra le bozze"), "/commercial?view=drafts");
  assert.equal(href("Apri le distinte"), "/commercial?view=drafts");
  assert.equal(href("Quali richieste ho ricevuto dai clienti?"), "/commercial?view=received");
  assert.equal(href("Mostrami le richieste di offerta inviate"), "/commercial?view=sent");
  assert.equal(href("Elenca le RFQ ai fornitori"), "/commercial?view=sent");
  assert.equal(href("Fammi vedere le offerte"), "/commercial?view=offers");
  assert.equal(href("Mostrami gli ordini"), "/commercial?view=orders");
  assert.equal(href("Mostrami tutte le trattative"), "/commercial");
});

test("COMM-DESK-AI3 filtro dalla chat: il menu resta su Scrivania e il vuoto parla chiaro", () => {
  const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
  // Senza ?view la pagina usa la vista «all», l'unica in cui il focus è valido.
  assert.match(page, /const focus = view === "all" \? parseCommercialFocus\(params\.focus\) : ""/);
  assert.match(page, /params\.focus !== undefined/);
  const list = read("../components/commercial-unified-worklist.tsx");
  assert.match(list, /due: "Niente in scadenza nei prossimi 7 giorni"/);
  assert.match(list, /focus && !query \? focusEmptyTitles\[focus\]/);
});

test("COMM-DESK-AI2 creazione, ricerca aziende e domande tecniche restano all'assistente", () => {
  for (const text of [
    "Chi produce tubo S355 Ø608?",
    "Preparami 24 barre Ø608×10 EN 10219, S355J2H, lunghezza 12 m.",
    "Qual è la differenza tra EN 10219 ed EN 10210?",
    "Crea una richiesta di offerta per 40 tubi",
    "Quali produttori ci sono in Romania?",
    "Trova fornitori di tubi con ordini aperti",
    "Buongiorno",
    "",
  ]) assert.equal(desk(text), null, text);
});

test("COMM-DESK-AI2 la chat filtra senza AI e senza perdere la conversazione", () => {
  const branch = shell.slice(shell.indexOf("const desk = compact ? commercialDeskIntent(question) : null;"), shell.indexOf("const topic = classifyCommercialAiNativeTopic(question);"));
  assert.match(branch, /router\.push\(desk\.href, \{ scroll: false \}\)/);
  assert.match(branch, /return;/);
  assert.doesNotMatch(branch, /commercialAiNativeResponse/);
  assert.match(shell, /turn\.state !== "answered" \|\| turn\.desk \? \[\]/);
  assert.match(shell, /data-testid="commercial-ai-native-desk-filter"/);
});

test("COMM-DESK-AI2 nomi distinti, ricerca chiarita e link riallineati", () => {
  assert.match(page, /Calcolatrice e storico <span/);
  assert.doesNotMatch(page, /\n\s+Strumenti <span/);
  assert.match(worklist, /placeholder="Filtra queste trattative…"/);
  assert.match(worklist, /data-testid="commercial-filter-scope"/);
  assert.match(worklist, /href=\{commercialSearchHref\(query\)\}/);
  assert.doesNotMatch(page + nav, /experience=classic#/);
});
