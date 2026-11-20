import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const map=read("../components/network-europe-map.tsx");
const regionCatalog=read("../lib/network-eu-regions.ts");
const extraCatalog=read("../lib/network-europe-extra-regions.ts");
const regional=read("../lib/network-europe-regional.ts");
const sql=read("../../../supabase/migrations/20261120115900_net_map_drill1_extra_europe_regions.sql");
const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
const catalogJSON=extraCatalog.match(/EUROPE_EXTRA_REGIONS:[^\n]*=(\[.*\]);/)?.[1];
assert.ok(catalogJSON,"Missing generated extras catalog");
const catalog=JSON.parse(catalogJSON);

test("NET-MAP-DRILL1: all 5 supported extra-EU countries have linked regional geometries and names",()=>{
  assert.equal(catalog.length,61);
  const counts={CH:7,GB:12,RS:4,TR:12,UA:26};
  for(const [country,count] of Object.entries(counts)){
    const regions=catalog.filter(r=>r.country===country);
    assert.equal(regions.length,count,country+" count");
    const data=JSON.parse(read("../public/network-eu-regions/"+country+".json"));
    assert.equal(data.country,country);
    assert.equal(data.regions.length,count);
    assert.deepEqual(new Set(data.regions.map(x=>x.code)),new Set(regions.map(x=>x.code)));
    for(const region of data.regions){
      assert.equal(region.name,regions.find(x=>x.code===region.code)?.name);
      assert.match(region.path,/^M/);
      assert.match(region.path,/Z$/);
      assert.ok(region.path.length>30);
      assert.ok(region.bounds.every(Number.isFinite));
    }
  }
  assert.match(extraCatalog,/CC BY 4\.0/);
  assert.match(extraCatalog,/EUPL 1\.2/);
  assert.match(regionCatalog,/import \{EUROPE_EXTRA_REGIONS\}/);
  assert.match(regionCatalog,/\[\.\.\.EUROPE_NUTS2024_REGIONS,\.\.\.EUROPE_EXTRA_REGIONS\]/);
});

test("NET-MAP-DRILL1: map drills into country in compact first view, shows polygons and has visual-only back",()=>{
  assert.match(map,/europeMapViewBox\(zoomCountry\)/);
  assert.doesNotMatch(map,/europeMapViewBox\(compact\?null:zoomCountry\)/);
  assert.match(map,/if\(countryInHref && mappedCountries\.some/);
  assert.match(map,/setZoomCountry\(countryInHref\)/);
  assert.match(map,/if\(kind==="region"\)setExpanded\(false\)/);
  assert.match(map,/data-testid="network-map-back-europe"/);
  assert.match(map,/onClick=\{\(\)=>setZoomCountry\(null\)\}/);
  assert.match(map,/data-testid="network-map-compact-regions"/);
  assert.match(map,/if\(!zoomCountry\|\|!europeRegionsForCountry\(zoomCountry\)\.length\)/);
  assert.match(map,/regionShapes=\{loadedRegionCountry===zoomCountry\?regionShapes:\[\]\}/);
  assert.match(map,/regionShapes\.map\(region=>/);
  assert.match(map,/onNavigate\(href,"country"\)/);
  assert.match(map,/onNavigate\(europeMapRegionHref\(filters,zoomCountry,region\.code\),"region"\)/);
  assert.match(map,/startTransition\(\(\)=>router\.replace\(href,\{scroll:false\}\)\)/);
});

test("NET-MAP-DRILL1: Italy offers 20 administrative regions, combining Trento and Bolzano",()=>{
  assert.match(map,/Italy's NUTS file has 21 polygons/);
  assert.match(map,/ITH1:"Trentino-Alto Adige",ITH2:"Trentino-Alto Adige"/);
  assert.match(map,/ITALY_REGIONS\.includes\(name\)/);
  assert.match(map,/path:\(prior\?\.path\|\|""\)\+region\.path/);
  assert.match(map,/ITALY_REGIONS\.map\(name=><a/);
  assert.match(map,/networkMapDisplayRegions\(code,valid\)/);
  assert.match(map,/aria-label=\{"Regioni di "/);
  assert.match(map,/europeMapRegionHref\(filters,"IT",name\)/);
});

test("NET-MAP-DRILL1: country region search follows authenticated Free/Pro access and published location only",()=>{
  assert.match(regional,/EXTRA_REGIONAL_COUNTRIES\.has\(country\)\?"net_europe2_region_coverage"/);
  assert.match(regional,/EXTRA_REGIONAL_COUNTRIES\.has\(filters\.country\|\|""\)\?"net_europe2_region_search"/);
  assert.match(sql,/alter table public\.network_europe2_extra_regions enable row level security/);
  assert.match(sql,/revoke all on public\.network_europe2_extra_regions from public,anon,authenticated/);
  assert.match(sql,/p_access='free' then\s+perform private\.netux11_require_active_company/);
  assert.match(sql,/p_access='pro' then\s+perform private\.pa1_3_require_network_access/);
  assert.match(sql,/f\.publication_status='published'/);
  assert.match(sql,/c\.publication_status='published'/);
  assert.match(sql,/lower\(btrim\(coalesce\(f\.region,''\)\)\)=lower\(btrim\(v_name\)\)/);
  assert.match(sql,/grant execute on function public\.net_europe2_region_search/);
  assert.match(sql,/to authenticated;/);
  assert.doesNotMatch(sql,/grant execute on function public\.net_europe2_region_search[^;]*to anon/);
  assert.match(hp13,/'net_europe2_region_search'/);
  assert.match(hp13,/'net_europe2_region_coverage'/);
});
