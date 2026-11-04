import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const preview = read("../components/dashboard-pulse-preview.tsx");

test("HOME-AUTH-PULSE2 removes Overview attention without losing real tasks", () => {
  // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
  assert.doesNotMatch(home, /<DashboardPulsePreview/, "no demo cards on the Home");
  // HOME-FOCUS1 (founder decision, 4 Nov 2026): the Home RFQ box and the "Cosa richiede attenzione" strip were removed; superseded checks rewritten.
  assert.doesNotMatch(home, /id="daily-priorities"|attentionItems/);
  assert.ok(home.indexOf("<HomeFeed ") > 0);
});

test("HOME-AUTH-PULSE2 demos never pose as real publication or live RFQ", () => {
  assert.match(preview, /state\.available \? state\.feed\?\.items\.slice\(0, 3\)/);
  assert.match(preview, /const demo = published\.length === 0/);
  assert.match(preview, /Anteprime demo · Non sono notizie/);
  assert.match(preview, /Contenuti illustrativi, non notizie pubblicate/);
  assert.match(preview, /sourceUrl: item\.source_url/);
  assert.match(preview, /target="_blank" rel="noopener noreferrer"/);
  assert.match(preview, /data-demo="true"/);
  assert.doesNotMatch(preview, /Date\.now\(|giorni fa|2024|faker|Math\.random|sendEmail|service_role|insert\(/);
});

test("HOME-AUTH-PULSE2 responsive cards use only vetted published feed and illustrative assets", () => {
  assert.match(preview, /md:grid-cols-2 xl:grid-cols-3/);
  assert.match(preview, /<Image src=\{card\.image\} alt=""/);
  assert.match(preview, /href=\{appRoutes\.steelPulse\}/);
  assert.doesNotMatch(preview, /fetch\(|createClient|dangerouslySetInnerHTML/);
  assert.match(home, /loadDashboardPulse\(\)/);
});
