-- PL1.7 — Discount Profiles & Private Pricing acceptance.
begin;

create or replace function pg_temp.pl17_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PL1.7 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.pl17_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(lower(expected_fragment) in lower(sqlerrm))=0 then
      raise exception 'PL1.7 expected error containing "%", got "%"',
        expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'PL1.7 statement unexpectedly succeeded: %',statement;
end;
$$;

-- Structural boundary.
select pg_temp.pl17_assert(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='price_discount_profiles'
      and c.relrowsecurity
  ),
  'discount profiles must have RLS enabled'
);

select pg_temp.pl17_assert(
  not has_table_privilege('anon','public.price_discount_profiles','SELECT')
  and not has_table_privilege('anon','public.price_discount_profile_events','SELECT'),
  'anonymous users must have no discount-profile access'
);

select pg_temp.pl17_assert(
  has_function_privilege(
    'authenticated',
    'public.pl1_save_discount_profile(uuid,text,numeric,text,uuid,text,text,uuid,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.pl1_save_discount_profile(uuid,text,numeric,text,uuid,text,text,uuid,text)',
    'EXECUTE'
  ),
  'profile mutations must be authenticated-only'
);

select pg_temp.pl17_assert(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='pl1_effective_discounts_for_version'
  ),
  'effective discount resolver must be SECURITY INVOKER'
);

-- Two-tenant fixtures. Platform role is used only so disposable users can read the
-- current internal Padana review version while PL1.3 keeps it private publicly.
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000017a1'::uuid,'pl17-admin-a@example.test',now()),
 ('00000000-0000-0000-0000-0000000017a2'::uuid,'pl17-member-a@example.test',now()),
 ('00000000-0000-0000-0000-0000000017a3'::uuid,'pl17-viewer-a@example.test',now()),
 ('00000000-0000-0000-0000-0000000017b1'::uuid,'pl17-admin-b@example.test',now())
on conflict (id) do nothing;

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
 ('00000000-0000-0000-0000-0000000017f1'::uuid,'PL17 Tenant A','pl17-tenant-a',
  '00000000-0000-0000-0000-0000000017a1'::uuid,'completed'),
 ('00000000-0000-0000-0000-0000000017f2'::uuid,'PL17 Tenant B','pl17-tenant-b',
  '00000000-0000-0000-0000-0000000017b1'::uuid,'completed');

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values
 ('00000000-0000-0000-0000-0000000017f1'::uuid,'00000000-0000-0000-0000-0000000017a1'::uuid,'admin','active',true),
 ('00000000-0000-0000-0000-0000000017f1'::uuid,'00000000-0000-0000-0000-0000000017a2'::uuid,'member','active',true),
 ('00000000-0000-0000-0000-0000000017f1'::uuid,'00000000-0000-0000-0000-0000000017a3'::uuid,'viewer','active',true),
 ('00000000-0000-0000-0000-0000000017f2'::uuid,'00000000-0000-0000-0000-0000000017b1'::uuid,'admin','active',true);

insert into public.platform_staff(user_id,status) values
 ('00000000-0000-0000-0000-0000000017a1'::uuid,'active'),
 ('00000000-0000-0000-0000-0000000017a2'::uuid,'active'),
 ('00000000-0000-0000-0000-0000000017a3'::uuid,'active'),
 ('00000000-0000-0000-0000-0000000017b1'::uuid,'active');

insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason) values
 ('00000000-0000-0000-0000-0000000017a1'::uuid,'knowledge_editor','active','00000000-0000-0000-0000-0000000017a1'::uuid,'PL1.7 CI fixture'),
 ('00000000-0000-0000-0000-0000000017a2'::uuid,'knowledge_editor','active','00000000-0000-0000-0000-0000000017a2'::uuid,'PL1.7 CI fixture'),
 ('00000000-0000-0000-0000-0000000017a3'::uuid,'knowledge_editor','active','00000000-0000-0000-0000-0000000017a3'::uuid,'PL1.7 CI fixture'),
 ('00000000-0000-0000-0000-0000000017b1'::uuid,'knowledge_editor','active','00000000-0000-0000-0000-0000000017b1'::uuid,'PL1.7 CI fixture');

