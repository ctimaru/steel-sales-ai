import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const director = read("../components/commercial-director-priority-desk.tsx");
const ai = read("../components/commercial-ai-companion.tsx");
const styles = read("../components/commercial-cinematic.module.css");
const hub = read("../app/(italian)/(workspace)/marketplace/rfq-hub/page.tsx");

test("COMM-SIMPLE1: Commerciale is work-first and fits a shorter header before the AI", () => {
  assert.match(commercial, /data-testid="comm-cine1-hero"/);
  assert.doesNotMatch(commercial, /lg:min-h-\[112px\]/);
  assert.match(styles, /\.heroTitle\s*\{[\s\S]*?max-width: none;/);
  const top = ["comm-cine1-hero", "<CommercialDirectorPriorityDesk", "comm-cine13-first-workspace",
    "commercial-primary-quick-actions", "<CommercialUnifiedWorklist"];
  const positions = top.map(key => commercial.indexOf(key));
  assert.ok(positions.every((pos, i) => pos >= 0 && (i === 0 || pos > positions[i-1])));
  assert.equal((commercial.match(/<CommercialAiCompanion/g) ?? []).length, 1);
  assert.equal((commercial.match(/<CommercialUnifiedWorklist/g) ?? []).length, 1);
  assert.match(director, /data-testid="commercial-director-rfq-priorities"/);
  assert.match(director, /confirmedCount/);
  assert.match(ai, /nessuna richiesta viene inviata automaticamente/);
  assert.match(commercial, /<CommercialCalculatorQuickAccess/);
  assert.match(commercial, /data-testid="commercial-history-entry"/);
  assert.match(commercial, /data-testid="commercial-manual-entry"/);
  const toolsStart = commercial.indexOf('id="commercial-tool-access"');
  const toolsEnd = commercial.indexOf("</details>", toolsStart);
  assert.ok(toolsEnd > toolsStart);
  assert.doesNotMatch(commercial.slice(toolsStart, toolsEnd), /Relazioni commerciali|Aziende da seguire|appRoutes\.network\.directory/);
});

test("COMM-SIMPLE1: RFQ Hub prioritizes real data and doesn't show empty cards", () => {
  // RFQHUB1: one list (a row per Distinta with its request state) replaces
  // the summary tiles and the separate campaigns/distinte/offers/orders cards.
  assert.match(hub, /data-testid="rfq-hub-simple-workspace"/);
  assert.match(hub, /data-testid="rfq-hub-list"/);
  assert.match(hub, /data-testid="rfq-hub-row"/);
  assert.doesNotMatch(hub, /rfq-hub-compact-summary|rfq-hub-primary-campaigns|rfq-hub-primary-distinte/);
  assert.match(hub, /const state = rfqHubRowState\(facts\)/);
});

test("COMM-SIMPLE1: tenant scope, read-only viewer and explicit next action remain", () => {
  assert.match(hub, /getWorkspaceContext\(\)/);
  assert.match(hub, /canWriteWorkspace\(context\.role\)/);
  assert.match(hub, /const organizationId = context\.organizationId/);
  assert.equal((hub.match(/\.eq\("organization_id", organizationId\)/g) ?? []).length, 4);
  // RFQHUB1D: «Da gestire» and the menu counter share one org-scoped loader.
  assert.match(hub, /canWrite \? await loadPurchasingAttention\(supabase, organizationId\)/);
  assert.match(hub, /appRoutes\.rfqHub\.campaign\(campaign\.id\)/);
  assert.match(hub, /appRoutes\.rfqHub\.savedDistinta\(distinta\.id\)/);
  assert.doesNotMatch(hub, /service_role|createAdminClient|autoDispatch/);
});
