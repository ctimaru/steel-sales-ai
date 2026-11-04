import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const homeFeedViewerSource = readFileSync(new URL("../lib/home-feed-viewer.ts", import.meta.url), "utf8");
const homeFeedSource = readFileSync(new URL("../lib/home-feed.ts", import.meta.url), "utf8"); // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const navigation = read("../components/workspace-home-panels.tsx");

test("HOME-AUTH-UX1 local navigation focuses the Home without replacing the global shell", () => {
  // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
  assert.doesNotMatch(home, /WorkspaceHomePanels/);
  for (const id of ["home-left-rail", "home-center", "home-right-rail"]) assert.match(home, new RegExp('data-testid="' + id + '"'));
  assert.doesNotMatch(home, /<main/, "the shell already owns <main>");
});

test("HOME-AUTH-UX1 routes to actual assistant and existing commercial tools", () => {
  // HOME-FOCUS1 (founder decision, 4 Nov 2026): the RFQ box left the Home; the assistant
  // handoff lives in the Commerciale companion and the Home keeps its Distinta link.
  const companion = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");
  assert.match(companion, /sss:commercial-ai-intake-handoff/);
  assert.doesNotMatch(companion, /service_role|sendEmail/);
  assert.doesNotMatch(home, /HomeAiComposer/);
  assert.match(home, /href="\/distinta"/);
});

test("HOME-AUTH-UX1 keeps all permission boundaries at the server and honest KPI/status data", () => {
  assert.match(home, /getWorkspaceContext\(\)/);
  assert.match(home, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(homeFeedSource, /getMarketplaceFeed\(viewer\.organizationId/);
  assert.match(home, /canWriteWorkspace\(context\.role\)/);
  assert.match(home, /mode === "live" && operationalKpis.length > 0/);
  assert.match(home, /Nessun dato dimostrativo viene mostrato come reale/);
});

