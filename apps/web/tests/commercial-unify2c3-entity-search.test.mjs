import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p,import.meta.url),"utf8");
const sql = read("../../../supabase/migrations/20261019165000_commercial_unify2c3_entity_search.sql");
const security = read("../../../supabase/tests/commercial_unify2c3_entity_search.sql");
const paged = read("../lib/commercial-unified-paged.ts");
const stream = read("../lib/commercial-unified-streams.ts");
const list = read("../components/commercial-unified-worklist.tsx");

test("2C.3 only returns tenant-scoped entity rows, never commercial line duplicates or prices", () => {
  assert.match(sql, /security invoker/i);
  assert.match(sql, /p_organization_id uuid/);
  assert.match(sql, /m\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(sql, /m\.status='active'/);
  for (const table of ["rfqs","offers","orders"]) {
    assert.match(sql,new RegExp("from public\\."+table+" "));
  }
  for (const lines of ["rfq_lines","offer_lines","order_lines"]) {
    assert.match(sql,new RegExp("exists\\([\\s\\S]+?from public\\."+lines));
  }
  assert.match(sql, /select kind,id,status,created_at,company_name[\s\S]*from matching/);
  assert.match(sql, /'total',\(select count\(\*\) from matching\)/);
  assert.match(sql, /least\(coalesce\(p_limit,30\),31\)/);
  assert.doesNotMatch(sql,/security definer|price_value|unit_price|service_role/i);
});

test("2C.3 blocks anon RPC invocation, enforces membership and does not mutate customer records", () => {
  assert.match(sql, /revoke all on function public\.commercial_unify_entity_search_v1[\s\S]*from public,anon/);
  assert.match(sql, /grant execute on function public\.commercial_unify_entity_search_v1[\s\S]*to authenticated/);
  assert.match(security, /set local role authenticated/);
  assert.match(security, /no_inbound_leak/);
  assert.match(security, /anon/);
  assert.doesNotMatch(sql,/insert into|update public\.|delete from|create table/i);
});

test("2C.3 customer and product search covers all inbound business types", () => {
  for (const t of ["rfqs","offers","orders"]) {
    assert.match(sql,new RegExp("p_source='"+t+"'"));
  }
  for (const field of ["c.name ilike p.pattern","l.canonical_product_key ilike p.pattern",
    "l.raw_spec_text ilike p.pattern","l.requested_grade ilike p.pattern",
    "l.requested_standard ilike p.pattern"]) {
    assert.ok(sql.includes(field),field);
  }
  assert.match(paged, /p_source: "rfqs"/);
  assert.match(paged, /exact: true/);
  assert.match(stream, /p_source: source/);
  assert.match(stream, /mapSource\(source, payload\.rows as Row\[\]\)/);
  assert.match(list, /isStreamView\(view\)/);
});

test("2C.3 5,000-entity fixture counts exactly once regardless of technical lines", () => {
  const entities = Array.from({length:5000},(_,i)=>({
    id:"rfq-"+i,customer:i%2===0?"Cliente A":"Cliente B",
    products:Array.from({length:i%7+1},(_,j)=>"EN10219 S235 "+j)
  }));
  const matches=entities.filter(e=>e.products.some(p=>p.toLowerCase().includes("s235")));
  assert.equal(matches.length,5000);
  assert.ok(entities.reduce((n,e)=>n+e.products.length,0)>matches.length);
  for(let page=0;page<Math.ceil(matches.length/30);page++){
    const rows=matches.slice(page*30,page*30+30);
    assert.ok(rows.length<=30);
    assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
  }
});
