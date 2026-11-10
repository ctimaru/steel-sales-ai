import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const commercial = fs.readFileSync(
  new URL("../app/(workspace)/commercial/page.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const ia = fs.readFileSync(
  new URL("../lib/workspace-information-architecture.ts", import.meta.url),
  "utf8",
);

test("PF2 keeps Commercial Memory search reachable without a footer block (COMM-DECLUTTER2)", () => {
  assert.match(commercial, /action=\{appRoutes\.commercial\.search\}|appRoutes\.commercial\.search/);
  assert.match(commercial, /data-testid="commercial-history-entry"/);
  assert.doesNotMatch(commercial, /Ricerca su dati già presenti|Cosa contiene il workspace|Ultimi movimenti|getDashboardData/);
});

test("PF2 no longer renders drill-down and intelligence blocks at the bottom of Commerciale (COMM-DECLUTTER2)", () => {
  assert.doesNotMatch(commercial, /commercial-memory-panel|commercial-tools-panel/);
  assert.doesNotMatch(commercial, /Tre modi per leggere la memoria|Analizza solo quando serve|Intelligence avanzata|7 strumenti/);
});

test("PF2 groups Explorer and specialist tools under task-based Analisi", () => {
  const commercialBlock = shell.slice(
    shell.indexOf("const commercialNav"),
    shell.indexOf("const networkNav"),
  );
  assert.equal((commercialBlock.match(/contextKey:/g) || []).length, 3);
  assert.match(commercialBlock, /label: "Analisi"/);
  assert.doesNotMatch(commercialBlock, /label: "Explorer"|label: "Prezzi"|label: "Mercato"/);
  assert.match(ia, /commercial:intelligence:explorer/);
});

test("PF2 explicitly preserves Commercial Memory privacy boundaries", () => {
  assert.match(commercial, /Commercial Workspace|Le tue trattative/);
  assert.match(commercial, /confini dei dati restano distinti/);
  assert.match(commercial, /non condividono automaticamente prezzi, contatti o documenti/);
});
