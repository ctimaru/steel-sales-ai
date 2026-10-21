import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const model = read("../lib/commercial-network-prospect.ts");
const action = read("../app/(italian)/(workspace)/commercial/network-prospect-actions.ts");
const commercial = read("../app/(italian)/(workspace)/commercial/page.tsx");
const privacy = read("../../../supabase/migrations/20260925201732_p4_1_saved_companies_foundation.sql");
const networkContext = read("../lib/commercial-network-context.ts");
const UUID = "00000000-0000-4000-8000-000000000123";
const USER = "00000000-0000-4000-8000-000000000456";
const ORG = "00000000-0000-4000-8000-000000000789";

function instantiateModel({ row = null, error = null } = {}) {
  const where = [], query = {
    select: () => query,
    eq: (column, value) => { where.push([column, value]); return query; },
    maybeSingle: async () => ({ data: row, error }),
  };
  const supabase = { from: (table) => {
    assert.equal(table, "network_saved_companies");
    return query;
  } };
  const deps = {
    "server-only": {},
    "@/lib/supabase/server": { createClient: async () => supabase },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(model, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports,
    require: (name) => {
      if (!(name in deps)) throw Error("unexpected import " + name);
      return deps[name];
    },
  });
  return { get: module.exports.getCommercialNetworkProspect, where };
}

test("NEXT1C.4 private relationship exists only for the authenticated user and active org", async () => {
  const { get, where } = instantiateModel({ row: { created_at: "2026-10-21T13:00:00Z" } });
  const result = await get(ORG, USER, UUID);
  assert.equal(result.status, "saved");
  assert.equal(result.savedAt, "2026-10-21T13:00:00Z");
  assert.equal(JSON.stringify(where), JSON.stringify([
    ["organization_id", ORG], ["user_id", USER], ["network_company_id", UUID],
  ]));
  const notSaved = await instantiateModel().get(ORG, USER, UUID);
  assert.equal(notSaved.status, "not_saved");
  const failed = await instantiateModel({ error: { message: "denied" } }).get(ORG, USER, UUID);
  assert.equal(failed.status, "unavailable");
  assert.equal((await instantiateModel().get(ORG, "invalid", UUID)).status, "unavailable");
});

test("NEXT1C.4 DB contract is deduplicated, owner-scoped and published-only", () => {
  assert.match(privacy, /unique \(organization_id,user_id,network_company_id\)/);
  assert.match(privacy, /alter table public\.network_saved_companies enable row level security/);
  assert.match(privacy, /network_saved_companies_insert_own/);
  assert.match(privacy, /user_id=\(select auth\.uid\(\)\)/);
  assert.match(privacy, /nc\.publication_status='published'/);
  assert.match(privacy, /A save is not a follow, connection, inquiry or public signal/);
});

test("NEXT1C.4 explicit POST confirms current role, entitlement and public profile before storing", () => {
  assert.match(action, /formData\.get\("confirm_prospect"\) === "yes"/);
  assert.match(action, /if \(!confirmed\) redirect/);
  assert.match(action, /if \(!canWriteWorkspace\(context\.role\)\) redirect/);
  assert.match(action, /getCommercialNetworkContext\(context\.organizationId, companyId\)/);
  assert.match(action, /getCommercialNetworkProspect\(context\.organizationId, context\.userId, companyId\)/);
  assert.match(action, /existing\.status === "saved"/);
  assert.match(action, /existing\.status === "unavailable"/);
  assert.match(action, /ignoreDuplicates: true/);
  assert.match(action, /onConflict: "organization_id,user_id,network_company_id"/);
  assert.match(action, /recordPilotUsageEvent/);
  assert.match(networkContext, /getNetworkAccessState/);
  assert.match(networkContext, /getNetworkProfile/);
});

test("NEXT1C.4 Commerciale clearly differentiates saved prospect from verified Company 360", () => {
  assert.match(commercial, /data-testid="commercial-private-prospect"/);
  assert.match(commercial, /confirmCommercialNetworkProspect/);
  assert.match(commercial, /name="confirm_prospect" type="checkbox" value="yes" required/);
  assert.match(commercial, /Salva azienda da seguire/);
  assert.match(commercial, /prospect\.status === "saved"/);
  assert.match(commercial, /prospect\.savedAt/);
  assert.match(commercial, /Azienda già presente nella tua lista: nessun duplicato creato/);
  assert.match(commercial, /poss[ií]bile azienda già nello storico commerciale/i);
  assert.match(commercial, /data-testid="commercial-identity-candidates"/);
  assert.match(commercial, /Il nome coincide, ma l.identità non è stata verificata/);
  assert.match(commercial, /appRoutes\.commercial\.company\(candidate\.company_id\)/);
  assert.match(commercial, /data-testid="commercial-prospect-activity"/);
  assert.match(commercial, /inquiry\.recipient_network_company_id === networkContext\?\.id/);
  assert.match(commercial, /getNetworkInquiries\(context\.organizationId, "sent"\)/);
  assert.match(commercial, /non sono automaticamente collegate alla Company 360/);
  assert.match(commercial, /canWrite \? \(/);
  assert.match(commercial, /Solo i ruoli commerciali autorizzati/);
});

test("NEXT1C.4 does not create CRM identities, RFQs, emails or external outreach on save", () => {
  assert.doesNotMatch(action, /from\("companies"\)|from\("buyer_rfq_suppliers"\)|\.rpc\("rfqh|sendEmail|sendNetworkInquiry|service_role/i);
  assert.doesNotMatch(action, /supabaseAdmin|provider\.send|RESEND_API_KEY/);
  assert.match(action, /getWorkspaceContext/);
  assert.match(commercial, /getCommercialNetworkProspect\(context\.organizationId, context\.userId, networkContext\.id\)/);
  assert.match(commercial, /\.slice\(0, 3\)/);
});

test("NEXT1C.4 shortlist remains in Commerciale, loads only on explicit request and entitlement", () => {
  assert.match(commercial, /params\.prospects === "1"/);
  assert.match(commercial, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(commercial, /prospectAccess\?\.can_access_network && prospectAccess\.organization_id === context\.organizationId/);
  assert.match(commercial, /listCommercialNetworkProspects\(context\.organizationId, context\.userId\)/);
  assert.match(commercial, /data-testid="commercial-prospect-list"/);
  assert.match(commercial, /Aziende da seguire →/);
  assert.match(commercial, /Apri in Commerciale →/);
  assert.match(commercial, /Fino alle ultime 12 aziende salvate/);
  assert.match(model, /\.eq\("organization_id", organizationId\)/);
  assert.match(model, /\.eq\("user_id", userId\)/);
  assert.match(model, /\.eq\("network_companies\.publication_status", "published"\)/);
  assert.match(model, /\.limit\(12\)/);
});
