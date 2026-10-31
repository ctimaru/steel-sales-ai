-- NET-GROWTH2C.2 / 2C.2R — behavioural acceptance of the Platform product
-- evidence queue. Disposable CI transaction only: synthetic identities,
-- synthetic *.example.test companies, everything rolled back.
-- Exercises the real RPC as Platform auditor, tenant user and anon.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.g2_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'NET-GROWTH2C.2 assertion failed: %',message;
  end if;
end;
$$;

-- Expects the RPC call to fail with the given SQLSTATE.
create or replace function pg_temp.g2_assert_sqlstate(statement text,expected text,message text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate<>expected then
      raise exception 'NET-GROWTH2C.2 %: expected SQLSTATE %, got % (%)',message,expected,sqlstate,sqlerrm;
    end if;
    return;
  end;
  raise exception 'NET-GROWTH2C.2 %: statement unexpectedly succeeded',message;
end;
$$;

-- Every page of one lane, concatenated, as the caller (security invoker).
create or replace function pg_temp.g2_all_items(p_lane text)
returns jsonb language plpgsql as $$
declare v_page jsonb; v_items jsonb:='[]'::jsonb; v_offset integer:=0; v_total integer;
begin
  loop
    v_page:=public.netgrowth2c2_product_evidence_page(p_lane,25,v_offset);
    v_total:=(v_page->>'selected_total')::integer;
    if jsonb_array_length(v_page->'items')>25 then
      raise exception 'NET-GROWTH2C.2 page larger than 25';
    end if;
    v_items:=v_items||(v_page->'items');
    v_offset:=v_offset+25;
    exit when v_offset>=v_total or v_offset>10000;
  end loop;
  return v_items;
end;
$$;

-- ---------------------------------------------------------------------------
-- Static privilege contract (least privilege, no browser table access).
-- ---------------------------------------------------------------------------
select pg_temp.g2_assert(
  to_regprocedure('public.netgrowth2c2_product_evidence_page(text,integer,integer)') is not null,
  'RPC missing');
select pg_temp.g2_assert(
  not has_function_privilege('anon','public.netgrowth2c2_product_evidence_page(text,integer,integer)','EXECUTE'),
  'anon must not execute the candidate evidence queue');
select pg_temp.g2_assert(
  not has_function_privilege('service_role','public.netgrowth2c2_product_evidence_page(text,integer,integer)','EXECUTE'),
  'service_role execute is unnecessary and must stay revoked');
select pg_temp.g2_assert(
  has_function_privilege('authenticated','public.netgrowth2c2_product_evidence_page(text,integer,integer)','EXECUTE'),
  'authenticated execute (guarded by discovery.read) missing');
select pg_temp.g2_assert(
  not has_table_privilege('anon','private.network_company_enrichment','SELECT')
  and not has_table_privilege('authenticated','private.network_company_enrichment','SELECT'),
  'Raw candidate evidence directly exposed to browsers');
select pg_temp.g2_assert(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid='public.netgrowth2c2_product_evidence_page(text,integer,integer)'::regprocedure),
  'RPC must be security definer with an empty pinned search_path');

-- ---------------------------------------------------------------------------
-- Synthetic identities.
-- ---------------------------------------------------------------------------
insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000c2a1'::uuid,'auditor@g2c2r.example.test',now()),
  ('00000000-0000-0000-0000-00000000c2b1'::uuid,'tenant@g2c2r.example.test',now())
on conflict (id) do nothing;
insert into public.platform_staff(user_id,status)
values ('00000000-0000-0000-0000-00000000c2a1'::uuid,'active');
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values ('00000000-0000-0000-0000-00000000c2a1'::uuid,'platform_auditor','active',
        '00000000-0000-0000-0000-00000000c2a1'::uuid,'NET-GROWTH2C.2R synthetic discovery.read acceptance');

-- Baseline as the auditor, before synthetic evidence exists (CI may hold rows).
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c2a1',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.netgrowth2c2_product_evidence_page('all',25,0) as baseline \gset g2_
reset role;

-- ---------------------------------------------------------------------------
-- Synthetic catalogue and discovery records.
-- ---------------------------------------------------------------------------
insert into public.network_companies(
  id,legal_name,country_code,website_url,website_domain,
  publication_status,claimed_status,verification_status
) values
  ('00000000-0000-0000-0000-00000000c201'::uuid,'G2C2R Published Tubes','IT',
   'https://g2c2r-pub.example.test','g2c2r-pub.example.test','published','claimed','verified');
