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

test("PF2 makes search the dominant Commercial Memory action", () => {
  assert.match(commercial, /Cerca nella Commercial Memory/);
  assert.match(commercial, /Prodotto, cliente, RFQ, offerta, ordine o prezzo/);
  assert.match(commercial, /action=\{appRoutes\.commercial\.search\}/);
  assert.match(commercial, /name="q"/);
  assert.match(commercial, /type="search"/);
});

test("PF2 shows real workspace memory and recent commercial movement", () => {
  assert.match(commercial, /getDashboardData/);
  assert.match(commercial, /Cosa contiene il workspace/);
  assert.match(commercial, /operational\.rfqs/);
  assert.match(commercial, /operational\.offers/);
  assert.match(commercial, /operational\.orders/);
  assert.match(commercial, /metrics\.reviewFlags/);
  assert.match(commercial, /Ultimi movimenti/);
  assert.match(commercial, /recent\.slice\(0, 5\)/);
});

test("PF2 keeps Product 360 Company 360 and Assistant as three primary drill-downs", () => {
  assert.match(commercial, /Product 360/);
  assert.match(commercial, /Company 360/);
  assert.match(commercial, /AI privata/);
  assert.match(commercial, /appRoutes\.commercial\.products/);
  assert.match(commercial, /appRoutes\.commercial\.companies/);
  assert.match(commercial, /appRoutes\.commercial\.assistant/);
});

test("PF2 groups intelligence by commercial goal instead of a flat seven-tool list", () => {
  assert.match(commercial, /Prezzi & mercato/);
  assert.match(commercial, /Opportunità commerciali/);
  assert.match(commercial, /Relazioni/);
  assert.match(commercial, /PriceIntelligence|priceIntelligence/);
  assert.match(commercial, /marketIntelligence/);
  assert.match(commercial, /reengagement/);
  assert.match(commercial, /demand/);
  assert.match(commercial, /conversion/);
  assert.match(commercial, /crossThreadRelationships/);
  assert.doesNotMatch(commercial, /Intelligence avanzata/);
  assert.doesNotMatch(commercial, /7 strumenti/);
});

test("PF2 simplifies Commercial navigation and moves Explorer under Intelligence", () => {
  const commercialBlock = shell.slice(
    shell.indexOf("const commercialNav"),
    shell.indexOf("const intelligenceNav"),
  );
  const intelligenceBlock = shell.slice(
    shell.indexOf("const intelligenceNav"),
    shell.indexOf("const networkNav"),
  );

  assert.doesNotMatch(commercialBlock, /appRoutes\.commercial\.explorer/);
  assert.match(intelligenceBlock, /appRoutes\.commercial\.explorer/);
  assert.match(intelligenceBlock, /label: "Prezzi"/);
  assert.match(intelligenceBlock, /label: "Mercato"/);
  assert.match(intelligenceBlock, /label: "Relazioni"/);
  assert.match(ia, /commercial:intelligence:explorer/);
});

test("PF2 explicitly preserves Commercial Memory privacy boundaries", () => {
  assert.match(commercial, /workspace privato/);
  assert.match(commercial, /Network e Marketplace restano spazi separati/);
  assert.match(commercial, /non pubblicano automaticamente dati commerciali interni/);
});
