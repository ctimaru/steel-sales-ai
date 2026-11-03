import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("English calculator preserves exact self-canonical and reciprocal locale URLs", () => {
  const page = read("app/(english)/en/knowledge/tubes/page.tsx");
  assert.match(page, /canonical:\s*absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  for (const [locale, path] of Object.entries({
    it: "/knowledge/tubes",
    en: "/en/knowledge/tubes",
    de: "/de/knowledge/tubes",
    fr: "/fr/knowledge/tubes",
    es: "/es/knowledge/tubes",
  })) {
    assert.ok(page.includes(`${locale}: absoluteUrl("${path}")`), `Missing ${locale} alternate`);
  }
  assert.match(page, /robots:\s*robotsForParameterizedPage\(hasParameters\)/);
  assert.match(page, /const hasParameters\s*=\s*Object\.values\(params\)/);
});

test("Sitemap offers complete matching international tube calculator alternates", () => {
  const sitemap = read("app/sitemap.ts");
  for (const locale of ["it", "en", "de", "fr", "es"]) {
    const path = locale === "it" ? "/knowledge/tubes" : `/${locale}/knowledge/tubes`;
    assert.ok(sitemap.includes(`absoluteUrl("${path}")`) || sitemap.includes(`absoluteUrl(\`/${locale}/knowledge/tubes\`)`), `Missing ${locale} tube page in sitemap source`);
  }
  assert.match(sitemap, /finalizePublicSitemap/);
});

test("Robots publishes sitemap while preserving restricted workspaces", () => {
  const robots = read("app/robots.ts");
  assert.match(robots, /sitemap:\s*absoluteUrl\("\/sitemap\.xml"\)/);
  assert.match(robots, /"\/dashboard"/);
  assert.match(robots, /"\/commercial\/"/);
  assert.match(robots, /"\/platform\/"/);
});
