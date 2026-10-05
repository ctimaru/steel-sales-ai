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

insert into public.platform_user_roles(user_id,role,status,granted_by,reason) values
 ('00000000-0000-0000-0000-0000000017a1'::uuid,'platform_superadmin','active','00000000-0000-0000-0000-0000000017a1'::uuid,'PL1.7 CI fixture'),
 ('00000000-0000-0000-0000-0000000017a2'::uuid,'platform_superadmin','active','00000000-0000-0000-0000-0000000017a2'::uuid,'PL1.7 CI fixture'),
 ('00000000-0000-0000-0000-0000000017a3'::uuid,'platform_superadmin','active','00000000-0000-0000-0000-0000000017a3'::uuid,'PL1.7 CI fixture'),
 ('00000000-0000-0000-0000-0000000017b1'::uuid,'platform_superadmin','active','00000000-0000-0000-0000-0000000017b1'::uuid,'PL1.7 CI fixture');

-- Tenant A admin creates organization defaults.
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017a1',true);
set local role authenticated;

select public.pl1_save_discount_profile(
  '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid,
  'manufacturer',
  40,
  'organization',
  null,null,null,null,
  'Padana default'
);

select public.pl1_save_discount_profile(
  '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid,
  'grade',
  35,
  'organization',
  null,'S355J2H',null,null,
  'S355 company rule'
);

-- Pick two real S355 rows from separate deterministic item order positions.
create temp table pl17_items as
select
  i.id as item_id,
  i.section_id,
  row_number() over(order by s.sort_order,coalesce(i.source_row_index,0),i.id) as rn
from public.price_list_items i
join public.price_list_sections s on s.id=i.section_id
where s.price_list_version_id='31c762b0-2d20-480f-aa87-dd63e33db945'::uuid
  and s.grade_code='S355J2H'
limit 2;

select pg_temp.pl17_assert(
  (select count(*) from pl17_items)=2,
  'Padana fixture must expose at least two S355J2H items'
);

select public.pl1_save_discount_profile(
  '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid,
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
      '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid
    )
    where price_list_item_id=(select item_id from pl17_items where rn=1)
  ),
  'item scope must beat broader organization rules'
);

-- Member creates personal grade override. It beats same-scope organization grade,
-- but must not beat a more-specific organization item exception.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000017a2',true);

select public.pl1_save_discount_profile(
  '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid,
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
      '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid
    )
    where price_list_item_id=(select item_id from pl17_items where rn=1)
  ),
  'specificity must outrank visibility'
);

select pg_temp.pl17_assert(
  (
    select discount_pct=33 and scope_type='grade' and visibility='personal'
    from public.pl1_effective_discounts_for_version(
      '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid
    )
    where price_list_item_id=(select item_id from pl17_items where rn=2)
  ),
  'personal profile must win within equal scope specificity'
);

select pg_temp.pl17_assert_raises(
  $$select public.pl1_save_discount_profile(
      '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid,
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
      '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid
    )
    where visibility='organization'
  )
  and not exists (
    select 1
    from public.pl1_discount_profiles_for_version(
      '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid
    )
    where visibility='personal'
  ),
  'viewer must see organization pricing but never another user personal pricing'
);

select pg_temp.pl17_assert_raises(
  $$select public.pl1_save_discount_profile(
      '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid,
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
      '31c762b0-2d20-480f-aa87-dd63e33db945'::uuid
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
