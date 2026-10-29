import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const site = read("../app/site-document.tsx");
const consent = read("../components/google-analytics-consent.tsx");

function extractSimpleFunction(name, nextMarker) {
  const start = consent.indexOf("function " + name + "(");
  const end = consent.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start);
  return consent.slice(start, end).replace("(rawPathname: string)", "(rawPathname)")
    .replace("(pathname: string)", "(pathname)");
}

test("SEO-GROWTH2.A: GA4 is enabled only on Vercel production, not preview or dev", () => {
  assert.match(site, /process\.env\.VERCEL_ENV === "production"/);
  assert.match(site, /const googleAnalyticsId = isProductionDeployment/);
  assert.match(site, /\{googleAnalyticsId \? \(/);
  assert.match(site, /<GoogleAnalyticsConsent measurementId=\{googleAnalyticsId\}/);
  assert.match(site, /"consent", "default"/);
  assert.match(site, /analytics_storage: "denied"/);
});

test("SEO-GROWTH2.A: international GA4 route filter keeps private routes out", () => {
  const source = extractSimpleFunction("isPublicMeasurementPath", "/** Strip visitor");
  const allowed = new Function(source + "; return isPublicMeasurementPath;")();
  for (const path of [
    "/", "/en", "/de", "/knowledge", "/en/knowledge/tubes",
    "/fr/knowledge/grades", "/es/distinta", "/en/login", "/en/investors",
  ]) assert.equal(allowed(path), true, path);
  for (const path of [
    "/school", "/platform", "/dashboard", "/commercial", "/network",
    "/en/network", "/en/platform", "/de/school", "/fr/dashboard",
    "/es/commercial", "/en/rfq-hub", "/en/unknown",
  ]) assert.equal(allowed(path), false, path);
});

test("SEO-GROWTH2.A: page views never send user-provided query, fragment or raw URL", () => {
  const source = extractSimpleFunction("safePublicPageView", "function clearGoogleAnalyticsCookies");
  const mockWindow = { location: {
    origin: "https://www.smartsteelsales.com",
    href: "https://www.smartsteelsales.com/knowledge/tubes?target=50000&thickness=6#rfq",
    search: "?target=50000&thickness=6",
  }};
  const pageView = new Function("window", "document", source + ";return safePublicPageView;")(
    mockWindow, {title: "Steel Tube Calculator"},
  );
  assert.deepEqual(pageView("/knowledge/tubes"), {
    page_path: "/knowledge/tubes",
    page_location: "https://www.smartsteelsales.com/knowledge/tubes",
    page_title: "Steel Tube Calculator",
  });
  assert.doesNotMatch(consent, /page_location: window\.location\.href/);
  assert.doesNotMatch(consent, /page_path: .*\$\{window\.location\.search\}/);
  assert.equal((consent.match(/safePublicPageView\(pathname\)/g) || []).length, 2);
});
