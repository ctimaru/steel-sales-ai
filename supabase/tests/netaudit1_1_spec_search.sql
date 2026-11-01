-- NET-AUDIT1.1 — Spec search acceptance (disposable CI transaction, rolls back).
-- Uses the P3.7F public-web technical scope already seeded for Morandi Steel
-- (EN 10219 / EN 10210, S355J2H, OD 33.7–610, width/height 30–500, WT 3–20).
begin;

create or replace function pg_temp.na11_ok(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'NET-AUDIT1.1 assertion failed: %',message; end if;
end $$;

create or replace function pg_temp.na11_raises(statement text,expected text,message text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected in sqlerrm)=0 and sqlstate<>expected then
      raise exception 'NET-AUDIT1.1 %: expected "%", got % "%"',message,expected,sqlstate,sqlerrm;
    end if;
    return;
  end;
  raise exception 'NET-AUDIT1.1 %: statement unexpectedly succeeded',message;
end $$;

create or replace function pg_temp.na11_has(r jsonb,company uuid,expected_status text)
returns boolean language sql as $$
  select exists(select 1 from jsonb_array_elements(r->'items') i
    where (i->>'id')::uuid=company and i->'spec_match'->>'status'=expected_status)
$$;

-- Contract: function surface and privileges.
select pg_temp.na11_ok(
  to_regprocedure('public.netaudit1_spec_search(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer)') is not null,
  'spec search RPC installed');
select pg_temp.na11_ok(not has_function_privilege('anon',
  'public.netaudit1_spec_search(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer)','EXECUTE'),
  'anon cannot execute spec search');
select pg_temp.na11_ok(has_function_privilege('authenticated',
  'public.netaudit1_spec_search(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer)','EXECUTE'),
  'authenticated may invoke (guard decides)');
select pg_temp.na11_ok(not has_function_privilege('authenticated','private.netaudit1_scope_usable(uuid,text)','EXECUTE'),
  'scope usability helper not exposed');
select pg_temp.na11_ok(position('pa1_3_require_network_access' in
  pg_get_functiondef('private.netaudit1_spec_search_impl(uuid,text,text,text,numeric,numeric,numeric,text,text,text,integer,integer)'::regprocedure))>0,
  'paid Network guard present');
select pg_temp.na11_ok(not has_table_privilege('authenticated','public.network_company_product_dimension_scopes','SELECT'),
  'scope tables stay closed to browsers');

-- Fixture identity: temporary platform root (same pattern as PA1.3).
update public.platform_user_roles
set status='revoked',revoked_at=now(),reason='NET-AUDIT1.1 acceptance temporary root replacement'
where role='platform_superadmin' and status='active';
insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000110001'::uuid,'netaudit11-root@example.test',now()),
  ('00000000-0000-0000-0000-000000110002'::uuid,'netaudit11-outsider@example.test',now());
insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
values('00000000-0000-0000-0000-000000110001'::uuid,'platform_superadmin','active',null,'NET-AUDIT1.1 acceptance root');

-- Seed precondition: Morandi Steel technical scope is present and published.
select pg_temp.na11_ok(exists(
  select 1 from public.network_company_product_grade_scopes
  where id='37f10000-0000-4000-8000-000000000802'::uuid),
  'P3.7F Morandi EN 10219 S355J2H scope seeded');
select pg_temp.na11_ok(exists(select 1 from public.network_companies
  where id='51100000-0000-5000-8000-000000000005'::uuid and publication_status='published' and archived_at is null),
  'Morandi Steel published');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

-- An authenticated user without paid Network access is refused.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000110002',true);
select pg_temp.na11_raises(
  $s$select public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,'EN 10219')$s$,
  '42501','outsider without paid access refused');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000110001',true);

-- Input validation.
select pg_temp.na11_raises($s$select public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid)$s$,
  '22023','at least one criterion required');
select pg_temp.na11_raises($s$select public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,null,null,'round',null,null,100)$s$,
  '22023','round shape with side rejected');
select pg_temp.na11_raises($s$select public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,null,null,null,0)$s$,
  '22023','non-positive diameter rejected');

do $t$
declare
  morandi constant uuid:='51100000-0000-5000-8000-000000000005';
  r jsonb;
begin
  r:=public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,'EN 10219','S355',null,60.3,4);
  perform pg_temp.na11_ok(r->>'contract'='netaudit1-spec-v1','contract name');
  perform pg_temp.na11_ok(pg_temp.na11_has(r,morandi,'exact'),'EN 10219 S355 Ø60.3×4 → Morandi exact');
  perform pg_temp.na11_ok((r->>'exact_total')::int>=1 and (r->>'total')::int>=(r->>'exact_total')::int,'totals coherent');
  perform pg_temp.na11_ok(exists(select 1 from jsonb_array_elements(r->'items') i,
      jsonb_array_elements(i->'spec_match'->'grades') g
    where (i->>'id')::uuid=morandi and g->>'designation'='S355J2H' and g->>'provenance_kind'='public_web'),
    'evidence carries designation and provenance');

  -- Exact companies are always listed before undeclared ones.
  perform pg_temp.na11_ok(not exists(
    select 1 from jsonb_array_elements(r->'items') with ordinality a(i,o)
    join jsonb_array_elements(r->'items') with ordinality b(j,p) on p>o
    where a.i->'spec_match'->>'status'='undeclared' and b.j->'spec_match'->>'status'='exact'),
    'exact before undeclared');

  -- Declared S355J2H under EN 10219 is a mismatch for S235: excluded, not "undeclared".
  r:=public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,'EN 10219','S235');
  perform pg_temp.na11_ok(not exists(select 1 from jsonb_array_elements(r->'items') i where (i->>'id')::uuid=morandi),
    'declared S355J2H excluded for S235');

  -- Declared OD 33.7–610: just outside is excluded, the edge is included.
  r:=public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,null,null,'round',610);
  perform pg_temp.na11_ok(pg_temp.na11_has(r,morandi,'exact'),'inclusive OD upper edge');
  r:=public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,null,null,'round',610.1);
  perform pg_temp.na11_ok(not exists(select 1 from jsonb_array_elements(r->'items') i where (i->>'id')::uuid=morandi),
    'OD above declared range excluded');

  -- Square hollow section 100 mm side.
  r:=public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,null,'S355J2H','square',null,null,100);
  perform pg_temp.na11_ok(pg_temp.na11_has(r,morandi,'exact'),'square side 100 S355J2H → Morandi exact');

end
$t$;

-- A rejected scope no longer counts (platform-side change, rolled back).
-- Assertions are append-only (M4), so rejection is recorded on the scope row.
reset role;
update public.network_company_product_dimension_scopes set verification_status='rejected'
where company_product_id in (select id from public.network_company_products
    where company_id='51100000-0000-5000-8000-000000000005'::uuid)
  and dimension_type='outer_diameter';
set local role authenticated;
select pg_temp.na11_ok(not pg_temp.na11_has(
  public.netaudit1_spec_search('00000000-0000-0000-0000-000000110010'::uuid,null,null,'round',60.3),
  '51100000-0000-5000-8000-000000000005'::uuid,'exact'),
  'rejected scope no longer counts as exact');

rollback;
