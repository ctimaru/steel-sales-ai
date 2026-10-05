-- PL1.11 — Save, History & Export acceptance.
begin;

create or replace function pg_temp.pl111_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PL1.11 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.pl111_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(lower(expected_fragment) in lower(sqlerrm))=0 then
      raise exception 'PL1.11 expected error containing "%", got "%"',
        expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'PL1.11 statement unexpectedly succeeded: %',statement;
end;
$$;

select pg_temp.pl111_assert(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='pricing_sessions'
      and c.relrowsecurity
  )
  and exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='pricing_session_lines'
      and c.relrowsecurity
  ),
  'pricing snapshot tables must have RLS enabled'
);

select pg_temp.pl111_assert(
  not has_table_privilege('anon','public.pricing_sessions','SELECT')
  and not has_table_privilege('anon','public.pricing_session_lines','SELECT')
  and not has_function_privilege(
    'anon',
    'public.pl1_create_pricing_session_snapshot(jsonb,jsonb)',
    'EXECUTE'
  ),
  'anonymous callers must have zero saved-pricing access'
);

select pg_temp.pl111_assert(
  has_function_privilege(
    'authenticated',
    'public.pl1_create_pricing_session_snapshot(jsonb,jsonb)',
    'EXECUTE'
  )
  and not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='pl1_create_pricing_session_snapshot'
  ),
  'snapshot creator must be authenticated and SECURITY INVOKER'
);

select pg_temp.pl111_assert(
  not has_table_privilege('authenticated','public.pricing_sessions','UPDATE')
  and not has_table_privilege('authenticated','public.pricing_sessions','DELETE')
  and not has_table_privilege('authenticated','public.pricing_session_lines','UPDATE')
  and not has_table_privilege('authenticated','public.pricing_session_lines','DELETE'),
  'saved pricing snapshots must be immutable to authenticated users'
);

insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000011a1'::uuid,'pl111-a@example.test',now()),
 ('00000000-0000-0000-0000-0000000011a2'::uuid,'pl111-a2@example.test',now()),
 ('00000000-0000-0000-0000-0000000011b1'::uuid,'pl111-b@example.test',now())
on conflict (id) do nothing;

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
 ('00000000-0000-0000-0000-0000000011f1'::uuid,'PL111 Tenant A','pl111-tenant-a',
  '00000000-0000-0000-0000-0000000011a1'::uuid,'completed'),
 ('00000000-0000-0000-0000-0000000011f2'::uuid,'PL111 Tenant B','pl111-tenant-b',
  '00000000-0000-0000-0000-0000000011b1'::uuid,'completed');

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values
 ('00000000-0000-0000-0000-0000000011f1'::uuid,'00000000-0000-0000-0000-0000000011a1'::uuid,'admin','active',true),
 ('00000000-0000-0000-0000-0000000011f1'::uuid,'00000000-0000-0000-0000-0000000011a2'::uuid,'member','active',true),
 ('00000000-0000-0000-0000-0000000011f2'::uuid,'00000000-0000-0000-0000-0000000011b1'::uuid,'admin','active',true);

insert into public.network_companies(
  id,legal_name,country_code,publication_status,claimed_status,verification_status
) values (
  '00000000-0000-0000-0000-0000000011c0'::uuid,
  'PL111 Producer','IT','published','unclaimed','unverified'
);

insert into public.knowledge_sources(
  id,owner_id,access_scope,source_key,source_type,source_class,name,provider
) values (
  '00000000-0000-0000-0000-0000000011c1'::uuid,
  null,'global','pl111-ci-source','price_list','official',
  'PL111 CI source','PL111 Producer'
);

insert into public.knowledge_documents(
  id,source_id,external_id,document_type,title,checksum_algorithm,content_checksum,status
) values (
  '00000000-0000-0000-0000-0000000011c2'::uuid,
  '00000000-0000-0000-0000-0000000011c1'::uuid,
  'pl111-ci-doc','price_list','PL111 CI price list',
  'sha256',repeat('b',64),'ready'
);

insert into public.price_lists(
  id,publisher_company_id,code,name,currency_code,default_price_unit,status
) values (
  '00000000-0000-0000-0000-0000000011d0'::uuid,
  '00000000-0000-0000-0000-0000000011c0'::uuid,
  'PL111-CI','PL111 Producer','EUR','per_m','active'
);

insert into public.price_list_versions(
  id,price_list_id,primary_source_document_id,manufacturer_version_code,
  source_date,status,publication_scope,calculation_contract_version
) values (
  '00000000-0000-0000-0000-0000000011d1'::uuid,
  '00000000-0000-0000-0000-0000000011d0'::uuid,
  '00000000-0000-0000-0000-0000000011c2'::uuid,
  'PL111-V1','2026-10-05','published','public','pl1.1-v1'
);

insert into public.price_list_sections(
  id,price_list_version_id,section_key,raw_heading,shape_code,
  standard_raw,standard_code,weight_standard_key,
  grade_raw,grade_code,finish_raw,finish_code,
  currency_code,price_unit,sort_order
) values (
  '00000000-0000-0000-0000-0000000011e0'::uuid,
  '00000000-0000-0000-0000-0000000011d1'::uuid,
  's355-self','S355 self color rectangular','rectangular',
  'EN10219','EN10219','EN10219',
  'S355J2H','S355J2H','self color','self_color',
  'EUR','per_m',10
);

