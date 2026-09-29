-- P5.1 — Demand Listing Foundation
-- Explicit Marketplace demand, separate from private Commercial Memory RFQs.

create table public.marketplace_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  visibility_mode text not null default 'named',
  status text not null default 'draft',
  opens_at timestamptz null,
  closes_at timestamptz null,
  published_at timestamptz null,
  withdrawn_at timestamptz null,
  source_kind text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketplace_requests_title_check
    check (char_length(btrim(title)) between 5 and 200),
  constraint marketplace_requests_visibility_check
    check (visibility_mode in ('named','anonymous')),
  constraint marketplace_requests_status_check
    check (status in ('draft','published','withdrawn')),
  constraint marketplace_requests_source_check
    check (source_kind='manual'),
  constraint marketplace_requests_lifecycle_check
    check (
      (status='draft' and opens_at is null and published_at is null and withdrawn_at is null)
      or
      (status='published' and opens_at is not null and closes_at is not null and published_at is not null and withdrawn_at is null)
      or
      (status='withdrawn' and withdrawn_at is not null)
    )
);

create index marketplace_requests_org_status_idx
  on public.marketplace_requests(organization_id,status,created_at desc);
create index marketplace_requests_published_idx
  on public.marketplace_requests(status,closes_at desc)
  where status='published';

alter table public.marketplace_requests enable row level security;
revoke all on table public.marketplace_requests from public,anon,authenticated;
grant select,insert,update,delete on table public.marketplace_requests to service_role;

create table public.marketplace_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_requests(id) on delete restrict,
  line_number integer not null,
  product_family_id uuid not null references public.network_product_families(id) on delete restrict,
  standard_id uuid null references public.steel_standards(id) on delete restrict,
  material_grade_id uuid null references public.steel_material_grades(id) on delete restrict,
  manufacturing_process text null,
  outer_diameter_mm numeric null,
  width_mm numeric null,
  height_mm numeric null,
  thickness_mm numeric null,
  length_mm numeric null,
  quantity numeric not null,
  quantity_unit text not null,
  certification text null,
  delivery_country_code text not null,
  delivery_region text null,
  requested_delivery_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(request_id,line_number),
  constraint marketplace_request_lines_line_number_check
    check (line_number between 1 and 25),
  constraint marketplace_request_lines_quantity_check
    check (quantity>0),
  constraint marketplace_request_lines_quantity_unit_check
    check (quantity_unit in ('m','kg','t','pcs')),
  constraint marketplace_request_lines_country_check
    check (delivery_country_code ~ '^[A-Z]{2}$'),
  constraint marketplace_request_lines_grade_requires_standard_check
    check (material_grade_id is null or standard_id is not null),
  constraint marketplace_request_lines_dimensions_check
    check (
      (outer_diameter_mm is null or outer_diameter_mm>0)
      and (width_mm is null or width_mm>0)
      and (height_mm is null or height_mm>0)
      and (thickness_mm is null or thickness_mm>0)
      and (length_mm is null or length_mm>0)
    ),
  constraint marketplace_request_lines_manufacturing_process_check
    check (manufacturing_process is null or char_length(btrim(manufacturing_process)) between 1 and 80),
  constraint marketplace_request_lines_certification_check
    check (certification is null or char_length(btrim(certification))<=200),
  constraint marketplace_request_lines_region_check
    check (delivery_region is null or char_length(btrim(delivery_region))<=120),
  constraint marketplace_request_lines_notes_check
    check (notes is null or char_length(btrim(notes))<=2000)
);

create index marketplace_request_lines_request_idx
  on public.marketplace_request_lines(request_id,line_number);
create index marketplace_request_lines_product_idx
  on public.marketplace_request_lines(product_family_id,standard_id,material_grade_id);

alter table public.marketplace_request_lines enable row level security;
revoke all on table public.marketplace_request_lines from public,anon,authenticated;
grant select,insert,update,delete on table public.marketplace_request_lines to service_role;

