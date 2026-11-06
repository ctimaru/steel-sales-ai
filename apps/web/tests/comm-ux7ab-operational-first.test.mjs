import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../lib/commercial-row-facts.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { commercialRowAmount, commercialRowQuantity } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const home = read("../app/(italian)/(workspace)/commercial/page.tsx");
const list = read("../components/commercial-unified-worklist.tsx");
const stream = read("../lib/commercial-unified-streams.ts");
const paged = read("../lib/commercial-unified-paged.ts");
const data = read("../lib/commercial-unified-data.ts");

test("COMM-UX7.A preserves priority-first order while compacting the workspace", () => {
  assert.match(home, /lg:min-h-\[78px\]/);
  assert.match(home, /Storico commerciale/);
  assert.ok(home.indexOf("<CommercialDirectorPriorityDesk") < home.indexOf("<CommercialAiCompanion"));
  assert.ok(home.indexOf("<CommercialAiCompanion") < home.indexOf("<CommercialUnifiedWorklist"));
});
test("COMM-UX7.B renders only optional, workspace-authorized commercial facts", () => {
  assert.match(data, /rowFacts\?: CommercialRowFacts/);
  assert.match(data, /total_meters,total_tonnes/);
  assert.match(stream, /total_eur,created_at,campaign/);
  assert.match(paged, /commercialRowQuantity\(record\.total_tonnes, record\.total_meters\)/);
  assert.match(paged, /rowFacts: \{ dueAt: record\.due_at \?\? undefined \}/);
  assert.match(paged, /counterparty: row\.company \|\| undefined/);
  assert.match(paged, /rowFacts: \{ dueAt: campaign\.due_at \?\? undefined \}/);
  assert.match(list, /data-testid="commercial-deal-row-facts"/);
  assert.match(list, /item\.rowFacts\?\.quantity/);
  assert.match(list, /item\.rowFacts\?\.counterparty/);
  assert.match(list, /item\.rowFacts\?\.material/);
  assert.match(list, /commercialRowAmount\(item\.rowFacts\?\.totalEur\)/);
  assert.doesNotMatch(source + stream, /service_role|SUPABASE_SERVICE_ROLE_KEY|autoDispatch/);
});
test("COMM-UX7.B never fabricates negative, malformed or absent amounts", () => {
  for (const bad of [null, undefined, "", "not a number", -1, 0, NaN, Infinity, {}, "1e90"]) {
    assert.equal(commercialRowAmount(bad), null);
    assert.equal(commercialRowQuantity(bad, bad), null);
  }
  assert.equal(commercialRowQuantity(2.345, 100), "2,345 t");
  assert.equal(commercialRowQuantity(null, "48"), "48 m");
  assert.equal(commercialRowAmount("1500.5"), new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(1500.5));
});
