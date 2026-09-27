-- P3.7E — Product Scope & Marketplace Readiness
-- Bridges Network company-product declarations to canonical Steel Knowledge.

alter table public.network_data_assertions
  drop constraint if exists network_data_assertions_entity_type_check;
alter table public.network_data_assertions
  add constraint network_data_assertions_entity_type_check
  check (entity_type in (
    'company',
    'facility',
    'contact',
    'company_role_assignment',
    'company_subtype_assignment',
    'company_product',
    'company_product_scope',
    'company_market',
    'facility_capability',
    'company_certification'
  ));

alter table public.network_profile_management_events
  drop constraint if exists network_profile_management_events_entity_type_check;
alter table public.network_profile_management_events
  add constraint network_profile_management_events_entity_type_check
  check (entity_type in (
    'company',
    'company_role_assignment',
    'company_subtype_assignment',
    'company_product',
    'company_product_scope',
    'company_market',
    'facility',
    'facility_capability',
    'company_certification',
    'contact'
  ));

alter table public.network_profile_management_events
  drop constraint if exists network_profile_management_events_operation_check;
alter table public.network_profile_management_events
  add constraint network_profile_management_events_operation_check
  check (operation in (
    'update_overview',
    'add_relation',
    'remove_relation',
    'add_facility',
    'update_facility',
    'archive_facility',
    'add_capability',
    'remove_capability',
    'add_certification',
    'update_certification',
    'remove_certification',
    'add_contact',
    'update_contact',
    'archive_contact',
    'add_product_scope',
    'update_product_scope',
    'remove_product_scope'
  ));

create table if not exists public.network_company_product_standards(
  id uuid primary key default gen_random_uuid(),
  company_product_id uuid not null
    references public.network_company_products(id) on delete restrict,
  standard_id uuid not null
    references public.steel_standards(id) on delete restrict,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  source_assertion_id uuid not null
    references public.network_data_assertions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_product_id,standard_id)
);

create table if not exists public.network_company_product_grades(
  id uuid primary key default gen_random_uuid(),
  company_product_standard_id uuid not null
    references public.network_company_product_standards(id) on delete restrict,
  standard_grade_id uuid not null
    references public.steel_standard_grades(id) on delete restrict,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  source_assertion_id uuid not null
    references public.network_data_assertions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_product_standard_id,standard_grade_id)
);

create table if not exists public.network_company_product_dimension_scopes(
  id uuid primary key default gen_random_uuid(),
  company_product_id uuid not null
    references public.network_company_products(id) on delete restrict,
  steel_product_family text not null
    check (steel_product_family in ('round_tube','square_tube','rectangular_tube')),
  outer_diameter_min_mm numeric,
  outer_diameter_max_mm numeric,
  width_min_mm numeric,
  width_max_mm numeric,
  height_min_mm numeric,
  height_max_mm numeric,
  thickness_min_mm numeric,
  thickness_max_mm numeric,
  length_min_mm numeric,
  length_max_mm numeric,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  source_assertion_id uuid not null
    references public.network_data_assertions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_product_id,steel_product_family),
  check (
    outer_diameter_min_mm is not null or outer_diameter_max_mm is not null
    or width_min_mm is not null or width_max_mm is not null
    or height_min_mm is not null or height_max_mm is not null
    or thickness_min_mm is not null or thickness_max_mm is not null
    or length_min_mm is not null or length_max_mm is not null
  ),
  check (
    coalesce(outer_diameter_min_mm > 0,true)
    and coalesce(outer_diameter_max_mm > 0,true)
    and coalesce(width_min_mm > 0,true)
    and coalesce(width_max_mm > 0,true)
    and coalesce(height_min_mm > 0,true)
    and coalesce(height_max_mm > 0,true)
    and coalesce(thickness_min_mm > 0,true)
    and coalesce(thickness_max_mm > 0,true)
    and coalesce(length_min_mm > 0,true)
    and coalesce(length_max_mm > 0,true)
  ),
  check (
    outer_diameter_min_mm is null or outer_diameter_max_mm is null
    or outer_diameter_min_mm <= outer_diameter_max_mm
  ),
  check (
    width_min_mm is null or width_max_mm is null
    or width_min_mm <= width_max_mm
  ),
  check (
    height_min_mm is null or height_max_mm is null
    or height_min_mm <= height_max_mm
  ),
  check (
    thickness_min_mm is null or thickness_max_mm is null
    or thickness_min_mm <= thickness_max_mm
  ),
  check (
    length_min_mm is null or length_max_mm is null
    or length_min_mm <= length_max_mm
  ),
  check (
    (steel_product_family='round_tube'
      and width_min_mm is null and width_max_mm is null
      and height_min_mm is null and height_max_mm is null)
    or
    (steel_product_family in ('square_tube','rectangular_tube')
      and outer_diameter_min_mm is null and outer_diameter_max_mm is null)
  )
);