insert into public.price_list_items(
  id,section_id,item_key,dimension_label_raw,width_mm,height_mm,thickness_mm,
  source_row_index,status
) values (
  '00000000-0000-0000-0000-0000000011e1'::uuid,
  '00000000-0000-0000-0000-0000000011e0'::uuid,
  '100x50x3','100x50x3',100,50,3,1,'active'
);

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000011a1',true);
set local role authenticated;

create temp table pl111_saved(id uuid);

insert into pl111_saved(id)
select public.pl1_create_pricing_session_snapshot(
  jsonb_build_object(
    'price_list_version_id','00000000-0000-0000-0000-0000000011d1',
    'title','PL111 saved quote',
    'pricing_mode','manual',
    'manual_discount_pct','40',
    'target_eur_t','',
    'currency_code','EUR',
    'pricing_formula','discounted_base_plus_fixed_extra',
    'list_name_snapshot','PL111 Producer',
    'list_code_snapshot','PL111-CI',
    'manufacturer_version_snapshot','PL111-V1',
    'manufacturer_revision_snapshot','',
    'source_date_snapshot','2026-10-05',
    'line_count',1,
    'total_meters',120,
    'total_tonnes',1.2,
    'total_value',240,
    'weighted_average_eur_t',200,
    'meters_complete',true,
    'tonnes_complete',true,
    'value_complete',true,
    'weighted_average_status','ready'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'line_position',1,
      'price_list_item_id','00000000-0000-0000-0000-0000000011e1',
      'dimension_label_snapshot','100x50x3',
      'shape_code_snapshot','rectangular',
      'standard_code_snapshot','EN10219',
      'grade_code_snapshot','S355J2H',
      'finish_code_snapshot','self_color',
      'thickness_mm_snapshot',3,
      'note_snapshot','',
      'quantity_mode','meters',
      'quantity',120,
      'bar_length_m','',
      'line_meters',120,
      'weight_kg_m_snapshot',10,
      'weight_reference_id_snapshot','',
      'weight_resolution_mode_snapshot','verified_reference',
      'formula_version_snapshot','pl1.2',
      'line_tonnes',1.2,
      'base_eur_m_snapshot',2.5,
      'fixed_extra_eur_m_snapshot',0.5,
      'applied_discount_pct',40,
      'discount_source','manual',
      'discount_profile_id','',
      'net_eur_m',2,
      'net_eur_t',200,
      'line_total',240,
      'price_per_t_ready_snapshot',true,
      'price_per_t_status_snapshot','ready',
      'source_locator_snapshot',jsonb_build_object('page',1)
    )
  )
);

select pg_temp.pl111_assert(
  (select count(*) from public.pricing_sessions)=1
  and (select count(*) from public.pricing_session_lines)=1,
  'owner must be able to create and read an atomic pricing snapshot'
);

select pg_temp.pl111_assert(
  (
    select weighted_average_eur_t=200
      and total_value=240
      and total_tonnes=1.2
    from public.pricing_sessions
    where id=(select id from pl111_saved)
  ),
  'saved aggregate snapshot must preserve commercial totals'
);

select pg_temp.pl111_assert_raises(
  $$select public.pl1_create_pricing_session_snapshot(
    '{"price_list_version_id":"00000000-0000-0000-0000-0000000011d1","title":"bad","pricing_mode":"manual","manual_discount_pct":"40","target_eur_t":"","currency_code":"EUR","pricing_formula":"discounted_base_plus_fixed_extra","list_name_snapshot":"PL111","list_code_snapshot":"PL111","manufacturer_version_snapshot":"V1","manufacturer_revision_snapshot":"","source_date_snapshot":"2026-10-05","line_count":2,"total_meters":1,"total_tonnes":0,"total_value":1,"weighted_average_eur_t":"","meters_complete":true,"tonnes_complete":false,"value_complete":true,"weighted_average_status":"missing_weight"}'::jsonb,
    '[{"line_position":1}]'::jsonb
  )$$,
  'line_count mismatch'
);

-- Same-tenant colleague still cannot read another user's personal snapshot.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000011a2',true);

select pg_temp.pl111_assert(
  (select count(*) from public.pricing_sessions)=0
  and (select count(*) from public.pricing_session_lines)=0,
  'saved Distinta history must be owner-private even inside the same tenant'
);

-- Cross-tenant user also sees nothing.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000011b1',true);

select pg_temp.pl111_assert(
  (select count(*) from public.pricing_sessions)=0
  and (select count(*) from public.pricing_session_lines)=0,
  'cross-tenant saved pricing data must remain isolated'
);

reset role;
set local role anon;

select pg_temp.pl111_assert(
  not has_function_privilege(
    'anon',
    'public.pl1_create_pricing_session_snapshot(jsonb,jsonb)',
    'EXECUTE'
  ),
  'anon cannot call snapshot creator'
);

reset role;
rollback;
