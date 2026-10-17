import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const mapSource = read("../components/italy-region-map.tsx");
const pathsSource = read("../lib/italy-region-paths.ts");
const coverageSource = read("../lib/network-region-coverage.ts");
const migration = read("../../../supabase/migrations/20261016121000_netux2_region_coverage.sql");
const free = read("../components/free-network-directory.tsx");
const paid = read("../app/(workspace)/network/page.tsx");
const basic = read("../lib/network-free.ts");
const geometryScript = ts.transpileModule(pathsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { ITALY_REGION_PATHS } = await import(
  "data:text/javascript;base64," + Buffer.from(geometryScript).toString("base64")
);

test("NET-UX2 renders exactly 20 distinct genuine regional SVG outlines", () => {
  assert.equal(ITALY_REGION_PATHS.length, 20);
  assert.equal(new Set(ITALY_REGION_PATHS.map(({ code }) => code)).size, 20);
  assert.equal(new Set(ITALY_REGION_PATHS.map(({ name }) => name)).size, 20);
  for (const shape of ITALY_REGION_PATHS) {
    assert.match(shape.path, /^M[0-9]/);
    assert.match(shape.path, /Z$/);
    assert.ok(shape.path.length > 100, "shape must have real regional boundaries: " + shape.name);
  }
  assert.match(pathsSource, /CC BY 4\.0/);
  assert.match(pathsSource, /ISTAT/);
  assert.match(pathsSource, /geojson-italy/);
});

test("NET-UX2 works without client-side JS and supports keyboard and list fallback", () => {
  assert.match(mapSource, /<svg/);
  assert.match(mapSource, /<a key=\{region.code\}/);
  assert.match(mapSource, /aria-label=/);
  assert.match(mapSource, /aria-current=/);
  assert.match(mapSource, /group-focus-visible/);
  assert.match(mapSource, /<nav/);
  assert.match(mapSource, /ITALY_REGION_PATHS\.map/g);
  assert.doesNotMatch(mapSource, /use client|onClick=|window\./);
  assert.match(mapSource, /#network-region-results/);
});

test("NET-UX2 keeps geography filters shareable and clears stale province and city", () => {
  assert.match(mapSource, /new URLSearchParams/);
  assert.match(mapSource, /params\.delete\("province"\)/);
  assert.match(mapSource, /params\.delete\("city"\)/);
  assert.match(mapSource, /active \? null : region\.name/);
  assert.match(mapSource, /Rimuovi filtro/);
  assert.match(mapSource, /canonicalItalianRegion/);
  assert.match(mapSource, /Regione non disponibile|unlocated_companies/);
});

test("NET-UX2 appears on both Free and paid Network discovery", () => {
  assert.match(free, /<ItalyRegionMap coverage=\{coverage\}/);
  assert.match(paid, /<ItalyRegionMap coverage=\{coverage\}/);
  assert.match(free, /id="network-region-results"/);
  assert.match(paid, /id="network-region-results"/);
  assert.match(free, /getFreeNetworkPagedDirectory/);
  assert.match(basic, /netux11_free_directory/);
});

test("NET-UX2 geographic aggregates are scoped and privacy-safe", () => {
  assert.match(migration, /private\.netux11_require_active_company\(p_organization_id\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /c\.publication_status='published'/);
  assert.match(migration, /f\.publication_status='published'/);
  assert.match(migration, /count\(distinct company_id\)/);
  assert.match(migration, /unlocated_companies/);
  assert.match(migration, /revoke all on function public\.netux2_region_coverage\(uuid\) from public, anon/);
  assert.match(migration, /grant execute on function public\.netux2_region_coverage\(uuid\) to authenticated/);
  assert.doesNotMatch(migration, /drop policy|alter policy|disable row level security/i);
  assert.match(coverageSource, /netux2_region_coverage/);
  assert.doesNotMatch(migration, /network_company_discovery_candidates|network_inquiries|commercial_threads|contact_email/);
});
