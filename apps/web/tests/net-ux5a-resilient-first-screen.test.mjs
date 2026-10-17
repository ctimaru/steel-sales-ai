import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const pro = read("../app/(workspace)/network/page.tsx");
const free = read("../components/free-network-directory.tsx");
const routeError = read("../app/(workspace)/network/error.tsx");
const firstScreen = read("../components/network-resilient-first-screen.tsx");
const overview = read("../components/network-discovery-overview.tsx");

test("NET-UX5A: Pro data sources fail independently, never take down the directory", () => {
 assert.match(pro,/await Promise\.allSettled\(\[/);
 for(const name of ["canonicalUnavailable","previewDirectory","savedResult","followedResult","geoResult"])assert.ok(pro.includes(name));
 assert.match(pro,/resultsResult\.status === "rejected"/);
 assert.match(pro,/canonicalUnavailable \? \(/);
 assert.match(pro,/<NetworkAvailabilityNotice/);
 assert.match(pro,/savedResult\.status === "fulfilled" && followedResult\.status === "fulfilled"/);
 assert.match(pro,/getNetworkAccessState\(context\.organizationId\)/);
 assert.ok(pro.indexOf("getNetworkAccessState(context.organizationId)") < pro.indexOf("Promise.allSettled"));
});

test("NET-UX5A: entry screen puts search and live Italy navigation in sight", () => {
 assert.ok(pro.indexOf('id="network-company-search"')<pro.indexOf("<NetworkDiscoveryOverview"));
 assert.match(pro,/<NetworkMiniMap coverage=\{coverage\} filters=\{params\}/);
 assert.match(free,/<NetworkMiniMap coverage=\{coverage\} filters=\{filters\}/);
 for(const term of ["Cerco fornitori","Cerco clienti","Cerco terzisti","Cerco produttori"])assert.ok(overview.includes(term));
 assert.match(firstScreen,/ITALY_REGION_PATHS\.map/);
 assert.match(firstScreen,/italyRegionFilterHref/);
 assert.match(firstScreen,/aria-label=/);
 assert.doesNotMatch(firstScreen,/service_role|supabase\.rpc\(/);
});

test("NET-UX5A: Free DB outage is never shown as an incorrect registration claim", () => {
 assert.match(free,/getFreeNetworkPagedDirectory/);
 assert.match(free,/catch \{[\s\S]*?return <NetworkRecoveryScreen/);
 assert.doesNotMatch(free,/Attiva la tua azienda per esplorare il Network/);
 assert.match(firstScreen,/Nessun dato è stato inventato/);
});

test("NET-UX5A: catastrophic route errors render safe recovery, not a dead generic screen", () => {
 assert.match(routeError,/"use client"/);
 assert.match(routeError,/<NetworkRecoveryScreen retry=\{reset\}/);
 assert.match(firstScreen,/Riprova caricamento/);
 assert.match(firstScreen,/name="q"/);
 assert.match(firstScreen,/<NetworkIntentShortcuts filters=\{\{\}\}/);
 assert.match(firstScreen,/<NetworkMiniMap filters=\{\{\}\}/);
 assert.doesNotMatch(firstScreen,/31 aziende|69 aziende|100 aziende/);
});

test("NET-UX5A: unknown totals must not render false zeros", () => {
 assert.match(overview,/publishedUnavailable \|\| discoveryUnavailable/);
 assert.match(overview,/publishedUnavailable \? "—"/);
 assert.match(overview,/discoveryUnavailable \? "—"/);
 assert.match(pro,/publishedUnavailable=\{canonicalUnavailable\}/);
});
