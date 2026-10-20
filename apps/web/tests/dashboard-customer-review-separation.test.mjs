import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const metrics = read("../lib/commercial-data.ts");
const review = read("../app/(italian)/(workspace)/review/page.tsx");
const reviewLayout = read("../app/(italian)/(workspace)/operations/review/layout.tsx");
const chrome = read("demotest23-chrome-auth.mjs");

test("Customer Home urgency includes only actionable RFQ buyer tasks, not parser QA", () => {
  const attention = home.slice(
    home.indexOf("const attentionItems = ["),
    home.indexOf("const attentionCount =")
  );
  assert.match(attention, /procurementActions\.map/);
  assert.match(attention, /appRoutes\.commercial\.home \+ "\?view=sent&item=campaign:"/);
  assert.doesNotMatch(attention, /metrics\.reviewFlags|appRoutes\.operations\.review|Elementi da verificare/);
  assert.match(home, /procurementActions =/);
  assert.match(home, /\.filter\(\(item\) => item\.requires_action === true/);
  assert.match(home, /attentionCount > 0/);
});

test("Existing tenant-scoped technical review pipeline remains intact", () => {
  assert.match(metrics, /reviewFlags: Number\(metric\.review_pending \?\? 0\)/);
  assert.match(metrics, /from\("commercial_review_queue"\)/);
  assert.match(review, /getReviewItems\(\)/);
  assert.match(review, /ReviewConfirmForm/);
  assert.match(review, /ReviewCorrectForm/);
  assert.match(reviewLayout, /requireWorkspaceAdmin\(\)/);
  assert.doesNotMatch(home, /<Link href=\{appRoutes\.operations\.review\}/);
});

test("Five-account Chrome regression prevents misleading reviewer alert", () => {
  assert.match(chrome, /Technical parser review must not appear as a buyer dashboard action/);
  assert.match(chrome, /Technical data-quality queue is not a commercial priority/);
  assert.match(chrome, /p\.id \+ " dashboard cockpit visual layout and authorization"/);
});