-- Minimal governed price-list fixture. PL1.5 production data is intentionally not
-- part of migrations, so PL1.7 acceptance owns the catalogue rows it exercises.
insert into public.network_companies(
  id,legal_name,country_code,publication_status,claimed_status,verification_status
) values (
  '00000000-0000-0000-0000-0000000017c0'::uuid,
  'PL17 Test Producer','IT','published','unclaimed','unverified'
);

insert into public.knowledge_sources(
  id,owner_id,access_scope,source_key,source_type,source_class,name,provider
) values (
  '00000000-0000-0000-0000-0000000017c1'::uuid,
  null,'global','pl17-ci-source','price_list','official',
  'PL17 CI price list source','PL17 Test Producer'
);

insert into public.knowledge_documents(
  id,source_id,external_id,document_type,title,checksum_algorithm,content_checksum,status
) values (
  '00000000-0000-0000-0000-0000000017c2'::uuid,
  '00000000-0000-0000-0000-0000000017c1'::uuid,
  'pl17-ci-doc','price_list','PL17 CI price list',
  'sha256',repeat('a',64),'ready'
);

insert into public.price_lists(
  id,publisher_company_id,code,name,currency_code,default_price_unit,status
) values (
  '00000000-0000-0000-0000-0000000017d0'::uuid,
  '00000000-0000-0000-0000-0000000017c0'::uuid,
  'PL17-CI','PL17 Test Producer','EUR','per_m','active'
);

insert into public.price_list_versions(
  id,price_list_id,primary_source_document_id,manufacturer_version_code,
  source_date,status,publication_scope,calculation_contract_version
) values (
  '00000000-0000-0000-0000-0000000017d1'::uuid,
  '00000000-0000-0000-0000-0000000017d0'::uuid,
  '00000000-0000-0000-0000-0000000017c2'::uuid,
  'PL17-CI-V1','2026-10-05','draft','internal','pl1.1-v1'
);

insert into public.price_list_sections(
  id,price_list_version_id,section_key,raw_heading,shape_code,
  standard_raw,standard_code,weight_standard_key,
  grade_raw,grade_code,finish_raw,finish_code,
  currency_code,price_unit,sort_order
) values
 (
  '00000000-0000-0000-0000-0000000017e0'::uuid,
  '00000000-0000-0000-0000-0000000017d1'::uuid,
  's355-self','S355 self color rectangular','rectangular',
  'EN10219','EN10219','EN10219',
  'S355J2H','S355J2H','self color','self_color',
  'EUR','per_m',10
 ),
 (
  '00000000-0000-0000-0000-0000000017e1'::uuid,
  '00000000-0000-0000-0000-0000000017d1'::uuid,
  's235-self','S235 self color rectangular','rectangular',
  'EN10219','EN10219','EN10219',
  'S235JRH','S235JRH','self color','self_color',
  'EUR','per_m',20
 );

insert into public.price_list_items(
  id,section_id,item_key,dimension_label_raw,width_mm,height_mm,thickness_mm,
  source_row_index,status
) values
 (
  '00000000-0000-0000-0000-0000000017e2'::uuid,
  '00000000-0000-0000-0000-0000000017e0'::uuid,
  '100x50x3','100x50x3',100,50,3,1,'active'
 ),
 (
  '00000000-0000-0000-0000-0000000017e3'::uuid,
  '00000000-0000-0000-0000-0000000017e0'::uuid,
  '120x60x4','120x60x4',120,60,4,2,'active'
 ),
 (
  '00000000-0000-0000-0000-0000000017e4'::uuid,
  '00000000-0000-0000-0000-0000000017e1'::uuid,
  '80x40x3','80x40x3',80,40,3,1,'active'
 );

-- Tenant A admin creates organization defaults.
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017a1',true);
set local role authenticated;

select public.pl1_save_discount_profile(
  '00000000-0000-0000-0000-0000000017d1'::uuid,
  'manufacturer',
  40,
  'organization',
  null,null,null,null,
  'Padana default'
);

select public.pl1_save_discount_profile(
  '00000000-0000-0000-0000-0000000017d1'::uuid,
  'grade',
  35,
  'organization',
  null,'S355J2H',null,null,
  'S355 company rule'
);