create table public.marketplace_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_requests(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_organization_id uuid not null references public.organizations(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint marketplace_request_events_type_check
    check (event_type in ('created','updated','line_added','line_removed','published','withdrawn')),
  constraint marketplace_request_events_metadata_check
    check (jsonb_typeof(metadata)='object' and pg_column_size(metadata)<=16384)
);

create index marketplace_request_events_request_idx
  on public.marketplace_request_events(request_id,created_at,id);

alter table public.marketplace_request_events enable row level security;
revoke all on table public.marketplace_request_events from public,anon,authenticated;
grant select,insert,update,delete on table public.marketplace_request_events to service_role;

create or replace function private.p5_1_marketplace_event_immutable()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'marketplace_request_events is append-only' using errcode='55000';
end;
$function$;

revoke all on function private.p5_1_marketplace_event_immutable()
from public,anon,authenticated;

create trigger marketplace_request_events_immutable
before update or delete on public.marketplace_request_events
for each row execute function private.p5_1_marketplace_event_immutable();

create or replace function private.p5_1_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.p5_1_touch_updated_at()
from public,anon,authenticated;

create trigger marketplace_requests_touch_updated_at
before update on public.marketplace_requests
for each row execute function private.p5_1_touch_updated_at();

create trigger marketplace_request_lines_touch_updated_at
before update on public.marketplace_request_lines
for each row execute function private.p5_1_touch_updated_at();

create or replace function private.p5_1_require_actor(
  p_organization_id uuid,
  p_write boolean default true
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user
      and om.status='active'
      and (not p_write or om.role in ('admin','member'))
  ) then
    if p_write then
      raise exception 'active organization admin/member membership required' using errcode='42501';
    end if;
    raise exception 'active organization membership required' using errcode='42501';
  end if;

  return v_user;
end;
$function$;

revoke all on function private.p5_1_require_actor(uuid,boolean)
from public,anon,authenticated;

create or replace function private.p5_1_require_request(
  p_request_id uuid,
  p_write boolean default true
)
returns public.marketplace_requests
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_row public.marketplace_requests%rowtype;
begin
  select * into v_row
  from public.marketplace_requests
  where id=p_request_id;

  if not found then
    raise exception 'marketplace request not found' using errcode='P0002';
  end if;

  perform private.p5_1_require_actor(v_row.organization_id,p_write);
  return v_row;
end;
$function$;

revoke all on function private.p5_1_require_request(uuid,boolean)
from public,anon,authenticated;

create or replace function private.p5_1_record_event(
  p_request_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_actor_organization_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_id uuid;
begin
  insert into public.marketplace_request_events(
    request_id,event_type,actor_user_id,actor_organization_id,metadata
  )
  values(
    p_request_id,p_event_type,p_actor_user_id,p_actor_organization_id,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function private.p5_1_record_event(uuid,text,uuid,uuid,jsonb)
from public,anon,authenticated;

create or replace function private.p5_1_create_request_impl(
  p_organization_id uuid,
  p_title text,
  p_visibility_mode text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_id uuid;
  v_title text;
  v_visibility text;
  v_count int;
begin
  v_user := private.p5_1_require_actor(p_organization_id,true);
  v_title := btrim(coalesce(p_title,''));
  v_visibility := lower(btrim(coalesce(p_visibility_mode,'')));

  if char_length(v_title) not between 5 and 200 then
    raise exception 'title must contain 5-200 characters' using errcode='22023';
  end if;
  if v_visibility not in ('named','anonymous') then
    raise exception 'visibility mode must be named or anonymous' using errcode='22023';
  end if;

  select count(*)::int into v_count
  from public.marketplace_requests r
  where r.organization_id=p_organization_id
    and r.created_at>=now()-interval '24 hours';

  if v_count>=20 then
    raise exception 'organization marketplace request rate limit exceeded' using errcode='P0001';
  end if;

  insert into public.marketplace_requests(
    organization_id,created_by_user_id,title,visibility_mode,status,source_kind
  )
  values(
    p_organization_id,v_user,v_title,v_visibility,'draft','manual'
  )
  returning id into v_id;

  perform private.p5_1_record_event(
    v_id,'created',v_user,p_organization_id,
    jsonb_build_object('visibility_mode',v_visibility,'source_kind','manual')
  );

  return jsonb_build_object(
    'request_id',v_id,
    'status','draft',
    'visibility_mode',v_visibility,
    'organization_id',p_organization_id
  );
end;
$function$;

revoke all on function private.p5_1_create_request_impl(uuid,text,text)
from public,anon;
grant execute on function private.p5_1_create_request_impl(uuid,text,text)
to authenticated,service_role;

create or replace function public.p5_1_create_request(
  p_organization_id uuid,
  p_title text,
  p_visibility_mode text default 'named'
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_1_create_request_impl(
    p_organization_id,p_title,p_visibility_mode
  );
$function$;

revoke all on function public.p5_1_create_request(uuid,text,text)
from public,anon;
grant execute on function public.p5_1_create_request(uuid,text,text)
to authenticated,service_role;

create or replace function private.p5_1_update_request_impl(
  p_request_id uuid,
  p_title text,
  p_visibility_mode text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_row public.marketplace_requests%rowtype;
  v_user uuid;
  v_title text;
  v_visibility text;
begin
  v_row := private.p5_1_require_request(p_request_id,true);
  v_user := (select auth.uid());

  if v_row.status<>'draft' then
    raise exception 'only draft marketplace requests can be edited' using errcode='22023';
  end if;

  v_title := btrim(coalesce(p_title,''));
  v_visibility := lower(btrim(coalesce(p_visibility_mode,'')));

  if char_length(v_title) not between 5 and 200 then
    raise exception 'title must contain 5-200 characters' using errcode='22023';
  end if;
  if v_visibility not in ('named','anonymous') then
    raise exception 'visibility mode must be named or anonymous' using errcode='22023';
  end if;

  update public.marketplace_requests
  set title=v_title,visibility_mode=v_visibility
  where id=p_request_id;

  perform private.p5_1_record_event(
    p_request_id,'updated',v_user,v_row.organization_id,
    jsonb_build_object('visibility_mode',v_visibility)
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status','draft',
    'visibility_mode',v_visibility
  );
end;
$function$;

revoke all on function private.p5_1_update_request_impl(uuid,text,text)
from public,anon;
grant execute on function private.p5_1_update_request_impl(uuid,text,text)
to authenticated,service_role;

create or replace function public.p5_1_update_request(
  p_request_id uuid,
  p_title text,
  p_visibility_mode text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_1_update_request_impl(
    p_request_id,p_title,p_visibility_mode
  );
$function$;

revoke all on function public.p5_1_update_request(uuid,text,text)
from public,anon;
grant execute on function public.p5_1_update_request(uuid,text,text)
to authenticated,service_role;

create or replace function private.p5_1_add_line_impl(
  p_request_id uuid,
  p_line jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
  v_user uuid;
  v_family public.network_product_families%rowtype;
  v_line_id uuid;
  v_line_number int;
  v_standard_id uuid;
  v_grade_id uuid;
  v_quantity numeric;
  v_quantity_unit text;
  v_country text;
  v_requested_date date;
  v_manufacturing text;
  v_certification text;
  v_region text;
  v_notes text;
  v_od numeric;
  v_width numeric;
  v_height numeric;
  v_thickness numeric;
  v_length numeric;
begin
  if p_line is null or jsonb_typeof(p_line)<>'object' or pg_column_size(p_line)>16384 then
    raise exception 'marketplace request line payload must be a small JSON object' using errcode='22023';
  end if;

  select * into v_request
  from public.marketplace_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'marketplace request not found' using errcode='P0002';
  end if;

  v_user := private.p5_1_require_actor(v_request.organization_id,true);

  if v_request.status<>'draft' then
    raise exception 'lines can only be changed while request is draft' using errcode='22023';
  end if;

  select * into v_family
  from public.network_product_families
  where canonical_key=btrim(coalesce(p_line->>'product_family_key',''))
    and status='active'
    and searchable=true;

  if not found then
    raise exception 'active Marketplace product family not found' using errcode='P0002';
  end if;

  if nullif(btrim(coalesce(p_line->>'standard_id','')),'') is not null then
    v_standard_id := (p_line->>'standard_id')::uuid;

    if not exists(
      select 1
      from public.network_product_family_steel_mappings map
      join public.steel_standard_product_families spf
        on spf.product_family=map.steel_product_family
       and spf.standard_id=v_standard_id
      join public.steel_standards s
        on s.id=v_standard_id and s.status='active'
      where map.network_product_family_id=v_family.id
    ) then
      raise exception 'steel standard is not mapped to this Marketplace product family'
        using errcode='22023';
    end if;
  end if;

  if nullif(btrim(coalesce(p_line->>'material_grade_id','')),'') is not null then
    v_grade_id := (p_line->>'material_grade_id')::uuid;
    if v_standard_id is null then
      raise exception 'material grade requires a selected standard' using errcode='22023';
    end if;

    if not (
      exists(
        select 1
        from public.steel_standard_grade_applicability a
        where a.standard_id=v_standard_id
          and a.material_grade_id=v_grade_id
      )
      or exists(
        select 1
        from public.steel_standard_grades sg
        where sg.standard_id=v_standard_id
          and sg.material_grade_id=v_grade_id
      )
    ) then
      raise exception 'material grade is not canonically linked to selected standard'
        using errcode='22023';
    end if;
  end if;

  v_quantity := nullif(btrim(coalesce(p_line->>'quantity','')),'')::numeric;
  if v_quantity is null or v_quantity<=0 then
    raise exception 'quantity must be greater than zero' using errcode='22023';
  end if;

  v_quantity_unit := lower(btrim(coalesce(p_line->>'quantity_unit','')));
  if v_quantity_unit not in ('m','kg','t','pcs') then
    raise exception 'quantity unit must be m, kg, t or pcs' using errcode='22023';
  end if;

  v_country := upper(btrim(coalesce(p_line->>'delivery_country_code','')));
  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'delivery country must be a two-letter code' using errcode='22023';
  end if;

  v_requested_date := nullif(btrim(coalesce(p_line->>'requested_delivery_date','')),'')::date;
  if v_requested_date is not null and v_requested_date<current_date then
    raise exception 'requested delivery date cannot be in the past' using errcode='22023';
  end if;

  v_manufacturing := nullif(btrim(coalesce(p_line->>'manufacturing_process','')),'');
  v_certification := nullif(btrim(coalesce(p_line->>'certification','')),'');
  v_region := nullif(btrim(coalesce(p_line->>'delivery_region','')),'');
  v_notes := nullif(btrim(coalesce(p_line->>'notes','')),'');
  v_od := nullif(btrim(coalesce(p_line->>'outer_diameter_mm','')),'')::numeric;
  v_width := nullif(btrim(coalesce(p_line->>'width_mm','')),'')::numeric;
  v_height := nullif(btrim(coalesce(p_line->>'height_mm','')),'')::numeric;
  v_thickness := nullif(btrim(coalesce(p_line->>'thickness_mm','')),'')::numeric;
  v_length := nullif(btrim(coalesce(p_line->>'length_mm','')),'')::numeric;

  if coalesce(v_od,1)<=0 or coalesce(v_width,1)<=0 or coalesce(v_height,1)<=0
     or coalesce(v_thickness,1)<=0 or coalesce(v_length,1)<=0 then
    raise exception 'dimensions must be positive when provided' using errcode='22023';
  end if;

  select coalesce(max(line_number),0)+1 into v_line_number
  from public.marketplace_request_lines
  where request_id=p_request_id;

  if v_line_number>25 then
    raise exception 'marketplace request cannot exceed 25 lines' using errcode='22023';
  end if;

  insert into public.marketplace_request_lines(
    request_id,line_number,product_family_id,standard_id,material_grade_id,
    manufacturing_process,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,
    quantity,quantity_unit,certification,delivery_country_code,delivery_region,
    requested_delivery_date,notes
  )
  values(
    p_request_id,v_line_number,v_family.id,v_standard_id,v_grade_id,
    v_manufacturing,v_od,v_width,v_height,v_thickness,v_length,
    v_quantity,v_quantity_unit,v_certification,v_country,v_region,
    v_requested_date,v_notes
  )
  returning id into v_line_id;

  perform private.p5_1_record_event(
    p_request_id,'line_added',v_user,v_request.organization_id,
    jsonb_build_object(
      'line_id',v_line_id,
      'line_number',v_line_number,
      'product_family_key',v_family.canonical_key
    )
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'line_id',v_line_id,
    'line_number',v_line_number
  );
end;
$function$;

revoke all on function private.p5_1_add_line_impl(uuid,jsonb)
from public,anon;
grant execute on function private.p5_1_add_line_impl(uuid,jsonb)
to authenticated,service_role;

create or replace function public.p5_1_add_request_line(
  p_request_id uuid,
  p_line jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_1_add_line_impl(p_request_id,p_line);
$function$;

revoke all on function public.p5_1_add_request_line(uuid,jsonb)
from public,anon;
grant execute on function public.p5_1_add_request_line(uuid,jsonb)
to authenticated,service_role;

create or replace function private.p5_1_remove_line_impl(
  p_request_id uuid,
  p_line_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
  v_user uuid;
  v_line public.marketplace_request_lines%rowtype;
begin
  select * into v_request
  from public.marketplace_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'marketplace request not found' using errcode='P0002';
  end if;

  v_user := private.p5_1_require_actor(v_request.organization_id,true);

  if v_request.status<>'draft' then
    raise exception 'lines can only be changed while request is draft' using errcode='22023';
  end if;

  select * into v_line
  from public.marketplace_request_lines
  where id=p_line_id and request_id=p_request_id;

  if not found then
    raise exception 'marketplace request line not found' using errcode='P0002';
  end if;

  delete from public.marketplace_request_lines where id=v_line.id;

  perform private.p5_1_record_event(
    p_request_id,'line_removed',v_user,v_request.organization_id,
    jsonb_build_object('line_id',v_line.id,'line_number',v_line.line_number)
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'line_id',p_line_id,
    'removed',true
  );
end;
$function$;

revoke all on function private.p5_1_remove_line_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_1_remove_line_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_1_remove_request_line(
  p_request_id uuid,
  p_line_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_1_remove_line_impl(p_request_id,p_line_id);
$function$;

revoke all on function public.p5_1_remove_request_line(uuid,uuid)
from public,anon;
grant execute on function public.p5_1_remove_request_line(uuid,uuid)
to authenticated,service_role;

create or replace function private.p5_1_publish_request_impl(
  p_request_id uuid,
  p_closes_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
  v_user uuid;
  v_line_count int;
  v_now timestamptz := now();
begin
  select * into v_request
  from public.marketplace_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'marketplace request not found' using errcode='P0002';
  end if;

  v_user := private.p5_1_require_actor(v_request.organization_id,true);

  if v_request.status<>'draft' then
    raise exception 'only draft marketplace requests can be published' using errcode='22023';
  end if;

  select count(*)::int into v_line_count
  from public.marketplace_request_lines
  where request_id=p_request_id;

  if v_line_count<1 then
    raise exception 'marketplace request requires at least one product line' using errcode='22023';
  end if;

  if p_closes_at is null
     or p_closes_at<v_now+interval '1 hour'
     or p_closes_at>v_now+interval '30 days' then
    raise exception 'marketplace close time must be between 1 hour and 30 days from now'
      using errcode='22023';
  end if;

  update public.marketplace_requests
  set
    status='published',
    opens_at=v_now,
    closes_at=p_closes_at,
    published_at=v_now
  where id=p_request_id;

  perform private.p5_1_record_event(
    p_request_id,'published',v_user,v_request.organization_id,
    jsonb_build_object(
      'visibility_mode',v_request.visibility_mode,
      'line_count',v_line_count,
      'closes_at',p_closes_at
    )
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status','published',
    'opens_at',v_now,
    'closes_at',p_closes_at,
    'visibility_mode',v_request.visibility_mode,
    'line_count',v_line_count
  );
end;
$function$;

revoke all on function private.p5_1_publish_request_impl(uuid,timestamptz)
from public,anon;
grant execute on function private.p5_1_publish_request_impl(uuid,timestamptz)
to authenticated,service_role;

create or replace function public.p5_1_publish_request(
  p_request_id uuid,
  p_closes_at timestamptz
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_1_publish_request_impl(p_request_id,p_closes_at);
$function$;

revoke all on function public.p5_1_publish_request(uuid,timestamptz)
from public,anon;
grant execute on function public.p5_1_publish_request(uuid,timestamptz)
to authenticated,service_role;

create or replace function private.p5_1_withdraw_request_impl(
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
  v_user uuid;
begin
  select * into v_request
  from public.marketplace_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'marketplace request not found' using errcode='P0002';
  end if;

  v_user := private.p5_1_require_actor(v_request.organization_id,true);

  if v_request.status not in ('draft','published') then
    raise exception 'marketplace request cannot be withdrawn from current status'
      using errcode='22023';
  end if;

  update public.marketplace_requests
  set status='withdrawn',withdrawn_at=now()
  where id=p_request_id;

  perform private.p5_1_record_event(
    p_request_id,'withdrawn',v_user,v_request.organization_id,
    jsonb_build_object('previous_status',v_request.status)
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'previous_status',v_request.status,
    'status','withdrawn'
  );
end;
$function$;

revoke all on function private.p5_1_withdraw_request_impl(uuid)
from public,anon;
grant execute on function private.p5_1_withdraw_request_impl(uuid)
to authenticated,service_role;

create or replace function public.p5_1_withdraw_request(
  p_request_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_1_withdraw_request_impl(p_request_id);
$function$;

revoke all on function public.p5_1_withdraw_request(uuid)
from public,anon;
grant execute on function public.p5_1_withdraw_request(uuid)
to authenticated,service_role;

create or replace function private.p5_1_my_requests_impl(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_items jsonb;
begin
  perform private.p5_1_require_actor(p_organization_id,false);

  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id),'[]'::jsonb)
  into v_items
  from (
    select
      r.id,
      r.title,
      r.visibility_mode,
      r.status,
      r.opens_at,
      r.closes_at,
      r.published_at,
      r.withdrawn_at,
      r.created_at,
      r.updated_at,
      count(l.id)::int as line_count,
      case
        when r.status='published' and r.closes_at<=now() then 'closed'
        when r.status='published' and r.closes_at<=now()+interval '24 hours' then 'closing_soon'
        when r.status='published' then 'open'
        else r.status
      end as effective_status
    from public.marketplace_requests r
    left join public.marketplace_request_lines l on l.request_id=r.id
    where r.organization_id=p_organization_id
    group by r.id
  ) q;

  return jsonb_build_object(
    'contract','P5.1-my-requests-v1',
    'organization_id',p_organization_id,
    'items',v_items
  );
end;
$function$;

revoke all on function private.p5_1_my_requests_impl(uuid)
from public,anon;
grant execute on function private.p5_1_my_requests_impl(uuid)
to authenticated,service_role;

create or replace function public.p5_1_my_requests(
  p_organization_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_1_my_requests_impl(p_organization_id);
$function$;

revoke all on function public.p5_1_my_requests(uuid)
from public,anon;
grant execute on function public.p5_1_my_requests(uuid)
to authenticated,service_role;

create or replace function private.p5_1_my_request_impl(
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
  v_lines jsonb;
begin
  v_request := private.p5_1_require_request(p_request_id,false);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',l.id,
      'line_number',l.line_number,
      'product_family_id',l.product_family_id,
      'product_family_key',pf.canonical_key,
      'product_family_name',pf.display_name,
      'standard_id',l.standard_id,
      'standard_code',s.code,
      'standard_title',s.title,
      'material_grade_id',l.material_grade_id,
      'grade_designation',mg.designation,
      'material_number',mg.material_number,
      'manufacturing_process',l.manufacturing_process,
      'outer_diameter_mm',l.outer_diameter_mm,
      'width_mm',l.width_mm,
      'height_mm',l.height_mm,
      'thickness_mm',l.thickness_mm,
      'length_mm',l.length_mm,
      'quantity',l.quantity,
      'quantity_unit',l.quantity_unit,
      'certification',l.certification,
      'delivery_country_code',l.delivery_country_code,
      'delivery_region',l.delivery_region,
      'requested_delivery_date',l.requested_delivery_date,
      'notes',l.notes,
      'created_at',l.created_at
    )
    order by l.line_number
  ),'[]'::jsonb)
  into v_lines
  from public.marketplace_request_lines l
  join public.network_product_families pf on pf.id=l.product_family_id
  left join public.steel_standards s on s.id=l.standard_id
  left join public.steel_material_grades mg on mg.id=l.material_grade_id
  where l.request_id=p_request_id;

  return jsonb_build_object(
    'contract','P5.1-my-request-v1',
    'request',jsonb_build_object(
      'id',v_request.id,
      'organization_id',v_request.organization_id,
      'title',v_request.title,
      'visibility_mode',v_request.visibility_mode,
      'status',v_request.status,
      'opens_at',v_request.opens_at,
      'closes_at',v_request.closes_at,
      'published_at',v_request.published_at,
      'withdrawn_at',v_request.withdrawn_at,
      'created_at',v_request.created_at,
      'updated_at',v_request.updated_at,
      'effective_status',case
        when v_request.status='published' and v_request.closes_at<=now() then 'closed'
        when v_request.status='published' and v_request.closes_at<=now()+interval '24 hours' then 'closing_soon'
        when v_request.status='published' then 'open'
        else v_request.status
      end
    ),
    'lines',v_lines
  );
end;
$function$;

revoke all on function private.p5_1_my_request_impl(uuid)
from public,anon;
grant execute on function private.p5_1_my_request_impl(uuid)
to authenticated,service_role;

create or replace function public.p5_1_my_request(
  p_request_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_1_my_request_impl(p_request_id);
$function$;

revoke all on function public.p5_1_my_request(uuid)
from public,anon;
grant execute on function public.p5_1_my_request(uuid)
to authenticated,service_role;

create or replace function private.p5_1_listing_taxonomy_impl()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','P5.1-taxonomy-v1',
    'product_families',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',pf.id,
          'key',pf.canonical_key,
          'name',pf.display_name
        )
        order by pf.sort_order,pf.display_name
      )
      from public.network_product_families pf
      where pf.status='active' and pf.searchable=true
    ),'[]'::jsonb),
    'standards',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.code)
      from (
        select
          s.id,
          s.code,
          s.title,
          s.manufacturing_processes,
          coalesce(array_agg(distinct pf.canonical_key) filter (where pf.id is not null),'{}'::text[]) as product_family_keys
        from public.steel_standards s
        left join public.steel_standard_product_families spf on spf.standard_id=s.id
        left join public.network_product_family_steel_mappings map on map.steel_product_family=spf.product_family
        left join public.network_product_families pf on pf.id=map.network_product_family_id
        where s.status='active'
        group by s.id
      ) x
    ),'[]'::jsonb),
    'grades',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.standard_code,x.designation)
      from (
        select distinct
          s.id as standard_id,
          s.code as standard_code,
          mg.id as material_grade_id,
          mg.designation,
          mg.material_number
        from public.steel_standards s
        join (
          select standard_id,material_grade_id from public.steel_standard_grade_applicability
          union
          select standard_id,material_grade_id from public.steel_standard_grades
        ) sg on sg.standard_id=s.id
        join public.steel_material_grades mg on mg.id=sg.material_grade_id
        where s.status='active'
      ) x
    ),'[]'::jsonb)
  );
$function$;

revoke all on function private.p5_1_listing_taxonomy_impl()
from public,anon;
grant execute on function private.p5_1_listing_taxonomy_impl()
to authenticated,service_role;

create or replace function public.p5_1_listing_taxonomy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_1_listing_taxonomy_impl();
$function$;

revoke all on function public.p5_1_listing_taxonomy()
from public,anon;
grant execute on function public.p5_1_listing_taxonomy()
to authenticated,service_role;

comment on table public.marketplace_requests is
  'P5.1 explicit buyer-created Marketplace demand. Separate from private Commercial Memory RFQs; no automatic publication path exists.';
comment on table public.marketplace_request_lines is
  'P5.1 structured Marketplace demand lines using governed Network and Steel Knowledge taxonomy.';
comment on table public.marketplace_request_events is
  'P5.1 immutable Marketplace request lifecycle audit ledger.';
comment on function public.p5_1_my_requests(uuid) is
  'P5.1 buyer-organization private request list. P5.1 intentionally exposes no supplier feed.';
comment on function public.p5_1_listing_taxonomy() is
  'P5.1 governed product/standard/grade taxonomy for explicit demand creation.';
