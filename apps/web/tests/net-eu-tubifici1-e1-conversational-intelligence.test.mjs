import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=file("../../supabase/migrations/20261119170000_net_eu_tubifici1_e1_source_search.sql");
const intent=file("lib/eu-producer-intelligence-intent.ts");
const action=file("app/(italian)/(workspace)/network/pro/producers/ai-actions.ts");
const service=file("lib/eu-producer-intelligence-search.ts");
const ui=file("components/eu-producer-intelligence-chat.tsx");
const page=file("components/network-producers-experience.tsx");
const rfq=file("lib/commercial-ai-intake-handoff.ts");

function runtime(source, deps={}){
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function("require","module","exports",compiled)(
    id=>{if(id in deps)return deps[id];throw Error("unresolved "+id);},module,module.exports,
  );
  return module.exports;
}
const countries=runtime(file("lib/network-eu-countries.ts"));
const filters=runtime(file("lib/network-spec-intent.ts"));
const parse=runtime(intent,{
  "@/lib/network-spec-intent":filters,
  "@/lib/network-eu-countries":countries,
});

test("EU1.E1 migration has exactly one balanced SQL function body per RPC",()=>{
  assert.equal((sql.match(/\$fn\$/g)||[]).length,2);
  assert.equal((sql.match(/\$sql\$/g)||[]).length,2);
  assert.equal((sql.match(/create or replace function private\.net_eu_tubifici1_e1_search_impl/g)||[]).length,1);
  assert.equal((sql.match(/create or replace function public\.net_eu_tubifici1_e1_search\(/g)||[]).length,1);
  assert.match(sql,/case when c\.website_url ~ '\^https:\/\/\[\^\[:space:\]<>\]\+\
  const x=parse.parseEuProducerSearchIntent("Chi produce tubi EN 10219 S355J2H?");
  assert.equal(x.standard,"EN 10219");
  assert.equal(x.grade,"S355J2H");
  assert.equal(x.shape,null);
  assert.equal(x.requestedSize,false);
});
test("EU1.E1 keeps dimensional requests for RFQ but does not promote ranges to SKUs",()=>{
  const x=parse.parseEuProducerSearchIntent("Cerco EN 10219 S355 RHS 200×100×6");
  assert.equal(x.standard,"EN 10219");
  assert.equal(x.grade,"S355");
  assert.equal(x.shape,"RHS");
  assert.equal(x.requestedSize,true);
  assert.doesNotMatch(sql,/exact_combination_confirmed',true/);
  assert.match(sql,/'exact_combination_confirmed',false/);
  assert.match(ui,/Dimensioni e spessori richiesti: nessuna capacità specifica/);
});
test("EU1.E1 understands Serbia and AISI grade but cannot infer grade from model",()=>{
  const x=parse.parseEuProducerSearchIntent("Produttori di tubi inox AISI 316 in Serbia");
  assert.equal(x.grade,"AISI 316");
  assert.equal(x.country,"RS");
  const baseline=parse.parseEuProducerSearchIntent("Cerco EN 10219");
  const unexpected=parse.reconcileEuProducerModelIntent("Cerco EN 10219",baseline,{
    standard:"EN 10219",grade:"S355J2H",shape:"RHS",country:"GR",
  });
  assert.equal(unexpected.grade,null);
  assert.equal(unexpected.shape,null);
  assert.equal(unexpected.country,null);
});
test("EU1.E1 does not treat common Italian words as ISO country codes",()=>{
  assert.equal(parse.parseEuProducerSearchIntent("Si producono tubi EN 10219?").country,null);
  assert.equal(parse.parseEuProducerSearchIntent("Se cerco S355J2H?").country,null);
  assert.equal(parse.parseEuProducerSearchIntent("Is it EN 10219?").country,null);
  assert.equal(parse.parseEuProducerSearchIntent("Cerco produttori in SI EN 10219").country,"SI");
  assert.equal(parse.parseEuProducerSearchIntent("Cerco produttori in Serbia EN 10219").country,"RS");
  assert.equal(parse.parseEuProducerSearchIntent("Cerco produttori in Germania EN 10219").country,"DE");
  assert.equal(parse.parseEuProducerSearchIntent("Cerco produttori in Italia EN 10219").country,"IT");
});

test("EU1.E1 follow-ups preserve standard while grade and country are refined",()=>{
  const base=parse.parseEuProducerSearchIntent("Chi produce tubi EN 10219?");
  const grade=parse.refineEuProducerSearchFollowup(
    "e S355J2H?",parse.parseEuProducerSearchIntent("e S355J2H?"),base);
  assert.equal(grade.standard,"EN 10219");
  assert.equal(grade.grade,"S355J2H");
  const country=parse.refineEuProducerSearchFollowup(
    "in Serbia",parse.parseEuProducerSearchIntent("in Serbia"),grade);
  assert.equal(country.standard,"EN 10219");
  assert.equal(country.grade,"S355J2H");
  assert.equal(country.country,"RS");
  const newSearch=parse.refineEuProducerSearchFollowup(
    "Produttori inox AISI 316 in Serbia",
    parse.parseEuProducerSearchIntent("Produttori inox AISI 316 in Serbia"),grade);
  assert.equal(newSearch.standard,null,"independent searches must reset prior standard");
  assert.equal(newSearch.grade,"AISI 316");
  assert.equal(newSearch.country,"RS");
});

test("EU1.E1 country follow-up is no permission grant",()=>{
  assert.equal(parse.parseEuProducerSearchIntent("in Italia EN 10219").country,"IT");
  assert.match(action,/intent\.country==="IT"/);
  assert.match(action,/getNetworkProScopedDirectory\(\{/);
  assert.match(action,/module:"producers"/);
  assert.match(action,/country:"DE"/);
  assert.match(action,/getWorkspaceContext\(\)/);
  assert.match(action,/getNetworkProScopedDirectory\([\s\S]+extractViaAi\(question\)/);
  assert.match(action,/refineEuProducerSearchFollowup\(question,intent,previous\)/);
  assert.doesNotMatch(action,/SUPABASE_SERVICE_ROLE_KEY|service_role/);
});
test("EU1.E1 RPC uses existing actual paid EU entitlement, denies anonymous",()=>{
  for(const term of [
    "private.netpro1b_allowed_for(p_organization_id,'producers','DE')",
    "not coalesce(private.netpro1b_allowed_for(p_organization_id,'producers','DE'),false)",
    "(select auth.uid()) is null",
    "else null end website_url",
    "errcode='42501'","c.publication_status='published'",
    "c.archived_at is null","private.netpro1b_europe_country",
    "tc.evidence_status='first_party_observed'",
    "tc.rights_status='link_only'",
    "s.rights_state='not_restricted'",
    "a.review_state='accepted'",
    "ra.company_id=c.id","ro.canonical_key='producer'",
    "pf.canonical_key='tubes_pipes'",
    "c.website_domain",
    "private.net_eu_tubifici1_d5_operator_sources",
    "tc.source_url ~ '^https://",
    "v_shape not in ('CHS','SHS','RHS')",
    "v_max integer := greatest(1,least(coalesce(p_max,12),12))",
  ])assert.ok(sql.includes(term),term);
  assert.match(sql,/revoke all on function public\.net_eu_tubifici1_e1_search\([^)]+\)[\s\S]*?from public,anon,authenticated,service_role/);
  assert.match(sql,/grant execute on function public\.net_eu_tubifici1_e1_search\([^)]+\)[\s\S]*?to authenticated/);
  assert.doesNotMatch(sql,/grant execute[^;]*to anon|grant execute[^;]*to service_role/i);
});
test("EU1.E1 ranking is evidence-only and strict grade matching",()=>{
  assert.match(sql,/tc\.claim_kind='steel_grade' and v_grade<>''/);
  assert.match(sql,/upper\(btrim\(tc.claim_value\)\)=v_grade/);
  assert.match(sql,/tc\.claim_kind='technical_standard'/);
  assert.match(sql,/right\(upper\(btrim\(tc.claim_value\)\),3\)=v_shape/);
  assert.match(sql,/count\(distinct e\.claim_kind\)/);
  assert.match(sql,/'attributes_observed_separately'/);
  assert.match(sql,/'partial_observations'/);
  assert.match(sql,/'manufacturer_confirmed',false/);
  assert.doesNotMatch(sql,/insert into|update public\.network_companies|delete from/i);
});
test("EU1.E1 frontend renders conversational source cards and reviewed RFQ handoff",()=>{
  assert.match(page,/<EuProducerIntelligenceChat\/>/);
  assert.match(ui,/data-testid="eu-producer-intelligence-chat"/);
  assert.match(ui,/data-testid="eu-producer-source-match"/);
  assert.match(ui,/sourceUrl/);
  assert.match(ui,/newRequestHref\(\{network:company.companyId,fromNetwork:true\}\)/);
  assert.match(ui,/HANDOFF="sss:commercial-ai-intake-handoff"/);
  assert.match(rfq,/"sss:commercial-ai-intake-handoff"/);
  assert.match(ui,/Nessun invio automatico/);
  assert.match(service,/parseEuProducerSearchResponse/);
  assert.match(service,/item\.exact_combination_confirmed!==false/);
  assert.match(service,/item\.manufacturer_confirmed!==false/);
});
 and/);
  assert.ok(sql.length < 7800,"SQL payload unexpectedly duplicated");
});

test("EU1.E1 extracts exact EN 10219 + S355J2H with no fabricated size",()=>{
  const x=parse.parseEuProducerSearchIntent("Chi produce tubi EN 10219 S355J2H?");
  assert.equal(x.standard,"EN 10219");
  assert.equal(x.grade,"S355J2H");
  assert.equal(x.shape,null);
  assert.equal(x.requestedSize,false);
});
test("EU1.E1 keeps dimensional requests for RFQ but does not promote ranges to SKUs",()=>{
  const x=parse.parseEuProducerSearchIntent("Cerco EN 10219 S355 RHS 200×100×6");
  assert.equal(x.standard,"EN 10219");
  assert.equal(x.grade,"S355");
  assert.equal(x.shape,"RHS");
  assert.equal(x.requestedSize,true);
  assert.doesNotMatch(sql,/exact_combination_confirmed',true/);
  assert.match(sql,/'exact_combination_confirmed',false/);
  assert.match(ui,/Dimensioni e spessori richiesti: nessuna capacità specifica/);
});
test("EU1.E1 understands Serbia and AISI grade but cannot infer grade from model",()=>{
  const x=parse.parseEuProducerSearchIntent("Produttori di tubi inox AISI 316 in Serbia");
  assert.equal(x.grade,"AISI 316");
  assert.equal(x.country,"RS");
  const baseline=parse.parseEuProducerSearchIntent("Cerco EN 10219");
  const unexpected=parse.reconcileEuProducerModelIntent("Cerco EN 10219",baseline,{
    standard:"EN 10219",grade:"S355J2H",shape:"RHS",country:"GR",
  });
  assert.equal(unexpected.grade,null);
  assert.equal(unexpected.shape,null);
  assert.equal(unexpected.country,null);
});
test("EU1.E1 does not treat common Italian words as ISO country codes",()=>{
  assert.equal(parse.parseEuProducerSearchIntent("Si producono tubi EN 10219?").country,null);
  assert.equal(parse.parseEuProducerSearchIntent("Se cerco S355J2H?").country,null);
  assert.equal(parse.parseEuProducerSearchIntent("Is it EN 10219?").country,null);
  assert.equal(parse.parseEuProducerSearchIntent("Cerco produttori in SI EN 10219").country,"SI");
  assert.equal(parse.parseEuProducerSearchIntent("Cerco produttori in Serbia EN 10219").country,"RS");
  assert.equal(parse.parseEuProducerSearchIntent("Cerco produttori in Germania EN 10219").country,"DE");
  assert.equal(parse.parseEuProducerSearchIntent("Cerco produttori in Italia EN 10219").country,"IT");
});

test("EU1.E1 follow-ups preserve standard while grade and country are refined",()=>{
  const base=parse.parseEuProducerSearchIntent("Chi produce tubi EN 10219?");
  const grade=parse.refineEuProducerSearchFollowup(
    "e S355J2H?",parse.parseEuProducerSearchIntent("e S355J2H?"),base);
  assert.equal(grade.standard,"EN 10219");
  assert.equal(grade.grade,"S355J2H");
  const country=parse.refineEuProducerSearchFollowup(
    "in Serbia",parse.parseEuProducerSearchIntent("in Serbia"),grade);
  assert.equal(country.standard,"EN 10219");
  assert.equal(country.grade,"S355J2H");
  assert.equal(country.country,"RS");
  const newSearch=parse.refineEuProducerSearchFollowup(
    "Produttori inox AISI 316 in Serbia",
    parse.parseEuProducerSearchIntent("Produttori inox AISI 316 in Serbia"),grade);
  assert.equal(newSearch.standard,null,"independent searches must reset prior standard");
  assert.equal(newSearch.grade,"AISI 316");
  assert.equal(newSearch.country,"RS");
});

test("EU1.E1 country follow-up is no permission grant",()=>{
  assert.equal(parse.parseEuProducerSearchIntent("in Italia EN 10219").country,"IT");
  assert.match(action,/intent\.country==="IT"/);
  assert.match(action,/getNetworkProScopedDirectory\(\{/);
  assert.match(action,/module:"producers"/);
  assert.match(action,/country:"DE"/);
  assert.match(action,/getWorkspaceContext\(\)/);
  assert.match(action,/getNetworkProScopedDirectory\([\s\S]+extractViaAi\(question\)/);
  assert.match(action,/refineEuProducerSearchFollowup\(question,intent,previous\)/);
  assert.doesNotMatch(action,/SUPABASE_SERVICE_ROLE_KEY|service_role/);
});
test("EU1.E1 RPC uses existing actual paid EU entitlement, denies anonymous",()=>{
  for(const term of [
    "private.netpro1b_allowed_for(p_organization_id,'producers','DE')",
    "not coalesce(private.netpro1b_allowed_for(p_organization_id,'producers','DE'),false)",
    "(select auth.uid()) is null",
    "else null end website_url",
    "errcode='42501'","c.publication_status='published'",
    "c.archived_at is null","private.netpro1b_europe_country",
    "tc.evidence_status='first_party_observed'",
    "tc.rights_status='link_only'",
    "s.rights_state='not_restricted'",
    "a.review_state='accepted'",
    "ra.company_id=c.id","ro.canonical_key='producer'",
    "pf.canonical_key='tubes_pipes'",
    "c.website_domain",
    "private.net_eu_tubifici1_d5_operator_sources",
    "tc.source_url ~ '^https://",
    "v_shape not in ('CHS','SHS','RHS')",
    "v_max integer := greatest(1,least(coalesce(p_max,12),12))",
  ])assert.ok(sql.includes(term),term);
  assert.match(sql,/revoke all on function public\.net_eu_tubifici1_e1_search\([^)]+\)[\s\S]*?from public,anon,authenticated,service_role/);
  assert.match(sql,/grant execute on function public\.net_eu_tubifici1_e1_search\([^)]+\)[\s\S]*?to authenticated/);
  assert.doesNotMatch(sql,/grant execute[^;]*to anon|grant execute[^;]*to service_role/i);
});
test("EU1.E1 ranking is evidence-only and strict grade matching",()=>{
  assert.match(sql,/tc\.claim_kind='steel_grade' and v_grade<>''/);
  assert.match(sql,/upper\(btrim\(tc.claim_value\)\)=v_grade/);
  assert.match(sql,/tc\.claim_kind='technical_standard'/);
  assert.match(sql,/right\(upper\(btrim\(tc.claim_value\)\),3\)=v_shape/);
  assert.match(sql,/count\(distinct e\.claim_kind\)/);
  assert.match(sql,/'attributes_observed_separately'/);
  assert.match(sql,/'partial_observations'/);
  assert.match(sql,/'manufacturer_confirmed',false/);
  assert.doesNotMatch(sql,/insert into|update public\.network_companies|delete from/i);
});
test("EU1.E1 frontend renders conversational source cards and reviewed RFQ handoff",()=>{
  assert.match(page,/<EuProducerIntelligenceChat\/>/);
  assert.match(ui,/data-testid="eu-producer-intelligence-chat"/);
  assert.match(ui,/data-testid="eu-producer-source-match"/);
  assert.match(ui,/sourceUrl/);
  assert.match(ui,/newRequestHref\(\{network:company.companyId,fromNetwork:true\}\)/);
  assert.match(ui,/HANDOFF="sss:commercial-ai-intake-handoff"/);
  assert.match(rfq,/"sss:commercial-ai-intake-handoff"/);
  assert.match(ui,/Nessun invio automatico/);
  assert.match(service,/parseEuProducerSearchResponse/);
  assert.match(service,/item\.exact_combination_confirmed!==false/);
  assert.match(service,/item\.manufacturer_confirmed!==false/);
});
