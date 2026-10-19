import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = p => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const lib = read("../lib/school-acquisition.client.ts");
const view = read("../components/school-acquisition-tracker.tsx");
const layout = read("../app/(public)/knowledge/layout.tsx");
const calc = read("../lib/calculator-conversion-funnel.client.ts");
const utility = read("../components/public-utility-telemetry.tsx");
const events = read("../lib/product-analytics-events.client.ts");
const platform = read("../lib/platform-product-analytics.ts");
const dashboard = read("../components/product-analytics-dashboard.tsx");
test("SCHOOL-GROWTH1D: current explicit consent guards Scuola and Supabase utility events", () => {
 assert.match(lib, /ANALYTICS_CONSENT_STORAGE_KEY/);
 assert.match(lib, /record\?\.decision === "granted" && analyticsConsentRecordIsCurrent\(record\)/);
 assert.match(lib, /if \(!STAGES.has\(stage\) \|\| !hasCurrentAnalyticsConsent\(\)\) return false;/);
 assert.match(utility, /if \(!hasCurrentAnalyticsConsent\(\)\) return;/);
 assert.match(calc, /consent\?\.decision !== "granted"/);
 assert.doesNotMatch(lib+view, /localStorage.setItem|sessionStorage|sendBeacon|fetch\(|randomUUID|userId|rfqId|companyId/);
});
test("SCHOOL-GROWTH1D: passive delegated navigation without SEO link changes", () => {
 assert.match(layout, /<SchoolAcquisitionTracker \/>/);
 assert.match(view, /usePathname\(\)/);
 assert.match(view, /viewed.current !== pathname/);
 assert.match(view, /document.addEventListener\("click", onClick\)/);
 assert.match(view, /event.defaultPrevented \|\| event.button !== 0/);
 assert.match(view, /url.origin !== window.location.origin/);
 assert.match(view, /isSchoolCalculatorSource\(url.pathname, url.search\)/);
 assert.match(view, /url.pathname === "\/distinta"/);
 assert.match(lib, /new URLSearchParams\(search\).get\("source"\) === "school"/);
 assert.match(lib, /pathname === "\/knowledge\/articoli"/);
});
test("SCHOOL-GROWTH1D: real calculator steps are attributed only on a source-school URL", () => {
 assert.match(calc, /trackSchoolCalculatorStage\(stage\)/);
 assert.match(utility, /source === "school"/);
 assert.match(events, /school_funnel_rfq_created/);
 assert.match(events, /school_funnel_content_view/);
 assert.doesNotMatch(lib+view, /referrer|utm_|document.title|targetEurT/);
});
test("SCHOOL-GROWTH1D: cockpit counts are aggregate events, not fake conversions", () => {
 assert.match(platform, /const SCHOOL_FUNNEL = \[/);
 assert.match(platform, /schoolFunnel: buildFunnel\(SCHOOL_FUNNEL, new Map\(\)\)/);
 assert.match(platform, /schoolFunnel: buildFunnel\(SCHOOL_FUNNEL, eventMap\)/);
 assert.match(dashboard, /snapshot.schoolFunnel.map/);
 assert.match(dashboard, /non visitatori unici né una coorte/);
 assert.match(dashboard, /non equivale all&apos;invio ai fornitori/);
 assert.match(dashboard, /Raccolta non verificabile/);
});