insert into public.network_companies(id,legal_name,country_code,website_url,website_domain,publication_status)
values
  ('00000000-0000-0000-0000-00000000c202'::uuid,'G2C2R Draft Tubes','IT',
   'https://g2c2r-draft.example.test','g2c2r-draft.example.test','draft');
insert into public.network_companies(id,legal_name,country_code,website_url,website_domain,publication_status,archived_at)
values
  ('00000000-0000-0000-0000-00000000c203'::uuid,'G2C2R Archived Tubes','IT',
   'https://g2c2r-archived.example.test','g2c2r-archived.example.test','archived',now());

-- 28 research leads; each resolves in private.netfast_discovered_records.
insert into public.network_core_target_leads
  (id,company_name,canonical_domain,evidence_url,evidence_summary,segment,proposed_role,material_signal,status,intake_batch)
select
  ('00000000-0000-0000-0000-0000000c'||lpad(n::text,4,'0'))::uuid,
  'G2C2R Lead '||lpad(n::text,2,'0'),
  'g2c2r-lead-'||lpad(n::text,2,'0')||'.example.test',
  'https://g2c2r-lead-'||lpad(n::text,2,'0')||'.example.test/',
  'Synthetic company fact for local behavioural acceptance only.',
  'industrial_equipment','end_user','explicit_steel_tube_product','needs_review','g2c2r-ci-local'
from generate_series(1,28) n;

select pg_temp.g2_assert(
  (select count(*) from private.netfast_discovered_records
   where id::text like '00000000-0000-0000-0000-0000000c%')=28,
  'synthetic leads must resolve in the discovery view before suppression');

-- ---------------------------------------------------------------------------
-- Synthetic evidence. Eligible: 2 canonical + 27 provisional.
-- Quarantined: archived canonical, orphan discovery, suppressed lead,
-- canonical with a suppressed source host, the same host with a port,
-- 2 source URLs with userinfo, 2 non-canonical hosts = 9.
-- Out of scope (not candidate / not products) must never be counted.
-- ---------------------------------------------------------------------------
insert into private.network_company_enrichment
  (id,canonical_company_id,discovered_record_id,field_key,field_value,evidence_url,
   extractor_version,confidence,review_status,fetched_at)
values
  -- canonical published: 6 entries, one >140 chars, one non-string, one blank.
  ('00000000-0000-0000-0000-0000000e0001',
   '00000000-0000-0000-0000-00000000c201',null,'products',
   jsonb_build_array('Tubi saldati EN 10219',repeat('x',200),12,'  ','Tubi EN 10305','Profili cavi','Quinto non mostrato'),
   'https://g2c2r-pub.example.test/prodotti','g2c2r-test',0.9,'candidate',now()),
  -- canonical draft, text value.
  ('00000000-0000-0000-0000-0000000e0002',
   '00000000-0000-0000-0000-00000000c202',null,'products',
   to_jsonb('Tubi meccanici senza saldatura'::text),
   'https://www.g2c2r-draft.example.test/tubi','g2c2r-test',null,'candidate',now()),
  -- QUARANTINE canonical_inactive.
  ('00000000-0000-0000-0000-0000000e0003',
   '00000000-0000-0000-0000-00000000c203',null,'products',
   jsonb_build_array('Archiviato'),
   'https://g2c2r-archived.example.test/','g2c2r-test',null,'candidate',now()),
  -- QUARANTINE suppressed_domain via source host of a published canonical.
  ('00000000-0000-0000-0000-0000000e0004',
   '00000000-0000-0000-0000-00000000c201',null,'products',
   jsonb_build_array('Fonte soppressa'),
   'https://shop.g2c2r-blocked.example.test/x','g2c2r-test',null,'candidate',now()),
  -- QUARANTINE discovery_unresolved: record id that never existed.
  ('00000000-0000-0000-0000-0000000e0005',
   null,'00000000-0000-0000-0000-0000000dead1','products',
   jsonb_build_array('Orfana'),
   'https://g2c2r-orphan.example.test/','g2c2r-test',null,'candidate',now()),
  -- QUARANTINE unsafe_source_url: userinfo must not hide a suppressed host
  -- (naive parsing would read "reader" as the host) ...
  ('00000000-0000-0000-0000-0000000e0008',
   '00000000-0000-0000-0000-00000000c201',null,'products',
   jsonb_build_array('Credenziali nella fonte'),
   'https://reader:secret@g2c2r-blocked.example.test/products','g2c2r-test',null,'candidate',now()),
  -- ... and credentials are never displayed, even on an allowed host.
  ('00000000-0000-0000-0000-0000000e0009',
   '00000000-0000-0000-0000-00000000c202',null,'products',
   jsonb_build_array('Credenziali nella fonte'),
   'https://user@g2c2r-draft.example.test/p','g2c2r-test',null,'candidate',now()),
  -- QUARANTINE suppressed_domain: explicit port and upper case on a suppressed host.
  ('00000000-0000-0000-0000-0000000e000a',
   '00000000-0000-0000-0000-00000000c201',null,'products',
   jsonb_build_array('Porta esplicita'),
   'https://WWW.G2C2R-BLOCKED.example.test:8443/x','g2c2r-test',null,'candidate',now()),
  -- QUARANTINE unsafe_source_url: non-canonical hosts fail closed.
  ('00000000-0000-0000-0000-0000000e000b',
   '00000000-0000-0000-0000-00000000c201',null,'products',
   jsonb_build_array('Punto finale'),
   'https://g2c2r-blocked.example.test./x','g2c2r-test',null,'candidate',now()),
  ('00000000-0000-0000-0000-0000000e000c',
   '00000000-0000-0000-0000-00000000c202',null,'products',
   jsonb_build_array('Indirizzo IP'),
   'https://192.0.2.10/x','g2c2r-test',null,'candidate',now()),
  -- Out of scope: accepted products and candidate services.
  ('00000000-0000-0000-0000-0000000e0006',
   '00000000-0000-0000-0000-00000000c201',null,'products',
   jsonb_build_array('Già accettata'),
   'https://g2c2r-pub.example.test/accepted','g2c2r-test',null,'accepted',now()),
  ('00000000-0000-0000-0000-0000000e0007',
   '00000000-0000-0000-0000-00000000c201',null,'services',
   jsonb_build_array('Taglio laser'),
   'https://g2c2r-pub.example.test/servizi','g2c2r-test',null,'candidate',now());

