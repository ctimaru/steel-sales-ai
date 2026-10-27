import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const resolver = read("../lib/commercial-network-context.ts");
const radar = read("../components/dashboard-discovery-feed.tsx");
const dashboard = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const UUID = "00000000-0000-4000-8000-000000001234";
const ORG = "00000000-0000-4000-8000-000000009999";

function makeResolver({ enabled = true, entitled = true, profile = null, failAccess = false, failProfile = false } = {}) {
  const calls = { access: [], profiles: [] };
  const returnedProfile = profile ?? {
    company: {
      id: UUID, legal_name: "Tubi Affidabili SRL", trading_name: "Tubi Affidabili",
      country_code: "IT", verification_status: "verified", private_contact: "NOT_PUBLIC",
    },
    roles: [{ key: "trader_distributor", name: "Commerciante", is_primary: true }],
    products: [
      { name: "Tubi strutturali" }, { name: "Profili cavi" }, { name: "Tubi saldati" },
    ],
    contacts: [{ email: "not-for-commercial-memory@example.test" }],
  };
  const deps = {
    "server-only": {},
    "@/lib/network": {
      getNetworkProfile: async (id) => {
        calls.profiles.push(id);
        if (failProfile) throw Error("unavailable");
        return returnedProfile;
      },
    },
    "@/lib/network-access": {
      getNetworkAccessState: async (organizationId) => {
        calls.access.push(organizationId);
        if (failAccess) throw Error("network access lookup unavailable");
        return { organization_id: ORG, can_access_network: entitled };
      },
    },
    "@/lib/network-flags": { isNetworkFrontendEnabled: () => enabled },
  };
  const target = { exports: {} };
  const js = ts.transpileModule(resolver, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    exports: target.exports, module: target,
    require: (path) => {
      if (!(path in deps)) throw Error("unexpected dependency " + path);
      return deps[path];
    },
  });
  return { resolve: target.exports.getCommercialNetworkContext, calls };
}

test("NEXT1C.3 ignores malformed, absent and disabled Network id without any data access", async () => {
  const { resolve, calls } = makeResolver({ enabled: false });
  assert.equal(await resolve(ORG, UUID), null);
  assert.equal(await resolve(ORG, "untrusted-string"), null);
  assert.equal(await resolve(ORG, null), null);
  assert.equal(calls.access.length, 0);
  assert.equal(calls.profiles.length, 0);
});

test("NEXT1C.3 enforces current organization entitlement before reading public profile", async () => {
  const denied = makeResolver({ entitled: false });
  assert.equal(await denied.resolve(ORG, UUID), null);
  assert.deepEqual(Array.from(denied.calls.access), [ORG]);
  assert.equal(denied.calls.profiles.length, 0);
  const error = makeResolver({ failAccess: true });
  assert.equal(await error.resolve(ORG, UUID), null);
  assert.equal(error.calls.profiles.length, 0);
});

test("NEXT1C.3 permits only matching published public-profile facts, no contact leak", async () => {
  const allowed = makeResolver();
  const context = await allowed.resolve(ORG, UUID);
  assert.equal(context.id, UUID);
  assert.equal(context.name, "Tubi Affidabili");
  assert.equal(context.role, "Commerciante");
  assert.equal(context.country, "IT");
  assert.equal(context.verifiedIdentity, true);
  assert.deepEqual(Array.from(context.products), ["Tubi strutturali", "Profili cavi"]);
  assert.doesNotMatch(JSON.stringify(context), /NOT_PUBLIC|@example\.test|contacts|private_contact/i);
  assert.deepEqual(Array.from(allowed.calls.profiles), [UUID]);
  assert.equal(await makeResolver({ profile: { company: { id: "different" } } }).resolve(ORG, UUID), null);
  assert.equal(await makeResolver({ failProfile: true }).resolve(ORG, UUID), null);
});

test("NEXT1C.3 Dashboard offers one-click Commerciale handoff and keeps profile link", () => {
  assert.match(dashboard, /canWriteCommercial=\{canWrite\}/);
  assert.match(radar, /\?network=" \+ encodeURIComponent\(company\.id\)/);
  assert.match(radar, /canWriteCommercial \? "&compose=1#commercial-compose" : "#network-commercial-context"/);
  assert.match(radar, /Prepara richiesta →/);
  assert.match(radar, /Consulta in Commerciale →/);
  assert.match(radar, /engagementKind="network_profile"/);
  assert.match(radar, /appRoutes\.network\.company\(company\.id\)/);
});

test("NEXT1C.3 Commerciale displays context only on entitlement + revalidated public company", () => {
  assert.match(commercial, /getCommercialNetworkContext\(context\.organizationId, params\.network\)/);
  assert.match(commercial, /\[commercial, procurement, unified, catalogOptions, networkContext, calculatorReferences\] = await Promise\.all/);
  assert.match(commercial, /networkContext \? \(/);
  assert.match(commercial, /data-testid="commercial-network-context"/);
  assert.match(commercial, /Rimuovi contesto/);
  assert.match(commercial, /Cerca nello storico →/);
  assert.match(commercial, /encodeURIComponent\(networkContext\.name\)/);
  assert.match(commercial, /canWrite \? \(/);
  assert.match(commercial, /Prepara RFQ privata →/);
  assert.match(commercial, /nessuna modifica o invio disponibile/);
  assert.match(commercial, /data-testid="commercial-network-draft-disclaimer"/);
  assert.match(commercial, /non precompila, collega né invia richieste/);
  assert.match(commercial, /Nessun invio ai fornitori avviene automaticamente/);
});

test("NEXT1C.3 is an explicit navigation only, not a mutation or recipient preselection", () => {
  assert.match(resolver, /getNetworkAccessState/);
  assert.match(resolver, /getNetworkProfile/);
  assert.doesNotMatch(resolver + radar, /service_role|supabaseAdmin|createClient\(|\.rpc\(|provider\.send/);
  assert.doesNotMatch(commercial, /setSelectedSupplier\(|attachSupplierFromNetwork\(/);
  assert.match(commercial, /canWrite && params\.compose === "1"/);
  assert.match(resolver, /import "server-only"/);
});
