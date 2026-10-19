import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const browser=read("./school-growth1e-chrome-acceptance.mjs");
const local=read("../../../.github/workflows/perf2-1-mobile-acceptance.yml");
const production=read("../../../.github/workflows/school-growth1e-production.yml");
const preview=read("../../../.github/workflows/ui-system4-vercel-preview.yml");
const content=read("../app/(public)/knowledge/page.tsx");
const articles=read("../lib/school-articles.ts");

test("SCHOOL-GROWTH1E tests real public assets, including PNG IHDR dimension and HTTP MIME",()=>{
  for(const path of ["/api/school-og","/school/visuals/","/knowledge/articoli/"])assert.ok(browser.includes(path),path);
  assert.match(browser,/image\/png/);
  assert.match(browser,/image\/svg\+xml/);
  assert.match(browser,/readUInt32BE\(16\),1200/);
  assert.match(browser,/readUInt32BE\(20\),630/);
  assert.match(browser,/response\.status, 200/);
  assert.match(browser,/summary_large_image/);
  assert.match(browser,/link\[rel="canonical"\]/);
  assert.match(browser,/meta\[name="robots"\]/);
});

test("SCHOOL-GROWTH1E mobile and desktop screenshots, computed contrast and overflow have hard checks",()=>{
  assert.match(browser,/for \(const width of \[390,1440\]\)/);
  assert.match(browser,/ratio>=4\.5/);
  assert.match(browser,/geom\.scroll <= geom\.viewport\+12/);
  assert.match(browser,/page\.screenshot/);
  assert.match(browser,/scrollIntoViewIfNeeded/);
  assert.match(browser,/coverIndex<coverCount/);
  assert.match(browser,/school-primary-action, .school-secondary-action/);
  assert.match(browser,/isMobile:width===390/);
  assert.match(browser,/if \(!\["GET","HEAD"\]\.includes\(req\.method\(\)\)/);
  assert.match(browser,/fs\.writeFile\(OUT\+"\/report\.json"/);
});

test("SCHOOL-GROWTH1E has both localhost build validation and production deployment acceptance",()=>{
  assert.match(local,/node tests\/school-growth1e-chrome-acceptance\.mjs/);
  assert.match(local,/name: school-growth1e-chrome-local-qa/);
  assert.match(local,/LIGHTHOUSE/);
  assert.match(production,/deployment_status:/);
  assert.match(production,/deployment\.environment == 'Production'/);
  assert.match(production,/https:\/\/www\.smartsteelsales\.com/);
  assert.match(production,/school-growth1e-production-evidence/);
  assert.doesNotMatch(production,/VERCEL_AUTOMATION_BYPASS_SECRET|on:\s*schedule:/);
  assert.match(preview,/VERCEL_AUTOMATION_BYPASS_SECRET/);
});

test("SCHOOL-GROWTH1E preserves School article schema and lightweight visual assets",()=>{
  assert.match(content,/canonical: absoluteUrl\("\/knowledge"\)/);
  assert.match(articles,/visual: \{ src: string; alt: string; caption: string \}/);
  assert.ok((articles.match(/"src":"\/school\/visuals\//g)||[]).length>=3);
});