-- Provisional: leads 1..28. Lead 27 has an object list, lead 28 is suppressed
-- below, lead 26 cites a different host.
insert into private.network_company_enrichment
  (id,canonical_company_id,discovered_record_id,field_key,field_value,evidence_url,
   extractor_version,confidence,review_status,fetched_at)
select
  ('00000000-0000-0000-0000-0000000f'||lpad(n::text,4,'0'))::uuid,
  null,
  ('00000000-0000-0000-0000-0000000c'||lpad(n::text,4,'0'))::uuid,
  'products',
  case when n=27 then jsonb_build_array(jsonb_build_object('name','Oggetto'))
       -- supplementary-plane characters: cap counts code points, not bytes
       when n=3 then jsonb_build_array(repeat('🔩',150))
       else jsonb_build_array('Tubo tondo '||n) end,
  case when n=26 then 'https://other-host.example.test/lead-26'
       else 'https://g2c2r-lead-'||lpad(n::text,2,'0')||'.example.test/prodotti' end,
  'g2c2r-test',null,'candidate',now()-make_interval(mins=>n)
from generate_series(1,28) n;

insert into public.network_netfast3_suppressed_domains(domain,reason,suppressed_by) values
  ('g2c2r-blocked.example.test','Synthetic opt-out for behavioural acceptance',
   '00000000-0000-0000-0000-00000000c2a1'),
  ('g2c2r-lead-28.example.test','Synthetic opt-out for behavioural acceptance',
   '00000000-0000-0000-0000-00000000c2a1');

select count(*) as rows_before,
       count(*) filter (where review_status='candidate') as candidates_before
from private.network_company_enrichment \gset g2_
select count(*) as companies_before,
       count(*) filter (where publication_status='published') as published_before
from public.network_companies \gset g2_

-- ---------------------------------------------------------------------------
-- Platform auditor: counts, quarantine, pagination, lanes, formats.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c2a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.netgrowth2c2_product_evidence_page('all',25,0) as first \gset g2_

select pg_temp.g2_assert((:'g2_first'::jsonb)->>'contract'='net-growth2c2-product-review-v2','contract v2');
select pg_temp.g2_assert(
  ((:'g2_first'::jsonb)->>'canonical_candidates')::int
   -((:'g2_baseline'::jsonb)->>'canonical_candidates')::int=2,
  'exactly 2 synthetic canonical candidates are eligible');
select pg_temp.g2_assert(
  ((:'g2_first'::jsonb)->>'provisional_candidates')::int
   -((:'g2_baseline'::jsonb)->>'provisional_candidates')::int=27,
  'exactly 27 synthetic provisional candidates are eligible');
select pg_temp.g2_assert(
  ((:'g2_first'::jsonb)->>'total_candidates')::int
   =((:'g2_first'::jsonb)->>'canonical_candidates')::int+((:'g2_first'::jsonb)->>'provisional_candidates')::int,
  'total = canonical + provisional');
