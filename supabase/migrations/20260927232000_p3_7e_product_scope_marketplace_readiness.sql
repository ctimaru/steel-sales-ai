-- P3.7E — Product Scope & Marketplace Readiness
-- Reuses canonical Steel Knowledge standards/material grades for company-declared supplier scope.

create table if not exists public.network_product_family_steel_mappings (
  network_product_family_id uuid not null references public.network_product_families(id) on delete restrict,
  steel_product_family text not null check (length(btrim(steel_product_family))>0),
  created_at timestamptz not null default now(),
  primary key(network_product_family_id,steel_product_family)
);

insert into public.network_product_family_steel_mappings(
  network_product_family_id,steel_product_family
)
select pf.id,v.steel_product_family
from public.network_product_families pf
join (
  values
    ('tubes_pipes','round_tube'),
    ('hollow_sections','round_tube'),
    ('hollow_sections','square_tube'),
    ('hollow_sections','rectangular_tube')
) as v(network_key,steel_product_family)
  on pf.canonical_key=v.network_key
on conflict do nothing;

create table if not exists public.network_company_product_standard_scopes (
  id uuid primary key default gen_random_uuid(),
  company_product_id uuid not null references public.network_company_products(id) on delete restrict,
  standard_id uuid not null references public.steel_standards(id) on delete restrict,
  source_assertion_id uuid not null references public.network_data_assertions(id) on delete restrict,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  unique(company_product_id,standard_id)
);

create table if not exists public.network_company_product_grade_scopes (
  id uuid primary key default gen_random_uuid(),
  company_product_id uuid not null references public.network_company_products(id) on delete restrict,
  standard_id uuid not null references public.steel_standards(id) on delete restrict,
  material_grade_id uuid not null references public.steel_material_grades(id) on delete restrict,
  source_assertion_id uuid not null references public.network_data_assertions(id) on delete restrict,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  unique(company_product_id,standard_id,material_grade_id),
  foreign key(company_product_id,standard_id)
    references public.network_company_product_standard_scopes(company_product_id,standard_id)
    on delete restrict
);

create table if not exists public.network_company_product_dimension_scopes (
  id uuid primary key default gen_random_uuid(),
  company_product_id uuid not null references public.network_company_products(id) on delete restrict,
  dimension_type text not null
    check (dimension_type in ('outer_diameter','width','height','wall_thickness','length')),
  min_mm numeric not null check (min_mm>0),
  max_mm numeric not null check (max_mm>=min_mm),
  source_assertion_id uuid not null references public.network_data_assertions(id) on delete restrict,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_product_id,dimension_type)
);

create index if not exists network_company_product_standard_scopes_standard_idx
  on public.network_company_product_standard_scopes(standard_id);
create index if not exists network_company_product_grade_scopes_grade_idx
  on public.network_company_product_grade_scopes(material_grade_id);
create index if not exists network_company_product_dimension_scopes_product_idx
  on public.network_company_product_dimension_scopes(company_product_id);

alter table public.network_product_family_steel_mappings enable row level security;
alter table public.network_company_product_standard_scopes enable row level security;
alter table public.network_company_product_grade_scopes enable row level security;
alter table public.network_company_product_dimension_scopes enable row level security;

revoke all on public.network_product_family_steel_mappings from anon,authenticated;
revoke all on public.network_company_product_standard_scopes from anon,authenticated;
revoke all on public.network_company_product_grade_scopes from anon,authenticated;
revoke all on public.network_company_product_dimension_scopes from anon,authenticated;

