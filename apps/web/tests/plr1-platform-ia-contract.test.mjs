import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const contract = read("../lib/platform-ia-contract.ts");
const doc = read("../../../docs/architecture/plr1-platform-ia-contract.md");
const platformLayout = read("../app/(platform)/platform/layout.tsx");
const admin = read("../lib/platform-admin.ts");
const home = read("../app/(platform)/platform/page.tsx");
const nav = read("../components/platform-navigation.tsx");
const reg = read("../app/(platform)/platform/registrations/page.tsx");
const privateLab = read("../app/(platform)/platform/novita/page.tsx");
const privateList = read("../app/(platform)/platform/novita/listini/[versionId]/page.tsx");
const permissions = read("../lib/platform-access-contract.ts");
const modules = [...contract.matchAll(/key: "([a-zA-Z]+)", href:/g)].map((m) => m[1]);
const routes = [...contract.matchAll(/\{ path: "(\/platform[^"]*)", module: "([a-zA-Z]+)" \}/g)]
  .map((m) => ({ path: m[1], module: m[2] }));
const routeRoot = new URL("../app/(platform)/platform/", import.meta.url);
function discoverPages(directory, segment = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return discoverPages(new URL(entry.name + "/", directory), segment + "/" + entry.name);
    return entry.name === "page.tsx" ? ["/platform" + segment] : [];
  });
}

test("PLR1 inventories every live Platform page route with exactly one domain", () => {
  const disk = discoverPages(routeRoot).sort();
  const modeled = routes.map((x) => x.path).sort();
  assert.deepEqual(modeled, disk, "New Platform pages must be classified before release");
  assert.equal(new Set(modeled).size, modeled.length);
  assert.equal(new Set(modules).size, modules.length);
  assert.equal(modules.length, 17);
  for (const entry of routes) assert.ok(modules.includes(entry.module), entry.path + " has unknown module");
});

test("PLR1 keeps six semantic areas, explicit gated modules and no invented links", () => {
  assert.match(contract, /PLATFORM_IA_VERSION = "PLR1\.v1\.0"/);
  for (const area of ["overview", "companies", "network", "content", "growth", "strategy"]) {
    assert.match(contract, new RegExp('key: "' + area + '", label:'));
  }
  for (const req of ["registrations.read", "discovery.read", "claims.read", "network_trust.read", "knowledge.read_drafts"]) {
    assert.match(contract, new RegExp('kind: "permission", key: "' + req.replace(".", "\\.") + '"'));
    assert.ok(permissions.includes(req));
  }
  assert.match(contract, /staffTenantDataAccess: false/);
  assert.match(contract, /ownerTenantDataAccessByDefault: false/);
  assert.match(contract, /ownerSingleton: true/);
  assert.match(contract, /preserveUrls: true/);
  assert.doesNotMatch(contract, /href: "\/platform\/audit"/);
});

test("PLR1 reserves Private Lab for a guard-audited owner-only cutover", () => {
  assert.match(contract, /key: "privateLab"[\s\S]*?access: \{ kind: "owner_only" \}[\s\S]*?rollout: "ready_for_plr2"/);
  assert.match(nav, /getPlatformIaVisibleModules/);
  assert.match(privateLab, /requirePlatformSuperadmin\(\)/);
  assert.match(privateLab, /listPriceListsForRequest\(true\)/);
  assert.match(privateList, /getPrivateLabPriceListExplorerItems/);
  assert.match(platformLayout, /requirePlatformConsoleContext\(\)/);
  assert.match(doc, /Private Lab/);
});

test("PLR1 prevents capped registration lists from being global dashboard counts", () => {
  assert.match(admin, /p_limit: 200/);
  assert.match(home, /getPlatformCockpitSnapshot\(context\)/);
  assert.doesNotMatch(home, /queue\?\.applications/);
  assert.match(contract, /allowPaginatedRowsAsGlobalCounters: false/);
  assert.match(contract, /summary\.pending_review/);
  assert.match(contract, /summary\.ready_activation/);
  assert.match(contract, /summary\.identity_conflicts/);
  assert.match(contract, /unavailableLabel: "Dato da verificare"/);
});

test("PLR1 preserves every current authorization and reserved tenant-private boundary", () => {
  assert.match(admin, /getPlatformAccessContext/);
  assert.match(admin, /platform\.console\.access/);
  assert.match(admin, /requirePlatformPermission/);
  assert.match(admin, /getPlatformAccessContext = cache/);
  assert.match(permissions, /tenant_access\.break_glass/);
  assert.match(permissions, /ROOT_ONLY_PERMISSIONS/);
  assert.match(doc, /Server guards \+ permission-checked RPC\/RLS/);
  assert.doesNotMatch(contract, /from "\@\/lib\/supabase|supabase\.rpc|cookies\(\)/);
});