select pg_temp.g2_assert(
  ((:'g2_first'::jsonb)->>'quarantined_total')::int
   -((:'g2_baseline'::jsonb)->>'quarantined_total')::int=9,
  'exactly 9 synthetic rows are quarantined');
select pg_temp.g2_assert(
  ((:'g2_first'::jsonb)#>>'{quarantine_by_reason,suppressed_domain}')::int
   -((:'g2_baseline'::jsonb)#>>'{quarantine_by_reason,suppressed_domain}')::int=3
  and ((:'g2_first'::jsonb)#>>'{quarantine_by_reason,discovery_unresolved}')::int
   -((:'g2_baseline'::jsonb)#>>'{quarantine_by_reason,discovery_unresolved}')::int=1
  and ((:'g2_first'::jsonb)#>>'{quarantine_by_reason,canonical_inactive}')::int
   -((:'g2_baseline'::jsonb)#>>'{quarantine_by_reason,canonical_inactive}')::int=1
  and ((:'g2_first'::jsonb)#>>'{quarantine_by_reason,unsafe_source_url}')::int
   -((:'g2_baseline'::jsonb)#>>'{quarantine_by_reason,unsafe_source_url}')::int=4,
  'quarantine reasons: 3 suppressed, 1 unresolved, 1 inactive, 4 unsafe URLs');
select pg_temp.g2_assert(
  (:'g2_first'::jsonb)->>'accepted_by_this_process'='0'
  and (:'g2_first'::jsonb)->>'publication_performed'='false',
  'no acceptance or publication signal');
select pg_temp.g2_assert(jsonb_array_length((:'g2_first'::jsonb)->'items')<=25,'page bounded to 25');

-- Full traversal: every eligible synthetic row exactly once, no quarantined
-- or out-of-scope row anywhere, no duplicates, canonical before provisional.
select pg_temp.g2_all_items('all') as all_items \gset g2_
reset role;
-- Read the captured pages as postgres (no temp-table grant needed for browser roles).
create temporary view g2_all as
select (value->>'id')::uuid as id,value as item,ordinality
from jsonb_array_elements(:'g2_all_items'::jsonb) with ordinality;

select pg_temp.g2_assert((select count(*)=count(distinct id) from g2_all),'no duplicates across pages');
select pg_temp.g2_assert(
  (select count(*) from g2_all where id::text like '00000000-0000-0000-0000-0000000e%'
     or id::text like '00000000-0000-0000-0000-0000000f%')=29,
  'all 29 eligible synthetic rows reachable through pagination');
select pg_temp.g2_assert(
  not exists (select 1 from g2_all where id in (
    '00000000-0000-0000-0000-0000000e0003','00000000-0000-0000-0000-0000000e0004',
    '00000000-0000-0000-0000-0000000e0005','00000000-0000-0000-0000-0000000e0006',
    '00000000-0000-0000-0000-0000000e0007','00000000-0000-0000-0000-0000000e0008',
    '00000000-0000-0000-0000-0000000e0009','00000000-0000-0000-0000-0000000e000a',
    '00000000-0000-0000-0000-0000000e000b','00000000-0000-0000-0000-0000000e000c',
    '00000000-0000-0000-0000-0000000f0028')),
  'quarantined, accepted and non-product evidence never listed');
select pg_temp.g2_assert(
  not exists (select 1 from g2_all where item->>'source_url' like '%g2c2r-blocked%'
     or item->>'source_url' like '%g2c2r-orphan%'
     or item->>'source_url' like '%@%'
     or item->>'source_url' ilike '%g2c2r-blocked%'
     or item->>'source_url' like '%192.0.2.10%'
     or item->>'domain' like '%g2c2r-lead-28%'
     or item->>'domain' like '%g2c2r-archived%'),
  'no suppressed, unresolved or inactive source data leaks');
select pg_temp.g2_assert(
  coalesce((select max(ordinality) from g2_all where item->>'lane'='canonical'),0)
   < (select min(ordinality) from g2_all where item->>'lane'='provisional'),
  'canonical lane ordered before provisional');

-- Item shapes and formats.
select pg_temp.g2_assert(
  (select jsonb_array_length(item->'products')=4
      and item->'products'->>0='Tubi saldati EN 10219'
      and length(item->'products'->>1)=140
      and item->'products'->>2='Tubi EN 10305'
      and item->>'value_format'='mixed_list'
      and (item->>'is_published')::boolean
      and (item->>'source_domain_match')::boolean
      and item->>'domain'='g2c2r-pub.example.test'
   from g2_all where id='00000000-0000-0000-0000-0000000e0001'),
  'published canonical: 4 string entries, 140-char cap, non-strings and blanks skipped');
select pg_temp.g2_assert(
  (select item->>'value_format'='text' and item->'products'=jsonb_build_array('Tubi meccanici senza saldatura')
      and not (item->>'is_published')::boolean and (item->>'source_domain_match')::boolean
   from g2_all where id='00000000-0000-0000-0000-0000000e0002'),
  'draft canonical: text value rendered, not published, www host matches');
select pg_temp.g2_assert(
  (select item->>'value_format'='mixed_list' and item->'products'='[]'::jsonb
   from g2_all where id='00000000-0000-0000-0000-0000000f0027'),
  'object list: format exposed, no raw JSON rendered');
select pg_temp.g2_assert(
  (select item->>'value_format'='string_list' and item->>'lane'='provisional'
      and item->>'name'='G2C2R Lead 01' and item->>'domain'='g2c2r-lead-01.example.test'
      and (item->>'source_domain_match')::boolean
   from g2_all where id='00000000-0000-0000-0000-0000000f0001'),
  'resolved provisional: discovery name and domain');
select pg_temp.g2_assert(
  (select not (item->>'source_domain_match')::boolean
   from g2_all where id='00000000-0000-0000-0000-0000000f0026'),
  'foreign source host is flagged');

select pg_temp.g2_assert(
  (select length(item->'products'->>0)=140 and octet_length(item->'products'->>0)>140
   from g2_all where id='00000000-0000-0000-0000-0000000f0003'),
  '140-character cap counts code points (emoji), matching the UI check');

-- Lanes (back to the auditor).
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c2a1',true);
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.g2_assert(
  (select bool_and(value->>'lane'='canonical') and count(*)=
     ((:'g2_first'::jsonb)->>'canonical_candidates')::int
   from jsonb_array_elements(pg_temp.g2_all_items('canonical'))),
  'canonical lane only canonical and complete');
select pg_temp.g2_assert(
  (select bool_and(value->>'lane'='provisional') and count(*)=
     ((:'g2_first'::jsonb)->>'provisional_candidates')::int
   from jsonb_array_elements(pg_temp.g2_all_items('provisional'))),
  'provisional lane only provisional and complete');

-- Bounds: 25 ok, 26 rejected, offsets, lanes, nulls.
select pg_temp.g2_assert(
  jsonb_array_length(public.netgrowth2c2_product_evidence_page('provisional',25,0)->'items')=25,
  'limit 25 returns a full page (>=27 provisional)');
select pg_temp.g2_assert(
  jsonb_array_length(public.netgrowth2c2_product_evidence_page('all',1,0)->'items')=1,
  'limit 1 accepted');
select pg_temp.g2_assert(
  (select jsonb_array_length(v->'items')=0 and (v->>'selected_total')::int>0
   from (select public.netgrowth2c2_product_evidence_page('all',25,10000) v) s),
  'offset beyond the data returns empty items with totals');
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('all',26,0)$$,'22023','limit 26');
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('all',0,0)$$,'22023','limit 0');
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('all',25,-1)$$,'22023','negative offset');
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('all',25,10001)$$,'22023','offset > 10000');
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('published',25,0)$$,'22023','unknown lane');
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page(null,25,0)$$,'22023','null lane');
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('all',null,0)$$,'22023','null limit');

-- ---------------------------------------------------------------------------
-- Tenant user without Platform permission, and anonymous caller.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c2b1',true);
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('all',25,0)$$,'42501','tenant without discovery.read');
-- Permission is checked before argument validation (no oracle for callers).
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('all',26,0)$$,'42501','tenant invalid args still denied');
reset role;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
select pg_temp.g2_assert_sqlstate($$select public.netgrowth2c2_product_evidence_page('all',25,0)$$,'42501','anon');
reset role;

-- ---------------------------------------------------------------------------
-- Read-only: nothing changed by any call above.
-- ---------------------------------------------------------------------------
select pg_temp.g2_assert(
  (select count(*)=:g2_rows_before and count(*) filter (where review_status='candidate')=:g2_candidates_before
   from private.network_company_enrichment),
  'evidence rows and review statuses unchanged');
select pg_temp.g2_assert(
  (select count(*)=:g2_companies_before and count(*) filter (where publication_status='published')=:g2_published_before
   from public.network_companies),
  'catalogue and publication state unchanged');
select pg_temp.g2_assert(
  (select provolatile='s' from pg_proc
   where oid='public.netgrowth2c2_product_evidence_page(text,integer,integer)'::regprocedure),
  'RPC declared stable (no writes)');

rollback;