create or replace function private.p3_7e_require_product_access(
  p_company_product_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_company_id uuid;
begin
  select cp.company_id into v_company_id
  from public.network_company_products cp
  where cp.id=p_company_product_id;

  if v_company_id is null then
    raise exception 'company product relationship not found' using errcode='P0002';
  end if;

  perform private.p3_7b_require_manage_access(v_company_id);
  return v_company_id;
end;
$function$;

revoke all on function private.p3_7e_require_product_access(uuid)
from public,anon,authenticated;

create or replace function private.p3_7e_create_assertion(
  p_company_id uuid,
  p_company_product_id uuid,
  p_field_path text,
  p_value jsonb
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
  v_user := private.p3_7b_require_manage_access(p_company_id);

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,
    asserted_by,confidence,review_state
  )
  values(
    'company_product',p_company_product_id,btrim(p_field_path),coalesce(p_value,'{}'::jsonb),
    'company_declared','managed_profile:p3.7e','company_managed',
    v_user,1.0000,'accepted'
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function private.p3_7e_create_assertion(uuid,uuid,text,jsonb)
from public,anon,authenticated;

create or replace function private.p3_7e_set_standard_impl(
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
  v_company_id uuid;
  v_scope public.network_company_product_standard_scopes%rowtype;
  v_standard public.steel_standards%rowtype;
  v_assertion uuid;
begin
  v_company_id := private.p3_7e_require_product_access(p_company_product_id);

  select * into v_standard
  from public.steel_standards
  where id=p_standard_id and status='active';

  if not found then
    raise exception 'active steel standard not found' using errcode='P0002';
  end if;

  if not exists(
    select 1
    from public.network_company_products cp
    join public.network_product_family_steel_mappings map
      on map.network_product_family_id=cp.product_family_id
    join public.steel_standard_product_families spf
      on spf.product_family=map.steel_product_family
     and spf.standard_id=p_standard_id
    where cp.id=p_company_product_id
  ) then
    raise exception 'steel standard is not mapped to this Network product family'
      using errcode='22023';
  end if;

  select * into v_scope
  from public.network_company_product_standard_scopes
  where company_product_id=p_company_product_id
    and standard_id=p_standard_id
  for update;

  if coalesce(p_enabled,false) then
    if found then
      return jsonb_build_object('scope_id',v_scope.id,'enabled',true,'idempotent',true);
    end if;

    v_assertion := private.p3_7e_create_assertion(
      v_company_id,p_company_product_id,
      'technical_scope.standard.'||p_standard_id::text,
      jsonb_build_object('standard_id',p_standard_id,'standard_code',v_standard.code,'enabled',true)
    );

    insert into public.network_company_product_standard_scopes(
      company_product_id,standard_id,source_assertion_id
    )
    values(p_company_product_id,p_standard_id,v_assertion)
    returning * into v_scope;

    perform private.p3_7_record_profile_event_impl(
      v_company_id,'add_relation','company_product',p_company_product_id,
      'technical_scope.standard',null,
      jsonb_build_object('standard_id',p_standard_id,'standard_code',v_standard.code),
      v_assertion
    );

    return jsonb_build_object('scope_id',v_scope.id,'enabled',true,'idempotent',false);
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  if v_scope.verification_status<>'unverified' then
    raise exception 'verified standard scope requires Platform review' using errcode='42501';
  end if;

  if exists(
    select 1 from public.network_company_product_grade_scopes g
    where g.company_product_id=p_company_product_id
      and g.standard_id=p_standard_id
  ) then
    raise exception 'remove grade scope before removing its standard'
      using errcode='23503';
  end if;

  v_assertion := private.p3_7e_create_assertion(
    v_company_id,p_company_product_id,
    'technical_scope.standard.'||p_standard_id::text,
    jsonb_build_object('standard_id',p_standard_id,'standard_code',v_standard.code,'enabled',false)
  );

  delete from public.network_company_product_standard_scopes where id=v_scope.id;

  perform private.p3_7_record_profile_event_impl(
    v_company_id,'remove_relation','company_product',p_company_product_id,
    'technical_scope.standard',
    jsonb_build_object('standard_id',p_standard_id,'standard_code',v_standard.code),
    null,v_assertion
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7e_set_standard_impl(uuid,uuid,boolean)
from public,anon;
grant execute on function private.p3_7e_set_standard_impl(uuid,uuid,boolean)
to authenticated,service_role;

create or replace function public.p3_7e_set_product_standard(
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
  select private.p3_7e_set_standard_impl(p_company_product_id,p_standard_id,p_enabled);
$function$;

revoke all on function public.p3_7e_set_product_standard(uuid,uuid,boolean)
from public,anon;
grant execute on function public.p3_7e_set_product_standard(uuid,uuid,boolean)
to authenticated,service_role;

create or replace function private.p3_7e_set_grade_impl(
  p_company_product_id uuid,
  p_standard_id uuid,
  p_material_grade_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_company_id uuid;
  v_scope public.network_company_product_grade_scopes%rowtype;
  v_grade public.steel_material_grades%rowtype;
  v_standard_code text;
  v_assertion uuid;
begin
  v_company_id := private.p3_7e_require_product_access(p_company_product_id);

  if not exists(
    select 1 from public.network_company_product_standard_scopes s
    where s.company_product_id=p_company_product_id
      and s.standard_id=p_standard_id
  ) then
    raise exception 'select the steel standard before adding a grade'
      using errcode='23503';
  end if;

  select * into v_grade
  from public.steel_material_grades
  where id=p_material_grade_id;
  if not found then
    raise exception 'steel material grade not found' using errcode='P0002';
  end if;

  select s.code into v_standard_code
  from public.steel_standards s where s.id=p_standard_id;

  if not (
    exists(
      select 1
      from public.steel_standard_grade_applicability a
      where a.standard_id=p_standard_id
        and a.material_grade_id=p_material_grade_id
    )
    or exists(
      select 1
      from public.steel_standard_grades sg
      where sg.standard_id=p_standard_id
        and sg.material_grade_id=p_material_grade_id
    )
  ) then
    raise exception 'material grade is not canonically linked to selected standard'
      using errcode='22023';
  end if;

  select * into v_scope
  from public.network_company_product_grade_scopes
  where company_product_id=p_company_product_id
    and standard_id=p_standard_id
    and material_grade_id=p_material_grade_id
  for update;

  if coalesce(p_enabled,false) then
    if found then
      return jsonb_build_object('scope_id',v_scope.id,'enabled',true,'idempotent',true);
    end if;

    v_assertion := private.p3_7e_create_assertion(
      v_company_id,p_company_product_id,
      'technical_scope.grade.'||p_material_grade_id::text,
      jsonb_build_object(
        'standard_id',p_standard_id,
        'standard_code',v_standard_code,
        'material_grade_id',p_material_grade_id,
        'designation',v_grade.designation,
        'enabled',true
      )
    );

    insert into public.network_company_product_grade_scopes(
      company_product_id,standard_id,material_grade_id,source_assertion_id
    )
    values(p_company_product_id,p_standard_id,p_material_grade_id,v_assertion)
    returning * into v_scope;

    perform private.p3_7_record_profile_event_impl(
      v_company_id,'add_relation','company_product',p_company_product_id,
      'technical_scope.grade',null,
      jsonb_build_object(
        'standard_id',p_standard_id,
        'standard_code',v_standard_code,
        'material_grade_id',p_material_grade_id,
        'designation',v_grade.designation
      ),
      v_assertion
    );

    return jsonb_build_object('scope_id',v_scope.id,'enabled',true,'idempotent',false);
  end if;

  if not found then
    return jsonb_build_object('enabled',false,'idempotent',true);
  end if;

  if v_scope.verification_status<>'unverified' then
    raise exception 'verified grade scope requires Platform review' using errcode='42501';
  end if;

  v_assertion := private.p3_7e_create_assertion(
    v_company_id,p_company_product_id,
    'technical_scope.grade.'||p_material_grade_id::text,
    jsonb_build_object(
      'standard_id',p_standard_id,'standard_code',v_standard_code,
      'material_grade_id',p_material_grade_id,'designation',v_grade.designation,
      'enabled',false
    )
  );

  delete from public.network_company_product_grade_scopes where id=v_scope.id;

  perform private.p3_7_record_profile_event_impl(
    v_company_id,'remove_relation','company_product',p_company_product_id,
    'technical_scope.grade',
    jsonb_build_object(
      'standard_id',p_standard_id,'standard_code',v_standard_code,
      'material_grade_id',p_material_grade_id,'designation',v_grade.designation
    ),
    null,v_assertion
  );

  return jsonb_build_object('enabled',false,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7e_set_grade_impl(uuid,uuid,uuid,boolean)
from public,anon;
grant execute on function private.p3_7e_set_grade_impl(uuid,uuid,uuid,boolean)
to authenticated,service_role;

create or replace function public.p3_7e_set_product_grade(
  p_company_product_id uuid,
  p_standard_id uuid,
  p_material_grade_id uuid,
  p_enabled boolean default true
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7e_set_grade_impl(
    p_company_product_id,p_standard_id,p_material_grade_id,p_enabled
  );
$function$;

revoke all on function public.p3_7e_set_product_grade(uuid,uuid,uuid,boolean)
from public,anon;
grant execute on function public.p3_7e_set_product_grade(uuid,uuid,uuid,boolean)
to authenticated,service_role;

create or replace function private.p3_7e_upsert_dimension_impl(
  p_company_product_id uuid,
  p_dimension_type text,
  p_min_mm numeric,
  p_max_mm numeric
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_company_id uuid;
  v_product_key text;
  v_scope public.network_company_product_dimension_scopes%rowtype;
  v_assertion uuid;
  v_type text;
begin
  v_company_id := private.p3_7e_require_product_access(p_company_product_id);
  v_type := lower(btrim(coalesce(p_dimension_type,'')));

  if v_type not in ('outer_diameter','width','height','wall_thickness','length') then
    raise exception 'invalid technical dimension type' using errcode='22023';
  end if;

  if p_min_mm is null or p_max_mm is null or p_min_mm<=0 or p_max_mm<p_min_mm then
    raise exception 'invalid technical dimension range' using errcode='22023';
  end if;

  select pf.canonical_key into v_product_key
  from public.network_company_products cp
  join public.network_product_families pf on pf.id=cp.product_family_id
  where cp.id=p_company_product_id;

  if v_product_key not in ('tubes_pipes','hollow_sections') then
    raise exception 'dimension scope is currently available for tubes and hollow sections only'
      using errcode='22023';
  end if;

  select * into v_scope
  from public.network_company_product_dimension_scopes
  where company_product_id=p_company_product_id
    and dimension_type=v_type
  for update;

  if found and v_scope.verification_status<>'unverified' then
    raise exception 'verified dimension scope requires Platform review' using errcode='42501';
  end if;

  v_assertion := private.p3_7e_create_assertion(
    v_company_id,p_company_product_id,
    'technical_scope.dimension.'||v_type,
    jsonb_build_object('dimension_type',v_type,'min_mm',p_min_mm,'max_mm',p_max_mm)
  );

  if found then
    update public.network_company_product_dimension_scopes
    set min_mm=p_min_mm,max_mm=p_max_mm,
        source_assertion_id=v_assertion,updated_at=now()
    where id=v_scope.id;

    perform private.p3_7_record_profile_event_impl(
      v_company_id,'add_relation','company_product',p_company_product_id,
      'technical_scope.dimension.'||v_type,
      jsonb_build_object('min_mm',v_scope.min_mm,'max_mm',v_scope.max_mm),
      jsonb_build_object('min_mm',p_min_mm,'max_mm',p_max_mm),
      v_assertion
    );

    return jsonb_build_object('scope_id',v_scope.id,'updated',true);
  end if;

  insert into public.network_company_product_dimension_scopes(
    company_product_id,dimension_type,min_mm,max_mm,source_assertion_id
  )
  values(p_company_product_id,v_type,p_min_mm,p_max_mm,v_assertion)
  returning * into v_scope;

  perform private.p3_7_record_profile_event_impl(
    v_company_id,'add_relation','company_product',p_company_product_id,
    'technical_scope.dimension.'||v_type,null,
    jsonb_build_object('min_mm',p_min_mm,'max_mm',p_max_mm),
    v_assertion
  );

  return jsonb_build_object('scope_id',v_scope.id,'updated',false);
end;
$function$;

revoke all on function private.p3_7e_upsert_dimension_impl(uuid,text,numeric,numeric)
from public,anon;
grant execute on function private.p3_7e_upsert_dimension_impl(uuid,text,numeric,numeric)
to authenticated,service_role;

create or replace function public.p3_7e_upsert_product_dimension(
  p_company_product_id uuid,
  p_dimension_type text,
  p_min_mm numeric,
  p_max_mm numeric
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7e_upsert_dimension_impl(
    p_company_product_id,p_dimension_type,p_min_mm,p_max_mm
  );
$function$;

revoke all on function public.p3_7e_upsert_product_dimension(uuid,text,numeric,numeric)
from public,anon;
grant execute on function public.p3_7e_upsert_product_dimension(uuid,text,numeric,numeric)
to authenticated,service_role;

create or replace function private.p3_7e_remove_dimension_impl(
  p_company_product_id uuid,
  p_dimension_type text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_company_id uuid;
  v_scope public.network_company_product_dimension_scopes%rowtype;
  v_assertion uuid;
  v_type text;
begin
  v_company_id := private.p3_7e_require_product_access(p_company_product_id);
  v_type := lower(btrim(coalesce(p_dimension_type,'')));

  select * into v_scope
  from public.network_company_product_dimension_scopes
  where company_product_id=p_company_product_id
    and dimension_type=v_type
  for update;

  if not found then
    return jsonb_build_object('removed',false,'idempotent',true);
  end if;

  if v_scope.verification_status<>'unverified' then
    raise exception 'verified dimension scope requires Platform review' using errcode='42501';
  end if;

  v_assertion := private.p3_7e_create_assertion(
    v_company_id,p_company_product_id,
    'technical_scope.dimension.'||v_type,
    jsonb_build_object('dimension_type',v_type,'enabled',false)
  );

  delete from public.network_company_product_dimension_scopes where id=v_scope.id;

  perform private.p3_7_record_profile_event_impl(
    v_company_id,'remove_relation','company_product',p_company_product_id,
    'technical_scope.dimension.'||v_type,
    jsonb_build_object('min_mm',v_scope.min_mm,'max_mm',v_scope.max_mm),
    null,v_assertion
  );

  return jsonb_build_object('removed',true,'idempotent',false);
end;
$function$;

revoke all on function private.p3_7e_remove_dimension_impl(uuid,text)
from public,anon;
grant execute on function private.p3_7e_remove_dimension_impl(uuid,text)
to authenticated,service_role;

create or replace function public.p3_7e_remove_product_dimension(
  p_company_product_id uuid,
  p_dimension_type text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7e_remove_dimension_impl(p_company_product_id,p_dimension_type);
$function$;

revoke all on function public.p3_7e_remove_product_dimension(uuid,text)
from public,anon;
grant execute on function public.p3_7e_remove_product_dimension(uuid,text)
to authenticated,service_role;

create or replace function private.p3_7e_product_delete_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  if exists(select 1 from public.network_company_product_standard_scopes where company_product_id=old.id)
     or exists(select 1 from public.network_company_product_grade_scopes where company_product_id=old.id)
     or exists(select 1 from public.network_company_product_dimension_scopes where company_product_id=old.id) then
    raise exception 'remove technical product scope before removing product relationship'
      using errcode='23503';
  end if;
  return old;
end;
$function$;

drop trigger if exists network_company_product_technical_scope_guard
on public.network_company_products;
create trigger network_company_product_technical_scope_guard
before delete on public.network_company_products
for each row execute function private.p3_7e_product_delete_guard();

create or replace function private.p3_7e_provenance_kind(
  p_assertion_id uuid,
  p_verification_status text
)
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when p_verification_status='verified'
      or a.ownership_type='platform_verified' then 'platform_verified'
    when a.ownership_type='company_managed' then 'company_declared'
    when a.source_type='public_web' then 'public_web'
    else 'platform_curated'
  end
  from (select 1) x
  left join public.network_data_assertions a on a.id=p_assertion_id;
$function$;

revoke all on function private.p3_7e_provenance_kind(uuid,text)
from public,anon,authenticated;

create or replace function private.p3_7e_managed_product_scope_impl(
  p_network_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
begin
  perform private.p3_7b_require_manage_access(p_network_company_id);

  return jsonb_build_object(
    'standard_scopes',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',sc.id,
        'company_product_id',sc.company_product_id,
        'standard_id',s.id,
        'standard_code',s.code,
        'standard_title',s.title,
        'verification_status',sc.verification_status,
        'source_assertion_id',sc.source_assertion_id,
        'provenance_kind',private.p3_7e_provenance_kind(sc.source_assertion_id,sc.verification_status)
      ) order by s.code),'[]'::jsonb)
      from public.network_company_product_standard_scopes sc
      join public.network_company_products cp on cp.id=sc.company_product_id
      join public.steel_standards s on s.id=sc.standard_id
      where cp.company_id=p_network_company_id
    ),
    'grade_scopes',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',gs.id,
        'company_product_id',gs.company_product_id,
        'standard_id',gs.standard_id,
        'standard_code',s.code,
        'material_grade_id',mg.id,
        'designation',mg.designation,
        'material_number',mg.material_number,
        'verification_status',gs.verification_status,
        'source_assertion_id',gs.source_assertion_id,
        'provenance_kind',private.p3_7e_provenance_kind(gs.source_assertion_id,gs.verification_status)
      ) order by s.code,mg.designation),'[]'::jsonb)
      from public.network_company_product_grade_scopes gs
      join public.network_company_products cp on cp.id=gs.company_product_id
      join public.steel_standards s on s.id=gs.standard_id
      join public.steel_material_grades mg on mg.id=gs.material_grade_id
      where cp.company_id=p_network_company_id
    ),
    'dimension_scopes',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',ds.id,
        'company_product_id',ds.company_product_id,
        'dimension_type',ds.dimension_type,
        'min_mm',ds.min_mm,
        'max_mm',ds.max_mm,
        'verification_status',ds.verification_status,
        'source_assertion_id',ds.source_assertion_id,
        'provenance_kind',private.p3_7e_provenance_kind(ds.source_assertion_id,ds.verification_status)
      ) order by ds.dimension_type),'[]'::jsonb)
      from public.network_company_product_dimension_scopes ds
      join public.network_company_products cp on cp.id=ds.company_product_id
      where cp.company_id=p_network_company_id
    ),
    'taxonomy',jsonb_build_object(
      'standards',(
        select coalesce(jsonb_agg(to_jsonb(q) order by q.code),'[]'::jsonb)
        from (
          select
            s.id,
            s.code,
            s.title,
            array_agg(distinct pf.canonical_key order by pf.canonical_key) as network_product_keys
          from public.steel_standards s
          join public.steel_standard_product_families spf on spf.standard_id=s.id
          join public.network_product_family_steel_mappings map
            on map.steel_product_family=spf.product_family
          join public.network_product_families pf
            on pf.id=map.network_product_family_id
          where s.status='active'
          group by s.id,s.code,s.title
        ) q
      ),
      'grades',(
        select coalesce(jsonb_agg(to_jsonb(q) order by q.standard_code,q.designation),'[]'::jsonb)
        from (
          select distinct
            links.standard_id,
            s.code as standard_code,
            mg.id as material_grade_id,
            mg.designation,
            mg.material_number
          from (
            select a.standard_id,a.material_grade_id
            from public.steel_standard_grade_applicability a
            union
            select sg.standard_id,sg.material_grade_id
            from public.steel_standard_grades sg
            where sg.material_grade_id is not null
          ) links
          join public.steel_standards s on s.id=links.standard_id and s.status='active'
          join public.steel_material_grades mg on mg.id=links.material_grade_id
          where exists(
            select 1
            from public.steel_standard_product_families spf
            join public.network_product_family_steel_mappings map
              on map.steel_product_family=spf.product_family
            where spf.standard_id=s.id
          )
        ) q
      )
    )
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
select jsonb_build_object(
  'products',coalesce(jsonb_agg(jsonb_build_object(
    'company_product_id',cp.id,
    'key',pf.canonical_key,
    'relationship_type',cp.relationship_type,
    'facility_id',cp.facility_id,
    'standards',coalesce((
      select jsonb_agg(jsonb_build_object(
        'standard_id',s.id,
        'code',s.code,
        'title',s.title,
        'verification_status',sc.verification_status,
        'provenance_kind',private.p3_7e_provenance_kind(sc.source_assertion_id,sc.verification_status)
      ) order by s.code)
      from public.network_company_product_standard_scopes sc
      join public.steel_standards s on s.id=sc.standard_id
      where sc.company_product_id=cp.id
    ),'[]'::jsonb),
    'grades',coalesce((
      select jsonb_agg(jsonb_build_object(
        'standard_id',gs.standard_id,
        'standard_code',s.code,
        'material_grade_id',mg.id,
        'designation',mg.designation,
        'material_number',mg.material_number,
        'verification_status',gs.verification_status,
        'provenance_kind',private.p3_7e_provenance_kind(gs.source_assertion_id,gs.verification_status)
      ) order by s.code,mg.designation)
      from public.network_company_product_grade_scopes gs
      join public.steel_standards s on s.id=gs.standard_id
      join public.steel_material_grades mg on mg.id=gs.material_grade_id
      where gs.company_product_id=cp.id
    ),'[]'::jsonb),
    'dimensions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'dimension_type',ds.dimension_type,
        'min_mm',ds.min_mm,
        'max_mm',ds.max_mm,
        'verification_status',ds.verification_status,
        'provenance_kind',private.p3_7e_provenance_kind(ds.source_assertion_id,ds.verification_status)
      ) order by ds.dimension_type)
      from public.network_company_product_dimension_scopes ds
      where ds.company_product_id=cp.id
    ),'[]'::jsonb)
  ) order by pf.sort_order,pf.display_name,cp.relationship_type),'[]'::jsonb)
)
from public.network_company_products cp
join public.network_product_families pf on pf.id=cp.product_family_id
where cp.company_id=p_network_company_id;
$function$;

revoke all on function private.p3_7e_public_product_scope_impl(uuid)
from public,anon;
grant execute on function private.p3_7e_public_product_scope_impl(uuid)
to authenticated,service_role;

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
from public,anon;
grant execute on function public.p3_7e_public_product_scope(uuid)
to authenticated,service_role;

comment on table public.network_company_product_standard_scopes is
  'P3.7E company-declared applicability of canonical Steel Knowledge standards to a Network product relationship.';
comment on table public.network_company_product_grade_scopes is
  'P3.7E company-declared material-grade scope, always tied to a selected canonical standard.';
comment on table public.network_company_product_dimension_scopes is
  'P3.7E declared supplier dimensional envelope in millimetres for tubes/hollow-sections product relationships.';
