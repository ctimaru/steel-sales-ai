import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const italian = read("../app/(public)/knowledge/page.tsx");
const english = read("../app/en/knowledge/page.tsx");
const sitemap = read("../app/sitemap.ts");
const workflow = read("../../../.github/workflows/demotest2-4-production-smoke.yml");
const http = read("./i18n4-production-seo-http.mjs");
const chrome = read("./i18n4-production-seo-chrome.mjs");
const runbook = read("../../../docs/quality/i18n4-international-seo-acceptance.md");

test("I18N4 repairs missing Italian Knowledge reciprocal page metadata, not just sitemap", () => {
  assert.match(italian, /canonical: absoluteUrl\("\/knowledge"\)/);
  assert.match(italian, /languages:\s*\{\s*it: absoluteUrl\("\/knowledge"\),\s*en: absoluteUrl\("\/en\/knowledge"\)/);
  assert.match(italian, /PublicLanguageSwitch locale="it"/);
  assert.match(english, /it: absoluteUrl\("\/knowledge"\)/);
  assert.match(sitemap, /en: absoluteUrl\("\/en\/knowledge"\)/);
});

test("I18N4 production acceptance is read-only and manually strict after deployment", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /I18N4_STRICT_PRODUCTION/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /i18n4-production-seo-http\.mjs/);
  assert.match(workflow, /i18n4-production-seo-chrome\.mjs/);
  assert.match(workflow, /retention-days: 3/);
  assert.match(http, /robots\.txt/);
  assert.match(http, /sitemap\.xml/);
  assert.match(http, /noindex/);
  assert.match(http, /reciprocal alternates/);
  assert.match(chrome, /route\.abort\(\)/);
  assert.match(chrome, /"GET" && method !== "HEAD"/);
  assert.match(chrome, /width: 390/);
  assert.match(chrome, /Interactive tube mass calculator/);
  assert.match(chrome, /Add another item/);
  assert.doesNotMatch(http + chrome, /method:\s*["']POST|fetch\([^)]*,\s*\{\s*method:\s*["']POST/i);
});

test("I18N4 runbook does not claim GSC indexing or document-root localization without evidence", () => {
  assert.match(runbook, /No GSC properties accessible/);
  assert.match(runbook, /NOT ESTABLISHED/);
  assert.match(runbook, /html lang="it"/);
  assert.match(runbook, /Request Indexing/);
});
