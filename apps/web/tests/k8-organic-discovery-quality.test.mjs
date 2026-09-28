import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const seo = fs.readFileSync(new URL("../lib/seo.ts", import.meta.url), "utf8");
const rootLayout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const workspaceLayout = fs.readFileSync(new URL("../app/(workspace)/layout.tsx", import.meta.url), "utf8");
const robots = fs.readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const standards = fs.readFileSync(new URL("../app/(public)/knowledge/norme/page.tsx", import.meta.url), "utf8");
const grades = fs.readFileSync(new URL("../app/(public)/knowledge/gradi/page.tsx", import.meta.url), "utf8");
const tubes = fs.readFileSync(new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const register = fs.readFileSync(new URL("../app/register/page.tsx", import.meta.url), "utf8");
const onboarding = fs.readFileSync(new URL("../app/onboarding/page.tsx", import.meta.url), "utf8");
const knowledgeHome = fs.readFileSync(new URL("../app/(public)/knowledge/page.tsx", import.meta.url), "utf8");

test("K8 supports Search Console verification without hardcoding a token", () => {
  assert.match(rootLayout, /googleSiteVerification/);
  assert.match(rootLayout, /verification:/);
  assert.match(seo, /NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION/);
  assert.doesNotMatch(rootLayout, /google-site-verification=/);
});

test("K8 keeps private and authentication surfaces out of the index", () => {
  assert.match(workspaceLayout, /privateNoIndexRobots/);
  assert.match(login, /robots: privateNoIndexRobots/);
  assert.match(register, /robots: privateNoIndexRobots/);
  assert.match(onboarding, /robots: privateNoIndexRobots/);
  assert.match(robots, /"\/forgot-password"/);
  assert.match(robots, /"\/reset-password"/);
  assert.match(robots, /"\/registration\/"/);
});

test("K8 noindexes parameterized catalog and calculator variants while keeping clean canonicals", () => {
  assert.match(seo, /parameterizedNoIndexRobots/);
  assert.match(seo, /index: false/);
  assert.match(seo, /follow: true/);
  for (const source of [standards, grades, tubes]) {
    assert.match(source, /generateMetadata/);
    assert.match(source, /robotsForParameterizedPage/);
    assert.match(source, /canonical: absoluteUrl/);
  }
});

test("K8 sitemap uses truthful editorial freshness and guards protocol capacity", () => {
  assert.match(sitemap, /standard\.last_reviewed_at/);
  assert.match(sitemap, /grade\.last_reviewed_at/);
  assert.match(sitemap, /finalizePublicSitemap/);
  assert.doesNotMatch(sitemap, /const now = new Date/);
  assert.match(seo, /45_000/);
  assert.match(seo, /50_000/);
  assert.match(seo, /Split the sitemap before publishing more pages/);
});

test("K8 deduplicates sitemap URLs before publishing", () => {
  assert.match(seo, /new Map<string, MetadataRoute\.Sitemap\[number\]>/);
  assert.match(seo, /unique\.set\(entry\.url, entry\)/);
});

test("K8 removes stale Knowledge copy now that the calculator and clusters are live", () => {
  assert.doesNotMatch(knowledgeHome, /futuro calcolatore/);
  assert.match(knowledgeHome, /cluster per famiglia, dimensione esterna e spessore/);
});
