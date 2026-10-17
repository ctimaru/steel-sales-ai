import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const routes = read("../lib/routes.ts");
const tabs = read("../components/business-plan-tabs.tsx");
const page = read("../app/(italian)/(platform)/platform/business-plan/vision/page.tsx");
const view = read("../components/business-plan-vision.tsx");
const source = read("../lib/business-plan-vision-content.ts");
const publicInvestorPage = read("../app/(italian)/(public)/investor/business-plan/[inviteToken]/page.tsx");

test("BP-VISION1 keeps the full masterplan inside owner-only console", () => {
  assert.match(routes, /businessPlanVision: "\/platform\/business-plan\/vision"/);
  assert.match(page, /await requirePlatformSuperadmin\(\)/);
  assert.match(page, /robots: \{ index: false, follow: false, noarchive: true, nocache: true \}/);
  assert.match(page, /<BusinessPlanVision locale=\{locale\} \/>/);
  assert.match(page, /active="vision"/);
  assert.match(tabs, /showPrivateMarketSizing[\s\S]*?key: "vision" as const/);
  assert.match(tabs, /sm:grid-cols-4/);
});

test("BP-VISION1 is bilingual and covers AI, visual workflow, Network and managed Buyer", () => {
  assert.match(source, /"it": \{/);
  assert.match(source, /"en": \{/);
  for (const id of ["SSAI0", "SSAI1", "SSAI2", "SSAI3", "SSAI4", "SSB1", "SSB2", "SSB3", "SSGO1"]) {
    assert.ok(source.includes(id), id);
  }
  assert.match(source, /"40 barre"/);
  assert.match(source, /"120 m lineari"/);
  assert.match(source, /Qwen3 14B/);
  assert.match(source, /Piemonte/);
  assert.match(source, /5–10/);
  assert.match(source, /1,5–3%/);
  assert.match(view, /id="roadmap"/);
  assert.match(view, /id="buyer"/);
  assert.match(view, /id="rischi"/);
});

test("BP-VISION1 never expands shared investor invitation into the private masterplan", () => {
  assert.doesNotMatch(publicInvestorPage, /BusinessPlanVision|businessPlanVision/);
  assert.doesNotMatch(view, /serviceRole|supabase\.rpc|awardSupplier\(/);
  assert.match(source, /"Mai inventare dimensioni/);
  assert.match(source, /"Nessun auto-award/);
});