-- Pick two S355 rows from the deterministic PL1.7 fixture.
create temp table pl17_items as
select
  i.id as item_id,
  i.section_id,
  row_number() over(order by s.sort_order,coalesce(i.source_row_index,0),i.id) as rn
from public.price_list_items i
join public.price_list_sections s on s.id=i.section_id
where s.price_list_version_id='00000000-0000-0000-0000-0000000017d1'::uuid
  and s.grade_code='S355J2H'
limit 2;

select pg_temp.pl17_assert(
  (select count(*) from pl17_items)=2,
  'PL1.7 fixture must expose at least two S355J2H items'
);

select public.pl1_save_discount_profile(
  '00000000-0000-0000-0000-0000000017d1'::uuid,
  'item',
  30,
  'organization',
  null,null,null,
  (select item_id from pl17_items where rn=1),
  'Item exception'
);

select pg_temp.pl17_assert(
  (
    select discount_pct=30 and scope_type='item'
    from public.pl1_effective_discounts_for_version(
      '00000000-0000-0000-0000-0000000017d1'::uuid
    )
    where price_list_item_id=(select item_id from pl17_items where rn=1)
  ),
  'item scope must beat broader organization rules'
);

-- Member creates personal grade override. It beats same-scope organization grade,
-- but must not beat a more-specific organization item exception.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017a2',true);

select public.pl1_save_discount_profile(
  '00000000-0000-0000-0000-0000000017d1'::uuid,
  'grade',
  33,
  'personal',
  null,'S355J2H',null,null,
  'My S355 rule'
);

select pg_temp.pl17_assert(
  (
    select discount_pct=30 and scope_type='item' and visibility='organization'
    from public.pl1_effective_discounts_for_version(
      '00000000-0000-0000-0000-0000000017d1'::uuid
    )
    where price_list_item_id=(select item_id from pl17_items where rn=1)
  ),
  'specificity must outrank visibility'
);

select pg_temp.pl17_assert(
  (
    select discount_pct=33 and scope_type='grade' and visibility='personal'
    from public.pl1_effective_discounts_for_version(
      '00000000-0000-0000-0000-0000000017d1'::uuid
    )
    where price_list_item_id=(select item_id from pl17_items where rn=2)
  ),
  'personal profile must win within equal scope specificity'
);

select pg_temp.pl17_assert_raises(
  $$select public.pl1_save_discount_profile(
      '00000000-0000-0000-0000-0000000017d1'::uuid,
      'manufacturer',41,'organization',
      null,null,null,null,'Forbidden member org edit'
    )$$,
  'organization discount profiles require admin role'
);

-- Viewer can consume organization pricing but cannot save personal pricing.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017a3',true);

select pg_temp.pl17_assert(
  exists (
    select 1
    from public.pl1_discount_profiles_for_version(
      '00000000-0000-0000-0000-0000000017d1'::uuid
    )
    where visibility='organization'
  )
  and not exists (
    select 1
    from public.pl1_discount_profiles_for_version(
      '00000000-0000-0000-0000-0000000017d1'::uuid
    )
    where visibility='personal'
  ),
  'viewer must see organization pricing but never another user personal pricing'
);

select pg_temp.pl17_assert_raises(
  $$select public.pl1_save_discount_profile(
      '00000000-0000-0000-0000-0000000017d1'::uuid,
      'manufacturer',42,'personal',
      null,null,null,null,'Forbidden viewer write'
    )$$,
  'active organization write membership required'
);

-- Tenant B must see none of Tenant A's private pricing.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017b1',true);

select pg_temp.pl17_assert(
  (
    select count(*)
    from public.pl1_discount_profiles_for_version(
      '00000000-0000-0000-0000-0000000017d1'::uuid
    )
  )=0,
  'cross-tenant discount profiles must remain isolated'
);

-- Anonymous boundary remains closed even when a caller knows the RPC names.
reset role;
set local role anon;

select pg_temp.pl17_assert(
  not has_function_privilege(
    'anon',
    'public.pl1_discount_profiles_for_version(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.pl1_effective_discounts_for_version(uuid)',
    'EXECUTE'
  ),
  'anonymous callers must not execute private pricing resolvers'
);

reset role;
rollback;