create index if not exists network_company_product_standards_product_idx
  on public.network_company_product_standards(company_product_id);
create index if not exists network_company_product_standards_standard_idx
  on public.network_company_product_standards(standard_id);
create index if not exists network_company_product_grades_product_standard_idx
  on public.network_company_product_grades(company_product_standard_id);
create index if not exists network_company_product_grades_standard_grade_idx
  on public.network_company_product_grades(standard_grade_id);
create index if not exists network_company_product_dimensions_product_idx
  on public.network_company_product_dimension_scopes(company_product_id);
create index if not exists network_company_product_dimensions_match_idx
  on public.network_company_product_dimension_scopes(
    steel_product_family,
    outer_diameter_min_mm,
    outer_diameter_max_mm,
    thickness_min_mm,
    thickness_max_mm
  );

alter table public.network_company_product_standards enable row level security;
alter table public.network_company_product_grades enable row level security;
alter table public.network_company_product_dimension_scopes enable row level security;

revoke all on table public.network_company_product_standards from anon,authenticated;
revoke all on table public.network_company_product_grades from anon,authenticated;
revoke all on table public.network_company_product_dimension_scopes from anon,authenticated;
grant select,insert,update,delete on table public.network_company_product_standards to service_role;
grant select,insert,update,delete on table public.network_company_product_grades to service_role;
grant select,insert,update,delete on table public.network_company_product_dimension_scopes to service_role;

