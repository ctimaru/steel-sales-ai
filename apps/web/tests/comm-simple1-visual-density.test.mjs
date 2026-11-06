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
  assert.match(commercial, /lg:min-h-\[78px\]/);
  assert.doesNotMatch(commercial, /lg:min-h-\[112px\]/);
  assert.match(styles, /\.heroTitle\s*\{[\s\S]*?max-width: none;/);
  const top = ["comm-cine1-hero", "<CommercialDirectorPriorityDesk", "comm-cine13-first-workspace",
    "commercial-primary-quick-actions", "<CommercialUnifiedWorklist"];
  const positions = top.map(key => commercial.indexOf(key));
  assert.ok(positions.every((pos, i) => pos >= 0 && (i === 0 || pos > positions[i-1])));
  assert.equal((commercial.match(/<CommercialAiCompanion/g) ?? []).length, 1);
  assert.equal((commercial.match(/<CommercialUnifiedWorklist/g) ?? []).length, 1);
  assert.match(director, /data-testid="commercial-compact-attention"/);
  assert.match(director, /data-testid="commercial-director-rfq-priorities"/);
  assert.match(director, /data-testid="commercial-director-resume"/);
  assert.match(director, /confirmedCount/);
  assert.match(ai, /nessuna richiesta viene inviata automaticamente/);
  assert.match(commercial, /<CommercialCalculatorQuickAccess/);
  assert.match(commercial, /data-testid="commercial-history-entry"/);
  assert.match(commercial, /data-testid="commercial-manual-entry"/);
  const toolsStart = commercial.indexOf('id="commercial-tool-access"');
  const toolsEnd = commercial.indexOf("      </section>", toolsStart);
  assert.ok(toolsEnd > toolsStart);
  assert.doesNotMatch(commercial.slice(toolsStart, toolsEnd), /Relazioni commerciali|Aziende da seguire|appRoutes\.network\.directory/);
});

test("COMM-SIMPLE1: RFQ Hub prioritizes real data and doesn't show empty cards", () => {
  assert.match(hub, /data-testid="rfq-hub-simple-workspace"/);
  assert.match(hub, /data-testid="rfq-hub-compact-summary"/);
  assert.match(hub, /data-testid="rfq-hub-actionable"/);
  assert.match(hub, /data-testid="rfq-hub-primary-campaigns"/);
  assert.match(hub, /data-testid="rfq-hub-primary-distinte"/);
  assert.match(hub, /\(quotes\.error \|\| recentQuotes\.length > 0\) \? \(/);
  assert.match(hub, /\(orders\.error \|\| recentOrders\.length > 0\) \? \(/);
  assert.match(hub, /inactive=\{!quotes\.error && quoteCount\.count === 0\}/);
  assert.match(hub, /inactive=\{!orders\.error && orderCount\.count === 0\}/);
  assert.ok(hub.indexOf('data-testid="rfq-hub-compact-summary"') <
    hub.indexOf('data-testid="rfq-hub-primary-campaigns"'));
  assert.ok(hub.indexOf('data-testid="rfq-hub-primary-campaigns"') <
    hub.indexOf('data-testid="rfq-hub-primary-distinte"'));
});

test("COMM-SIMPLE1: tenant scope, read-only viewer and explicit next action remain", () => {
  assert.match(hub, /getWorkspaceContext\(\)/);
  assert.match(hub, /canWriteWorkspace\(context\.role\)/);
  assert.match(hub, /const organizationId = context\.organizationId/);
  assert.equal((hub.match(/\.eq\("organization_id", organizationId\)/g) ?? []).length, 8);
  assert.match(hub, /parseHubInboxItems\(inboxResult\.data, visibleRfqIds\)/);
  assert.match(hub, /Le attività operative sono disponibili ai ruoli autorizzati/);
  assert.match(hub, /href=\{appRoutes\.rfqHub\.campaign\(campaign\.id\)\}/);
  assert.match(hub, /href=\{appRoutes\.rfqHub\.savedDistinta\(draft\.id\)\}/);
  assert.doesNotMatch(hub, /service_role|createAdminClient|autoDispatch/);
});
