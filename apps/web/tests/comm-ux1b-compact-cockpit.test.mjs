import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const worklist = read("../components/commercial-unified-worklist.tsx");
const focus = read("../components/focus-ui.tsx");
const data = read("../lib/commercial-unified-data.ts");

test("COMM-UX1B uses opt-in compact layout without compressing other workspaces", () => {
  assert.match(focus, /compact = false/);
  assert.match(focus, /compact \? "space-y-4" : "space-y-7"/);
  assert.match(focus, /compact\s*\? "mt-0.5 text-xl/);
  assert.match(commercial, /<FocusPage compact /);
  assert.match(commercial, /<FocusHeader\s+compact/);
  assert.match(commercial, /Tutto il lavoro commerciale, in un unico posto/);
  assert.match(commercial, /workspace privato della tua organizzazione/);
});

test("COMM-UX1B replaces the tall action cards with one accessible task strip", () => {
  assert.match(commercial, /data-testid="commercial-compact-actions"/);
  assert.match(commercial, /className="app-primary inline-flex min-h-10/);
  assert.match(commercial, /data-testid="commercial-compact-attention"/);
  assert.match(commercial, /aria-labelledby="commercial-today"/);
  assert.match(commercial, /Che cosa vuoi fare oggi\?/);
  assert.match(commercial, /Cosa richiede attenzione/);
  assert.match(commercial, /actionableRfqs\.slice\(0, 2\)/);
  assert.match(commercial, /appRoutes\.rfqHub\.inbox/);
  assert.match(commercial, /canWrite \? \(/);
  assert.match(commercial, /Priorità non disponibili al momento/);
  assert.match(commercial, /Consultazione in sola lettura/);
  assert.doesNotMatch(commercial, /lg:grid-cols-\[1\.15fr_0\.85fr\]/);
});

test("COMM-UX1B shows filters on one desktop row and preserves search and six views", () => {
  assert.match(worklist, /data-testid="commercial-compact-filters"/);
  assert.match(worklist, /app-selected-solid/);
  assert.match(worklist, /lg:flex-row lg:items-center/);
  assert.match(worklist, /aria-label="Filtra attività commerciali"/);
  assert.match(worklist, /role="search"/);
  assert.match(worklist, /commercial-worklist-q/);
  assert.match(worklist, /commercialHref\(key, query\)/);
  assert.match(worklist, /views\.map/);
  assert.match(worklist, /type="hidden" name="view"/);
  assert.match(worklist, /Filtra/);
  assert.doesNotMatch(worklist, /\+ Nuova distinta/); // use one canonical create CTA
});

test("COMM-UX1B uses natural document scrolling and dense activity rows", () => {
  assert.match(worklist, /min-h-\[64px\]/);
  assert.match(worklist, /divide-y divide-\[var\(--border\)\]/);
  assert.doesNotMatch(worklist, /max-h-\[520px\] divide-y/);
  assert.match(worklist, /tabular-nums/);
  assert.match(worklist, /item\.status/);
  assert.match(worklist, /item\.origin/);
  assert.match(worklist, /item\.subtitle/);
  assert.match(worklist, /item\.at \? formatHubDate/);
  assert.match(worklist, /aria-current/);
  assert.match(worklist, /commercial-detail/);
});

test("COMM-UX1B retains private RFQ, explicit manual actions and tenant isolation", () => {
  assert.match(commercial, /<BuyerDistintaBuilder/);
  assert.match(commercial, /<CommercialUnifiedWorklist/);
  assert.match(commercial, /canWriteWorkspace\(context\.role\)/);
  assert.match(commercial, /Nessun invio ai fornitori avviene automaticamente/);
  assert.match(data, /\.eq\("organization_id", organizationId\)/);
  assert.match(worklist, /Attività non trovata nella vista corrente o non autorizzata/);
  assert.doesNotMatch(worklist, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