create or replace function private.p3_7e_supported_steel_families(
  p_network_company_id uuid,
  p_company_product_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_product_key text;
begin
  perform private.p3_7b_require_manage_access(p_network_company_id);

  select pf.canonical_key into v_product_key
  from public.network_company_products cp
  join public.network_product_families pf on pf.id=cp.product_family_id
  where cp.id=p_company_product_id
    and cp.company_id=p_network_company_id;

  if v_product_key is null then
    raise exception 'company product relation not found' using errcode='P0002';
  end if;

  if v_product_key='tubes_pipes' then
    return array['round_tube']::text[];
  elsif v_product_key='hollow_sections' then
    return array['round_tube','square_tube','rectangular_tube']::text[];
  end if;

  return array[]::text[];
end;
$function$;

revoke all on function private.p3_7e_supported_steel_families(uuid,uuid)
from public,anon,authenticated;

create or replace function private.p3_7e_create_assertion(
  p_network_company_id uuid,
  p_entity_id uuid,
  p_field_path text,
  p_asserted_value jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_id uuid;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,
    asserted_by,confidence,review_state
  )
  values(
    'company_product_scope',p_entity_id,btrim(p_field_path),
    coalesce(p_asserted_value,'{}'::jsonb),
    'company_declared','managed_profile:p3.7e','company_managed',
    v_user,1.0000,'accepted'
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function private.p3_7e_create_assertion(uuid,uuid,text,jsonb)
from public,anon,authenticated;

create or replace function private.p3_7e_assert_scope_mutable(
  p_source_assertion_id uuid,
  p_verification_status text
)
returns void
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_ownership text;
begin
  if p_verification_status='verified' then
    raise exception 'verified product scope requires Platform review'
      using errcode='42501';
  end if;

  select ownership_type into v_ownership
  from public.network_data_assertions
  where id=p_source_assertion_id;

  if v_ownership='platform_verified' then
    raise exception 'platform-verified product scope requires Platform review'
      using errcode='42501';
  end if;
end;
$function$;

revoke all on function private.p3_7e_assert_scope_mutable(uuid,text)
from public,anon,authenticated;

create or replace function private.p3_7e_set_product_standard_impl(
  p_network_company_id uuid,
  p_company_product_id uuid,
  p_standard_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_supported text[];
  v_standard public.steel_standards%rowtype;
  v_scope public.network_company_product_standards%rowtype;
  v_id uuid;
  v_assertion_id uuid;
begin
  v_supported := private.p3_7e_supported_steel_families(
    p_network_company_id,p_company_product_id
  );

  if cardinality(v_supported)=0 then
    raise exception 'technical Steel Knowledge scope is not enabled for this product family'
      using errcode='22023';
  end if;

  select s.* into v_standard
  from public.steel_standards s
  where s.id=p_standard_id
    and s.status='active'
    and exists(
      select 1
      from public.steel_standard_product_families spf
      where spf.standard_id=s.id
        and spf.product_family=any(v_supported)
    );

  if not found then
    raise exception 'active standard is not applicable to this product family'
      using errcode='23503';
  end if;

  select ps.* into v_scope
  from public.network_company_product_standards ps
  where ps.company_product_id=p_company_product_id
    and ps.standard_id=p_standard_id
  for update;

  if coalesce(p_enabled,false) then
    if found then
      return jsonb_build_object(
        'scope_id',v_scope.id,'enabled',true,'idempotent',true
      );
    end if;

    v_id := gen_random_uuid();
    v_assertion_id := private.p3_7e_create_assertion(
      p_network_company_id,
      v_id,
      'technical_scope.standard',
      jsonb_build_object(
        'company_product_id',p_company_product_id,
        'standard_id',v_standard.id,
        'standard_code',v_standard.code,
        'enabled',true
      )
    );

    insert into public.network_company_product_standards(
      id,company_product_id,standard_id,verification_status,source_assertion_id
    )
    values(v_id,p_company_product_id,p_standard_id,'unverified',v_assertion_id);

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_product_scope','company_product_scope',
      v_id,'technical_scope.standard',null,
      jsonb_build_object(
        'company_product_id',p_company_product_id,
        'standard_id',v_standard.id,
        'standard_code',v_standard.code
      ),
      v_assertion_id
    );

    return jsonb_build_object(
      'scope_id',v_id,'enabled',true,'idempotent',false
    );
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  perform private.p3_7e_assert_scope_mutable(
    v_scope.source_assertion_id,v_scope.verification_status
  );

  if exists(
    select 1
    from public.network_company_product_grades g
    where g.company_product_standard_id=v_scope.id
  ) then
    raise exception 'remove dependent grades before removing this standard'
      using errcode='23503';
  end if;

  v_assertion_id := private.p3_7e_create_assertion(
    p_network_company_id,
    v_scope.id,
    'technical_scope.standard.removed',
    jsonb_build_object(
      'company_product_id',p_company_product_id,
      'standard_id',v_standard.id,
      'standard_code',v_standard.code,
      'enabled',false
    )
  );

  delete from public.network_company_product_standards
  where id=v_scope.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_product_scope','company_product_scope',
    v_scope.id,'technical_scope.standard',
    jsonb_build_object(
      'company_product_id',p_company_product_id,
      'standard_id',v_standard.id,
      'standard_code',v_standard.code
    ),
    jsonb_build_object('enabled',false),
    v_assertion_id
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7e_set_product_standard_impl(uuid,uuid,uuid,boolean)
from public,anon;
grant execute on function private.p3_7e_set_product_standard_impl(uuid,uuid,uuid,boolean)
to authenticated,service_role;

create or replace function public.p3_7e_set_product_standard(
  p_network_company_id uuid,
  p_company_product_id uuid,
  p_standard_id uuid,
  p_enabled boolean default true
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7e_set_product_standard_impl(
    p_network_company_id,p_company_product_id,p_standard_id,p_enabled
  );
$function$;

revoke all on function public.p3_7e_set_product_standard(uuid,uuid,uuid,boolean)
from public,anon;
grant execute on function public.p3_7e_set_product_standard(uuid,uuid,uuid,boolean)
to authenticated,service_role;

create or replace function private.p3_7e_set_product_grade_impl(
  p_network_company_id uuid,
  p_company_product_id uuid,
  p_standard_grade_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_supported text[];
  v_standard_scope public.network_company_product_standards%rowtype;
  v_standard_grade public.steel_standard_grades%rowtype;
  v_material public.steel_material_grades%rowtype;
  v_scope public.network_company_product_grades%rowtype;
  v_id uuid;
  v_assertion_id uuid;
begin
  v_supported := private.p3_7e_supported_steel_families(
    p_network_company_id,p_company_product_id
  );

  select sg.* into v_standard_grade
  from public.steel_standard_grades sg
  join public.steel_standard_grade_applicability a
    on a.standard_id=sg.standard_id
   and a.material_grade_id=sg.material_grade_id
  where sg.id=p_standard_grade_id
    and sg.material_grade_id is not null
    and a.product_family=any(v_supported)
  limit 1;

  if not found then
    raise exception 'canonical standard grade is not applicable to this product family'
      using errcode='23503';
  end if;

  select ps.* into v_standard_scope
  from public.network_company_product_standards ps
  where ps.company_product_id=p_company_product_id
    and ps.standard_id=v_standard_grade.standard_id;

  if not found then
    raise exception 'select the parent standard before adding a grade'
      using errcode='23503';
  end if;

  select mg.* into v_material
  from public.steel_material_grades mg
  where mg.id=v_standard_grade.material_grade_id;

  select g.* into v_scope
  from public.network_company_product_grades g
  where g.company_product_standard_id=v_standard_scope.id
    and g.standard_grade_id=p_standard_grade_id
  for update;

  if coalesce(p_enabled,false) then
    if found then
      return jsonb_build_object(
        'scope_id',v_scope.id,'enabled',true,'idempotent',true
      );
    end if;

    v_id := gen_random_uuid();
    v_assertion_id := private.p3_7e_create_assertion(
      p_network_company_id,
      v_id,
      'technical_scope.grade',
      jsonb_build_object(
        'company_product_id',p_company_product_id,
        'company_product_standard_id',v_standard_scope.id,
        'standard_grade_id',v_standard_grade.id,
        'grade',v_standard_grade.grade,
        'material_grade_id',v_standard_grade.material_grade_id,
        'material_designation',v_material.designation,
        'enabled',true
      )
    );

    insert into public.network_company_product_grades(
      id,company_product_standard_id,standard_grade_id,
      verification_status,source_assertion_id
    )
    values(
      v_id,v_standard_scope.id,p_standard_grade_id,
      'unverified',v_assertion_id
    );

    perform private.p3_7_record_profile_event_impl(
      p_network_company_id,'add_product_scope','company_product_scope',
      v_id,'technical_scope.grade',null,
      jsonb_build_object(
        'company_product_id',p_company_product_id,
        'standard_grade_id',v_standard_grade.id,
        'grade',v_standard_grade.grade,
        'material_designation',v_material.designation
      ),
      v_assertion_id
    );

    return jsonb_build_object(
      'scope_id',v_id,'enabled',true,'idempotent',false
    );
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  perform private.p3_7e_assert_scope_mutable(
    v_scope.source_assertion_id,v_scope.verification_status
  );

  v_assertion_id := private.p3_7e_create_assertion(
    p_network_company_id,
    v_scope.id,
    'technical_scope.grade.removed',
    jsonb_build_object(
      'company_product_id',p_company_product_id,
      'standard_grade_id',v_standard_grade.id,
      'grade',v_standard_grade.grade,
      'material_designation',v_material.designation,
      'enabled',false
    )
  );

  delete from public.network_company_product_grades
  where id=v_scope.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_product_scope','company_product_scope',
    v_scope.id,'technical_scope.grade',
    jsonb_build_object(
      'company_product_id',p_company_product_id,
      'standard_grade_id',v_standard_grade.id,
      'grade',v_standard_grade.grade,
      'material_designation',v_material.designation
    ),
    jsonb_build_object('enabled',false),
    v_assertion_id
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7e_set_product_grade_impl(uuid,uuid,uuid,boolean)
from public,anon;
grant execute on function private.p3_7e_set_product_grade_impl(uuid,uuid,uuid,boolean)
to authenticated,service_role;

create or replace function public.p3_7e_set_product_grade(
  p_network_company_id uuid,
  p_company_product_id uuid,
  p_standard_grade_id uuid,
  p_enabled boolean default true
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7e_set_product_grade_impl(
    p_network_company_id,p_company_product_id,p_standard_grade_id,p_enabled
  );
$function$;

revoke all on function public.p3_7e_set_product_grade(uuid,uuid,uuid,boolean)
from public,anon;
grant execute on function public.p3_7e_set_product_grade(uuid,uuid,uuid,boolean)
to authenticated,service_role;

create or replace function private.p3_7e_upsert_dimension_scope_impl(
  p_network_company_id uuid,
  p_company_product_id uuid,
  p_scope_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_supported text[];
  v_scope public.network_company_product_dimension_scopes%rowtype;
  v_exists boolean := false;
  v_id uuid;
  v_family text;
  v_od_min numeric;
  v_od_max numeric;
  v_width_min numeric;
  v_width_max numeric;
  v_height_min numeric;
  v_height_max numeric;
  v_thickness_min numeric;
  v_thickness_max numeric;
  v_length_min numeric;
  v_length_max numeric;
  v_assertion_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  v_supported := private.p3_7e_supported_steel_families(
    p_network_company_id,p_company_product_id
  );

  v_family := nullif(btrim(p_payload->>'steel_product_family'),'');
  if v_family is null or not (v_family=any(v_supported)) then
    raise exception 'dimension family is not supported for this product relation'
      using errcode='23503';
  end if;

  v_od_min := nullif(btrim(p_payload->>'outer_diameter_min_mm'),'')::numeric;
  v_od_max := nullif(btrim(p_payload->>'outer_diameter_max_mm'),'')::numeric;
  v_width_min := nullif(btrim(p_payload->>'width_min_mm'),'')::numeric;
  v_width_max := nullif(btrim(p_payload->>'width_max_mm'),'')::numeric;
  v_height_min := nullif(btrim(p_payload->>'height_min_mm'),'')::numeric;
  v_height_max := nullif(btrim(p_payload->>'height_max_mm'),'')::numeric;
  v_thickness_min := nullif(btrim(p_payload->>'thickness_min_mm'),'')::numeric;
  v_thickness_max := nullif(btrim(p_payload->>'thickness_max_mm'),'')::numeric;
  v_length_min := nullif(btrim(p_payload->>'length_min_mm'),'')::numeric;
  v_length_max := nullif(btrim(p_payload->>'length_max_mm'),'')::numeric;

  if p_scope_id is not null then
    select d.* into v_scope
    from public.network_company_product_dimension_scopes d
    where d.id=p_scope_id
      and d.company_product_id=p_company_product_id
    for update;
    v_exists := found;

    if not v_exists then
      raise exception 'dimension scope not found' using errcode='P0002';
    end if;

    perform private.p3_7e_assert_scope_mutable(
      v_scope.source_assertion_id,v_scope.verification_status
    );

    v_id := v_scope.id;
    v_before := jsonb_build_object(
      'steel_product_family',v_scope.steel_product_family,
      'outer_diameter_min_mm',v_scope.outer_diameter_min_mm,
      'outer_diameter_max_mm',v_scope.outer_diameter_max_mm,
      'width_min_mm',v_scope.width_min_mm,
      'width_max_mm',v_scope.width_max_mm,
      'height_min_mm',v_scope.height_min_mm,
      'height_max_mm',v_scope.height_max_mm,
      'thickness_min_mm',v_scope.thickness_min_mm,
      'thickness_max_mm',v_scope.thickness_max_mm,
      'length_min_mm',v_scope.length_min_mm,
      'length_max_mm',v_scope.length_max_mm
    );
  else
    v_id := gen_random_uuid();
    v_before := null;
  end if;

  v_after := jsonb_build_object(
    'company_product_id',p_company_product_id,
    'steel_product_family',v_family,
    'outer_diameter_min_mm',v_od_min,
    'outer_diameter_max_mm',v_od_max,
    'width_min_mm',v_width_min,
    'width_max_mm',v_width_max,
    'height_min_mm',v_height_min,
    'height_max_mm',v_height_max,
    'thickness_min_mm',v_thickness_min,
    'thickness_max_mm',v_thickness_max,
    'length_min_mm',v_length_min,
    'length_max_mm',v_length_max
  );

  v_assertion_id := private.p3_7e_create_assertion(
    p_network_company_id,
    v_id,
    'technical_scope.dimension',
    v_after
  );

  if v_exists then
    update public.network_company_product_dimension_scopes
    set steel_product_family=v_family,
        outer_diameter_min_mm=v_od_min,
        outer_diameter_max_mm=v_od_max,
        width_min_mm=v_width_min,
        width_max_mm=v_width_max,
        height_min_mm=v_height_min,
        height_max_mm=v_height_max,
        thickness_min_mm=v_thickness_min,
        thickness_max_mm=v_thickness_max,
        length_min_mm=v_length_min,
        length_max_mm=v_length_max,
        verification_status='unverified',
        source_assertion_id=v_assertion_id,
        updated_at=now()
    where id=v_id;
  else
    insert into public.network_company_product_dimension_scopes(
      id,company_product_id,steel_product_family,
      outer_diameter_min_mm,outer_diameter_max_mm,
      width_min_mm,width_max_mm,height_min_mm,height_max_mm,
      thickness_min_mm,thickness_max_mm,length_min_mm,length_max_mm,
      verification_status,source_assertion_id
    )
    values(
      v_id,p_company_product_id,v_family,
      v_od_min,v_od_max,
      v_width_min,v_width_max,v_height_min,v_height_max,
      v_thickness_min,v_thickness_max,v_length_min,v_length_max,
      'unverified',v_assertion_id
    );
  end if;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,
    case when v_exists then 'update_product_scope' else 'add_product_scope' end,
    'company_product_scope',
    v_id,
    'technical_scope.dimension',
    v_before,
    v_after,
    v_assertion_id
  );

  return jsonb_build_object(
    'scope_id',v_id,
    'created',not v_exists,
    'steel_product_family',v_family
  );
end;
$function$;

revoke all on function private.p3_7e_upsert_dimension_scope_impl(uuid,uuid,uuid,jsonb)
from public,anon;
grant execute on function private.p3_7e_upsert_dimension_scope_impl(uuid,uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function public.p3_7e_upsert_dimension_scope(
  p_network_company_id uuid,
  p_company_product_id uuid,
  p_scope_id uuid,
  p_payload jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7e_upsert_dimension_scope_impl(
    p_network_company_id,p_company_product_id,p_scope_id,p_payload
  );
$function$;

revoke all on function public.p3_7e_upsert_dimension_scope(uuid,uuid,uuid,jsonb)
from public,anon;
grant execute on function public.p3_7e_upsert_dimension_scope(uuid,uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function private.p3_7e_remove_dimension_scope_impl(
  p_network_company_id uuid,
  p_company_product_id uuid,
  p_scope_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_supported text[];
  v_scope public.network_company_product_dimension_scopes%rowtype;
  v_assertion_id uuid;
  v_before jsonb;
begin
  v_supported := private.p3_7e_supported_steel_families(
    p_network_company_id,p_company_product_id
  );

  select d.* into v_scope
  from public.network_company_product_dimension_scopes d
  where d.id=p_scope_id
    and d.company_product_id=p_company_product_id
  for update;

  if not found then
    return jsonb_build_object('removed',false,'idempotent',true);
  end if;

  perform private.p3_7e_assert_scope_mutable(
    v_scope.source_assertion_id,v_scope.verification_status
  );

  v_before := jsonb_build_object(
    'company_product_id',p_company_product_id,
    'steel_product_family',v_scope.steel_product_family,
    'outer_diameter_min_mm',v_scope.outer_diameter_min_mm,
    'outer_diameter_max_mm',v_scope.outer_diameter_max_mm,
    'width_min_mm',v_scope.width_min_mm,
    'width_max_mm',v_scope.width_max_mm,
    'height_min_mm',v_scope.height_min_mm,
    'height_max_mm',v_scope.height_max_mm,
    'thickness_min_mm',v_scope.thickness_min_mm,
    'thickness_max_mm',v_scope.thickness_max_mm,
    'length_min_mm',v_scope.length_min_mm,
    'length_max_mm',v_scope.length_max_mm
  );

  v_assertion_id := private.p3_7e_create_assertion(
    p_network_company_id,
    v_scope.id,
    'technical_scope.dimension.removed',
    jsonb_build_object(
      'company_product_id',p_company_product_id,
      'steel_product_family',v_scope.steel_product_family,
      'removed',true
    )
  );

  delete from public.network_company_product_dimension_scopes
  where id=v_scope.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,'remove_product_scope','company_product_scope',
    v_scope.id,'technical_scope.dimension',
    v_before,jsonb_build_object('removed',true),
    v_assertion_id
  );

  return jsonb_build_object('removed',true,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7e_remove_dimension_scope_impl(uuid,uuid,uuid)
from public,anon;
grant execute on function private.p3_7e_remove_dimension_scope_impl(uuid,uuid,uuid)
to authenticated,service_role;

create or replace function public.p3_7e_remove_dimension_scope(
  p_network_company_id uuid,
  p_company_product_id uuid,
  p_scope_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7e_remove_dimension_scope_impl(
    p_network_company_id,p_company_product_id,p_scope_id
  );
$function$;

revoke all on function public.p3_7e_remove_dimension_scope(uuid,uuid,uuid)
from public,anon;
grant execute on function public.p3_7e_remove_dimension_scope(uuid,uuid,uuid)
to authenticated,service_role;

create or replace function private.p3_7e_product_scope_json(
  p_company_product_id uuid,
  p_include_catalog boolean
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
with product_ctx as (
  select
    cp.id,
    cp.company_id,
    cp.relationship_type,
    cp.facility_id,
    pf.canonical_key as product_key,
    pf.display_name as product_name,
    case
      when pf.canonical_key='tubes_pipes'
        then array['round_tube']::text[]
      when pf.canonical_key='hollow_sections'
        then array['round_tube','square_tube','rectangular_tube']::text[]
      else array[]::text[]
    end as supported_families
  from public.network_company_products cp
  join public.network_product_families pf on pf.id=cp.product_family_id
  where cp.id=p_company_product_id
)
select jsonb_build_object(
  'company_product_id',p.id,
  'product_key',p.product_key,
  'product_name',p.product_name,
  'relationship_type',p.relationship_type,
  'facility_id',p.facility_id,
  'technical_scope_supported',cardinality(p.supported_families)>0,
  'supported_steel_product_families',to_jsonb(p.supported_families),
  'standards',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',ps.id,
      'standard_id',s.id,
      'code',s.code,
      'title',s.title,
      'verification_status',ps.verification_status,
      'provenance_kind',case
        when ps.verification_status='verified'
          or a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by s.code,ps.id)
    from public.network_company_product_standards ps
    join public.steel_standards s on s.id=ps.standard_id
    left join public.network_data_assertions a on a.id=ps.source_assertion_id
    where ps.company_product_id=p.id
  ),'[]'::jsonb),
  'grades',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',pg.id,
      'company_product_standard_id',ps.id,
      'standard_id',s.id,
      'standard_code',s.code,
      'standard_grade_id',sg.id,
      'grade',sg.grade,
      'material_number',sg.material_number,
      'material_grade_id',mg.id,
      'material_designation',mg.designation,
      'verification_status',pg.verification_status,
      'provenance_kind',case
        when pg.verification_status='verified'
          or a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by s.code,sg.grade,pg.id)
    from public.network_company_product_grades pg
    join public.network_company_product_standards ps
      on ps.id=pg.company_product_standard_id
    join public.steel_standards s on s.id=ps.standard_id
    join public.steel_standard_grades sg on sg.id=pg.standard_grade_id
    join public.steel_material_grades mg on mg.id=sg.material_grade_id
    left join public.network_data_assertions a on a.id=pg.source_assertion_id
    where ps.company_product_id=p.id
  ),'[]'::jsonb),
  'dimension_scopes',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',d.id,
      'steel_product_family',d.steel_product_family,
      'outer_diameter_min_mm',d.outer_diameter_min_mm,
      'outer_diameter_max_mm',d.outer_diameter_max_mm,
      'width_min_mm',d.width_min_mm,
      'width_max_mm',d.width_max_mm,
      'height_min_mm',d.height_min_mm,
      'height_max_mm',d.height_max_mm,
      'thickness_min_mm',d.thickness_min_mm,
      'thickness_max_mm',d.thickness_max_mm,
      'length_min_mm',d.length_min_mm,
      'length_max_mm',d.length_max_mm,
      'verification_status',d.verification_status,
      'provenance_kind',case
        when d.verification_status='verified'
          or a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by d.steel_product_family,d.id)
    from public.network_company_product_dimension_scopes d
    left join public.network_data_assertions a on a.id=d.source_assertion_id
    where d.company_product_id=p.id
  ),'[]'::jsonb),
  'catalog_standards',case when p_include_catalog then coalesce((
    select jsonb_agg(jsonb_build_object(
      'standard_id',s.id,
      'code',s.code,
      'title',s.title,
      'steel_product_families',(
        select jsonb_agg(spf2.product_family order by spf2.product_family)
        from public.steel_standard_product_families spf2
        where spf2.standard_id=s.id
          and spf2.product_family=any(p.supported_families)
      ),
      'grades',coalesce((
        select jsonb_agg(distinct jsonb_build_object(
          'standard_grade_id',sg.id,
          'grade',sg.grade,
          'material_number',sg.material_number,
          'material_grade_id',mg.id,
          'material_designation',mg.designation
        ))
        from public.steel_standard_grades sg
        join public.steel_material_grades mg on mg.id=sg.material_grade_id
        where sg.standard_id=s.id
          and exists(
            select 1
            from public.steel_standard_grade_applicability ga
            where ga.standard_id=sg.standard_id
              and ga.material_grade_id=sg.material_grade_id
              and ga.product_family=any(p.supported_families)
          )
      ),'[]'::jsonb)
    ) order by s.code)
    from public.steel_standards s
    where s.status='active'
      and exists(
        select 1
        from public.steel_standard_product_families spf
        where spf.standard_id=s.id
          and spf.product_family=any(p.supported_families)
      )
  ),'[]'::jsonb) else '[]'::jsonb end
)
from product_ctx p;
$function$;

revoke all on function private.p3_7e_product_scope_json(uuid,boolean)
from public,anon,authenticated;
grant execute on function private.p3_7e_product_scope_json(uuid,boolean)
to service_role;

create or replace function private.p3_7e_managed_product_scope_impl(
  p_network_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  return jsonb_build_object(
    'contract','P3.7E-managed-v1',
    'products',coalesce((
      select jsonb_agg(
        private.p3_7e_product_scope_json(cp.id,true)
        order by pf.sort_order,pf.display_name,cp.relationship_type,cp.id
      )
      from public.network_company_products cp
      join public.network_product_families pf on pf.id=cp.product_family_id
      where cp.company_id=p_network_company_id
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function private.p3_7e_managed_product_scope_impl(uuid)
from public,anon;
grant execute on function private.p3_7e_managed_product_scope_impl(uuid)
to authenticated,service_role;

create or replace function public.p3_7e_managed_product_scope(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_7e_managed_product_scope_impl(p_network_company_id);
$function$;

revoke all on function public.p3_7e_managed_product_scope(uuid)
from public,anon;
grant execute on function public.p3_7e_managed_product_scope(uuid)
to authenticated,service_role;

create or replace function private.p3_7e_public_product_scope_impl(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
select case when exists(
  select 1
  from public.network_companies c
  where c.id=p_network_company_id
    and c.publication_status='published'
) then jsonb_build_object(
  'contract','P3.7E-public-v1',
  'products',coalesce((
    select jsonb_agg(
      private.p3_7e_product_scope_json(cp.id,false)
      order by pf.sort_order,pf.display_name,cp.relationship_type,cp.id
    )
    from public.network_company_products cp
    join public.network_product_families pf on pf.id=cp.product_family_id
    where cp.company_id=p_network_company_id
  ),'[]'::jsonb)
) else null end;
$function$;

revoke all on function private.p3_7e_public_product_scope_impl(uuid)
from public;
grant execute on function private.p3_7e_public_product_scope_impl(uuid)
to anon,authenticated,service_role;

create or replace function public.p3_7e_public_product_scope(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_7e_public_product_scope_impl(p_network_company_id);
$function$;

revoke all on function public.p3_7e_public_product_scope(uuid)
from public;
grant execute on function public.p3_7e_public_product_scope(uuid)
to anon,authenticated,service_role;

create or replace function private.p3_7e_marketplace_supplier_scope_impl(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
select jsonb_build_object(
  'contract','P3.7E-marketplace-v1',
  'network_company_id',p_network_company_id,
  'products',coalesce(
    private.p3_7e_public_product_scope_impl(p_network_company_id)->'products',
    '[]'::jsonb
  )
);
$function$;

revoke all on function private.p3_7e_marketplace_supplier_scope_impl(uuid)
from public,anon;
grant execute on function private.p3_7e_marketplace_supplier_scope_impl(uuid)
to authenticated,service_role;

create or replace function public.p3_7e_marketplace_supplier_scope(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_7e_marketplace_supplier_scope_impl(p_network_company_id);
$function$;

revoke all on function public.p3_7e_marketplace_supplier_scope(uuid)
from public,anon;
grant execute on function public.p3_7e_marketplace_supplier_scope(uuid)
to authenticated,service_role;

comment on table public.network_company_product_standards is
  'P3.7E company-declared standard scope for a Network company-product relation; standard master data stays canonical in Steel Knowledge.';
comment on table public.network_company_product_grades is
  'P3.7E company-declared canonical standard-grade/material scope for a Network company-product relation.';
comment on table public.network_company_product_dimension_scopes is
  'P3.7E structured dimensional supply envelope for tube/hollow-section matching.';
comment on function public.p3_7e_marketplace_supplier_scope(uuid) is
  'P3.7E matching-ready supplier scope read model built from public Network declarations and canonical Steel Knowledge.';
