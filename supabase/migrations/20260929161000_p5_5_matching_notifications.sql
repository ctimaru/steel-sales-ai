-- P5.5 — Matching & Notifications
-- Deterministic, explainable supplier matching over governed Network scope.
-- Matching never grants entitlement/unlock/response rights and never widens
-- the P5.2 anonymous buyer privacy boundary.

create table public.marketplace_matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_requests(id) on delete restrict,
  supplier_network_company_id uuid not null references public.network_companies(id) on delete restrict,
  supplier_organization_id uuid null references public.organizations(id) on delete restrict,
  match_score smallint not null,
  match_band text not null,
  matched_line_count integer not null,
  total_line_count integer not null,
  line_matches jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  algorithm_version text not null default 'P5.5-v1',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(request_id,supplier_network_company_id),
  constraint marketplace_matches_score_check
    check (match_score between 0 and 100),
  constraint marketplace_matches_band_check
    check (match_band in ('strong','good','broad')),
  constraint marketplace_matches_line_count_check
    check (
      matched_line_count>=1
      and total_line_count>=matched_line_count
    ),
  constraint marketplace_matches_line_matches_check
    check (
      jsonb_typeof(line_matches)='array'
      and pg_column_size(line_matches)<=65536
    ),
  constraint marketplace_matches_status_check
    check (status in ('active','stale','suppressed'))
);

create index marketplace_matches_request_idx
  on public.marketplace_matches(request_id,status,match_score desc,id);
create index marketplace_matches_supplier_company_idx
  on public.marketplace_matches(supplier_network_company_id,status,computed_at desc);
create index marketplace_matches_supplier_org_idx
  on public.marketplace_matches(supplier_organization_id,status,computed_at desc)
  where supplier_organization_id is not null;

alter table public.marketplace_matches enable row level security;
revoke all on table public.marketplace_matches from public,anon,authenticated;
grant select,insert,update on table public.marketplace_matches to service_role;

create trigger marketplace_matches_touch_updated_at
before update on public.marketplace_matches
for each row execute function private.p5_1_touch_updated_at();

create table public.marketplace_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_organization_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid not null references public.marketplace_requests(id) on delete restrict,
  match_id uuid not null references public.marketplace_matches(id) on delete restrict,
  notification_kind text not null default 'opportunity_match',
  status text not null default 'unread',
  first_read_at timestamptz null,
  dismissed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(recipient_organization_id,request_id,notification_kind),
  constraint marketplace_notifications_kind_check
    check (notification_kind in ('opportunity_match')),
  constraint marketplace_notifications_status_check
    check (status in ('unread','read','dismissed')),
  constraint marketplace_notifications_lifecycle_check
    check (
      (status='unread' and first_read_at is null and dismissed_at is null)
      or
      (status='read' and first_read_at is not null and dismissed_at is null)
      or
      (status='dismissed' and dismissed_at is not null)
    )
);

create index marketplace_notifications_recipient_idx
  on public.marketplace_notifications(
    recipient_organization_id,status,created_at desc,id
  );
create index marketplace_notifications_request_idx
  on public.marketplace_notifications(request_id,created_at desc);
create index marketplace_notifications_match_idx
  on public.marketplace_notifications(match_id);

alter table public.marketplace_notifications enable row level security;
revoke all on table public.marketplace_notifications from public,anon,authenticated;
grant select,insert,update on table public.marketplace_notifications to service_role;

create trigger marketplace_notifications_touch_updated_at
before update on public.marketplace_notifications
for each row execute function private.p5_1_touch_updated_at();

create table public.marketplace_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_sequence bigint generated always as identity,
  notification_id uuid not null references public.marketplace_notifications(id) on delete restrict,
  request_id uuid not null references public.marketplace_requests(id) on delete restrict,
  recipient_organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid null references auth.users(id) on delete restrict,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique(event_sequence),
  constraint marketplace_notification_events_type_check
    check (event_type in ('created','read','dismissed')),
  constraint marketplace_notification_events_metadata_check
    check (
      jsonb_typeof(metadata)='object'
      and pg_column_size(metadata)<=16384
    )
);

create index marketplace_notification_events_notification_idx
  on public.marketplace_notification_events(notification_id,event_sequence);
create index marketplace_notification_events_request_idx
  on public.marketplace_notification_events(request_id,event_sequence);
create index marketplace_notification_events_recipient_idx
  on public.marketplace_notification_events(recipient_organization_id,event_sequence);
create index marketplace_notification_events_actor_idx
  on public.marketplace_notification_events(actor_user_id,event_sequence)
  where actor_user_id is not null;

alter table public.marketplace_notification_events enable row level security;
revoke all on table public.marketplace_notification_events from public,anon,authenticated;
grant select,insert on table public.marketplace_notification_events to service_role;

create or replace function private.p5_5_notification_event_immutable()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'marketplace_notification_events is append-only'
    using errcode='55000';
end;
$function$;

revoke all on function private.p5_5_notification_event_immutable()
from public,anon,authenticated;

create trigger marketplace_notification_events_immutable
before update or delete on public.marketplace_notification_events
for each row execute function private.p5_5_notification_event_immutable();

create or replace function private.p5_5_record_notification_event(
  p_notification_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_notification public.marketplace_notifications%rowtype;
  v_id uuid;
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if jsonb_typeof(v_metadata)<>'object'
     or pg_column_size(v_metadata)>16384 then
    raise exception 'Marketplace notification event metadata must be a JSON object <= 16KB'
      using errcode='22023';
  end if;

  select * into v_notification
  from public.marketplace_notifications
  where id=p_notification_id;

  if not found then
    raise exception 'Marketplace notification not found' using errcode='P0002';
  end if;

  insert into public.marketplace_notification_events(
    notification_id,
    request_id,
    recipient_organization_id,
    actor_user_id,
    event_type,
    metadata
  )
  values(
    v_notification.id,
    v_notification.request_id,
    v_notification.recipient_organization_id,
    p_actor_user_id,
    p_event_type,
    v_metadata
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function private.p5_5_record_notification_event(uuid,text,uuid,jsonb)
from public,anon,authenticated;

create or replace function private.p5_5_dimension_signal(
  p_company_product_id uuid,
  p_dimension_type text,
  p_requested_value numeric
)
returns text
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_declared integer;
  v_match boolean;
begin
  if p_requested_value is null then
    return 'not_requested';
  end if;

  select
    count(*)::int,
    coalesce(bool_or(
      p_requested_value between d.min_mm and d.max_mm
    ),false)
  into v_declared,v_match
  from public.network_company_product_dimension_scopes d
  where d.company_product_id=p_company_product_id
    and d.dimension_type=p_dimension_type;

  if v_declared=0 then
    return 'unknown';
  end if;

  if v_match then
    return 'exact';
  end if;

  return 'mismatch';
end;
$function$;

revoke all on function private.p5_5_dimension_signal(uuid,text,numeric)
from public,anon,authenticated;

create or replace function private.p5_5_line_match_score(
  p_request_line_id uuid,
  p_company_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_line public.marketplace_request_lines%rowtype;
  v_company_product public.network_company_products%rowtype;
  v_company_verification text;
  v_product_key text;
  v_declared integer;
  v_exact integer;
  v_criteria integer := 0;
  v_exact_count integer := 0;
  v_unknown_count integer := 0;
  v_quality numeric := 0;
  v_score integer;
  v_band text;
  v_reasons jsonb := '[]'::jsonb;
  v_dimension_type text;
  v_requested_value numeric;
  v_dimension_signal text;
begin
  select * into v_line
  from public.marketplace_request_lines
  where id=p_request_line_id;

  if not found then
    return jsonb_build_object('eligible',false,'reason','request_line_not_found');
  end if;

  select cp.*,c.verification_status,pf.canonical_key
  into
    v_company_product.id,
    v_company_product.company_id,
    v_company_product.product_family_id,
    v_company_product.relationship_type,
    v_company_product.facility_id,
    v_company_product.source_assertion_id,
    v_company_product.created_at,
    v_company_verification,
    v_product_key
  from public.network_company_products cp
  join public.network_companies c on c.id=cp.company_id
  join public.network_product_families pf on pf.id=cp.product_family_id
  where cp.id=p_company_product_id
    and c.publication_status='published'
    and c.archived_at is null;

  if not found then
    return jsonb_build_object('eligible',false,'reason','supplier_product_not_found');
  end if;

  if v_company_product.product_family_id<>v_line.product_family_id then
    return jsonb_build_object(
      'eligible',false,
      'reason','product_family_mismatch'
    );
  end if;

  v_reasons := v_reasons || jsonb_build_array('product_family_exact');

  if v_line.standard_id is not null then
    v_criteria := v_criteria+1;

    select
      count(*)::int,
      count(*) filter(where s.standard_id=v_line.standard_id)::int
    into v_declared,v_exact
    from public.network_company_product_standard_scopes s
    where s.company_product_id=p_company_product_id;

    if v_declared=0 then
      v_quality := v_quality+0.35;
      v_unknown_count := v_unknown_count+1;
      v_reasons := v_reasons || jsonb_build_array('standard_unknown');
    elsif v_exact>0 then
      v_quality := v_quality+1;
      v_exact_count := v_exact_count+1;
      v_reasons := v_reasons || jsonb_build_array('standard_exact');
    else
      return jsonb_build_object(
        'eligible',false,
        'reason','standard_mismatch',
        'relationship_type',v_company_product.relationship_type,
        'product_family_key',v_product_key,
        'reason_codes',v_reasons || jsonb_build_array('standard_mismatch')
      );
    end if;
  end if;

  if v_line.material_grade_id is not null then
    v_criteria := v_criteria+1;

    select
      count(*)::int,
      count(*) filter(
        where g.material_grade_id=v_line.material_grade_id
          and (
            v_line.standard_id is null
            or g.standard_id=v_line.standard_id
          )
      )::int
    into v_declared,v_exact
    from public.network_company_product_grade_scopes g
    where g.company_product_id=p_company_product_id;

    if v_declared=0 then
      v_quality := v_quality+0.35;
      v_unknown_count := v_unknown_count+1;
      v_reasons := v_reasons || jsonb_build_array('grade_unknown');
    elsif v_exact>0 then
      v_quality := v_quality+1;
      v_exact_count := v_exact_count+1;
      v_reasons := v_reasons || jsonb_build_array('grade_exact');
    else
      return jsonb_build_object(
        'eligible',false,
        'reason','grade_mismatch',
        'relationship_type',v_company_product.relationship_type,
        'product_family_key',v_product_key,
        'reason_codes',v_reasons || jsonb_build_array('grade_mismatch')
      );
    end if;
  end if;

  for v_dimension_type,v_requested_value in
    select d.dimension_type,d.requested_value
    from (
      values
        ('outer_diameter'::text,v_line.outer_diameter_mm),
        ('width'::text,v_line.width_mm),
        ('height'::text,v_line.height_mm),
        ('wall_thickness'::text,v_line.thickness_mm),
        ('length'::text,v_line.length_mm)
    ) as d(dimension_type,requested_value)
  loop
    if v_requested_value is null then
      continue;
    end if;

    v_criteria := v_criteria+1;
    v_dimension_signal := private.p5_5_dimension_signal(
      p_company_product_id,
      v_dimension_type,
      v_requested_value
    );

    if v_dimension_signal='exact' then
      v_quality := v_quality+1;
      v_exact_count := v_exact_count+1;
      v_reasons := v_reasons || jsonb_build_array(
        'dimension_'||v_dimension_type||'_exact'
      );
    elsif v_dimension_signal='unknown' then
      v_quality := v_quality+0.35;
      v_unknown_count := v_unknown_count+1;
      v_reasons := v_reasons || jsonb_build_array(
        'dimension_'||v_dimension_type||'_unknown'
      );
    else
      return jsonb_build_object(
        'eligible',false,
        'reason','dimension_mismatch',
        'relationship_type',v_company_product.relationship_type,
        'product_family_key',v_product_key,
        'dimension_type',v_dimension_type,
        'reason_codes',v_reasons || jsonb_build_array(
          'dimension_'||v_dimension_type||'_mismatch'
        )
      );
    end if;
  end loop;

  v_score := 50 + round(
    40 * case
      when v_criteria=0 then 0.50
      else v_quality/v_criteria
    end
  )::int;

  if v_company_verification='verified' then
    v_score := least(v_score+5,100);
    v_reasons := v_reasons || jsonb_build_array('company_verified');
  end if;

  v_band := case
    when v_score>=85 then 'strong'
    when v_score>=70 then 'good'
    else 'broad'
  end;

  return jsonb_build_object(
    'eligible',true,
    'score',v_score,
    'band',v_band,
    'relationship_type',v_company_product.relationship_type,
    'product_family_key',v_product_key,
    'criteria_count',v_criteria,
    'exact_count',v_exact_count,
    'unknown_count',v_unknown_count,
    'reason_codes',v_reasons
  );
end;
$function$;

revoke all on function private.p5_5_line_match_score(uuid,uuid)
from public,anon,authenticated;

create or replace function private.p5_5_compute_request_matches(
  p_request_id uuid
)
returns table(
  supplier_network_company_id uuid,
  match_score integer,
  match_band text,
  matched_line_count integer,
  total_line_count integer,
  line_matches jsonb
)
language sql
stable
security definer
set search_path=''
as $function$
with request_meta as (
  select
    r.id,
    r.organization_id as buyer_organization_id,
    count(l.id)::int as total_line_count
  from public.marketplace_requests r
  join public.marketplace_request_lines l on l.request_id=r.id
  where r.id=p_request_id
  group by r.id
),
candidates as (
  select
    cp.company_id as supplier_network_company_id,
    cp.id as company_product_id,
    cp.relationship_type,
    l.id as request_line_id,
    l.line_number,
    private.p5_5_line_match_score(l.id,cp.id) as match_result
  from request_meta rm
  join public.marketplace_request_lines l on l.request_id=rm.id
  join public.network_company_products cp
    on cp.product_family_id=l.product_family_id
  join public.network_companies c
    on c.id=cp.company_id
   and c.publication_status='published'
   and c.archived_at is null
  where not exists(
    select 1
    from public.organization_network_company_links own
    where own.organization_id=rm.buyer_organization_id
      and own.network_company_id=cp.company_id
      and own.link_status='active'
  )
),
eligible as (
  select *
  from candidates
  where coalesce((match_result->>'eligible')::boolean,false)
),
ranked as (
  select
    e.*,
    row_number() over(
      partition by e.supplier_network_company_id,e.request_line_id
      order by
        (e.match_result->>'score')::integer desc,
        e.company_product_id
    ) as rn
  from eligible e
),
best as (
  select *
  from ranked
  where rn=1
),
aggregated as (
  select
    b.supplier_network_company_id,
    count(*)::int as matched_line_count,
    rm.total_line_count,
    avg((b.match_result->>'score')::numeric) as average_line_score,
    jsonb_agg(
      jsonb_build_object(
        'request_line_id',b.request_line_id,
        'line_number',b.line_number,
        'company_product_id',b.company_product_id,
        'relationship_type',b.relationship_type,
        'line_score',(b.match_result->>'score')::integer,
        'line_band',b.match_result->>'band',
        'criteria_count',(b.match_result->>'criteria_count')::integer,
        'exact_count',(b.match_result->>'exact_count')::integer,
        'unknown_count',(b.match_result->>'unknown_count')::integer,
        'reason_codes',b.match_result->'reason_codes'
      )
      order by b.line_number,b.company_product_id
    ) as line_matches
  from best b
  cross join request_meta rm
  group by b.supplier_network_company_id,rm.total_line_count
),
scored as (
  select
    a.*,
    least(100,greatest(0,round(
      a.average_line_score * (
        0.80 + 0.20 * (
          a.matched_line_count::numeric
          / greatest(a.total_line_count,1)::numeric
        )
      )
    )::integer)) as score
  from aggregated a
)
select
  s.supplier_network_company_id,
  s.score as match_score,
  case
    when s.score>=85 then 'strong'
    when s.score>=70 then 'good'
    else 'broad'
  end as match_band,
  s.matched_line_count,
  s.total_line_count,
  s.line_matches
from scored s
where s.score>=55
order by s.score desc,s.supplier_network_company_id;
$function$;

revoke all on function private.p5_5_compute_request_matches(uuid)
from public,anon,authenticated;

create or replace function private.p5_5_refresh_request_matches_impl(
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
  v_match_count integer := 0;
  v_contactable_count integer := 0;
  v_notifications_created integer := 0;
begin
  select * into v_request
  from public.marketplace_requests
  where id=p_request_id;

  if not found then
    raise exception 'Marketplace request not found' using errcode='P0002';
  end if;

  if v_request.status<>'published'
     or v_request.opens_at>now()
     or v_request.closes_at<=now() then
    update public.marketplace_matches
    set
      status='stale',
      computed_at=now()
    where request_id=p_request_id
      and status='active';

    return jsonb_build_object(
      'contract','P5.5-match-refresh-v1',
      'request_id',p_request_id,
      'state','not_open',
      'active_matches',0,
      'contactable_matches',0,
      'notifications_created',0
    );
  end if;

  update public.marketplace_matches m
  set
    status='stale',
    computed_at=now()
  where m.request_id=p_request_id
    and m.status='active'
    and not exists(
      select 1
      from private.p5_5_compute_request_matches(p_request_id) c
      where c.supplier_network_company_id=m.supplier_network_company_id
    );

  insert into public.marketplace_matches(
    request_id,
    supplier_network_company_id,
    supplier_organization_id,
    match_score,
    match_band,
    matched_line_count,
    total_line_count,
    line_matches,
    status,
    algorithm_version,
    computed_at
  )
  select
    p_request_id,
    c.supplier_network_company_id,
    (
      select l.organization_id
      from public.organization_network_company_links l
      where l.network_company_id=c.supplier_network_company_id
        and l.link_status='active'
        and l.organization_id<>v_request.organization_id
      order by l.linked_at desc nulls last,l.id
      limit 1
    ),
    c.match_score,
    c.match_band,
    c.matched_line_count,
    c.total_line_count,
    c.line_matches,
    'active',
    'P5.5-v1',
    now()
  from private.p5_5_compute_request_matches(p_request_id) c
  on conflict(request_id,supplier_network_company_id)
  do update set
    supplier_organization_id=excluded.supplier_organization_id,
    match_score=excluded.match_score,
    match_band=excluded.match_band,
    matched_line_count=excluded.matched_line_count,
    total_line_count=excluded.total_line_count,
    line_matches=excluded.line_matches,
    status='active',
    algorithm_version=excluded.algorithm_version,
    computed_at=excluded.computed_at;

  select
    count(*)::int,
    count(*) filter(where supplier_organization_id is not null)::int
  into v_match_count,v_contactable_count
  from public.marketplace_matches
  where request_id=p_request_id
    and status='active';

  insert into public.marketplace_notifications(
    recipient_organization_id,
    request_id,
    match_id,
    notification_kind,
    status
  )
  select
    m.supplier_organization_id,
    m.request_id,
    m.id,
    'opportunity_match',
    'unread'
  from public.marketplace_matches m
  where m.request_id=p_request_id
    and m.status='active'
    and m.supplier_organization_id is not null
    and m.supplier_organization_id<>v_request.organization_id
    and m.match_score>=60
  on conflict(recipient_organization_id,request_id,notification_kind)
  do nothing;

  get diagnostics v_notifications_created = row_count;

  insert into public.marketplace_notification_events(
    notification_id,
    request_id,
    recipient_organization_id,
    actor_user_id,
    event_type,
    metadata
  )
  select
    n.id,
    n.request_id,
    n.recipient_organization_id,
    null,
    'created',
    jsonb_build_object(
      'source','matching_engine',
      'algorithm_version',m.algorithm_version,
      'match_score',m.match_score,
      'match_band',m.match_band
    )
  from public.marketplace_notifications n
  join public.marketplace_matches m on m.id=n.match_id
  where n.request_id=p_request_id
    and not exists(
      select 1
      from public.marketplace_notification_events e
      where e.notification_id=n.id
        and e.event_type='created'
    );

  return jsonb_build_object(
    'contract','P5.5-match-refresh-v1',
    'request_id',p_request_id,
    'state','refreshed',
    'active_matches',v_match_count,
    'contactable_matches',v_contactable_count,
    'notifications_created',v_notifications_created,
    'algorithm_version','P5.5-v1'
  );
end;
$function$;

revoke all on function private.p5_5_refresh_request_matches_impl(uuid)
from public,anon,authenticated;

create or replace function private.p5_5_on_request_status_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.status='published'
     and old.status is distinct from new.status then
    perform private.p5_5_refresh_request_matches_impl(new.id);
  elsif old.status='published'
        and new.status<>'published' then
    update public.marketplace_matches
    set
      status='stale',
      computed_at=now()
    where request_id=new.id
      and status='active';
  end if;

  return new;
end;
$function$;

revoke all on function private.p5_5_on_request_status_change()
from public,anon,authenticated;

create trigger marketplace_requests_p5_5_match_status
after update of status on public.marketplace_requests
for each row execute function private.p5_5_on_request_status_change();

create or replace function private.p5_5_sync_company_linkage(
  p_network_company_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_request public.marketplace_requests%rowtype;
begin
  update public.marketplace_matches m
  set supplier_organization_id=(
    select l.organization_id
    from public.organization_network_company_links l
    join public.marketplace_requests r on r.id=m.request_id
    where l.network_company_id=p_network_company_id
      and l.link_status='active'
      and l.organization_id<>r.organization_id
    order by l.linked_at desc nulls last,l.id
    limit 1
  )
  where m.supplier_network_company_id=p_network_company_id
    and m.status='active';

  insert into public.marketplace_notifications(
    recipient_organization_id,
    request_id,
    match_id,
    notification_kind,
    status
  )
  select
    m.supplier_organization_id,
    m.request_id,
    m.id,
    'opportunity_match',
    'unread'
  from public.marketplace_matches m
  join public.marketplace_requests r on r.id=m.request_id
  where m.supplier_network_company_id=p_network_company_id
    and m.status='active'
    and m.supplier_organization_id is not null
    and m.match_score>=60
    and r.status='published'
    and r.opens_at<=now()
    and r.closes_at>now()
  on conflict(recipient_organization_id,request_id,notification_kind)
  do nothing;

  insert into public.marketplace_notification_events(
    notification_id,
    request_id,
    recipient_organization_id,
    actor_user_id,
    event_type,
    metadata
  )
  select
    n.id,
    n.request_id,
    n.recipient_organization_id,
    null,
    'created',
    jsonb_build_object(
      'source','company_link_activation',
      'algorithm_version',m.algorithm_version,
      'match_score',m.match_score,
      'match_band',m.match_band
    )
  from public.marketplace_notifications n
  join public.marketplace_matches m on m.id=n.match_id
  where m.supplier_network_company_id=p_network_company_id
    and not exists(
      select 1
      from public.marketplace_notification_events e
      where e.notification_id=n.id
        and e.event_type='created'
    );
end;
$function$;

revoke all on function private.p5_5_sync_company_linkage(uuid)
from public,anon,authenticated;

create or replace function private.p5_5_on_company_link_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_company_id uuid;
begin
  v_company_id := case
    when tg_op='DELETE' then old.network_company_id
    else new.network_company_id
  end;

  perform private.p5_5_sync_company_linkage(v_company_id);

  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function private.p5_5_on_company_link_change()
from public,anon,authenticated;

create trigger organization_network_company_links_p5_5_sync
after insert or update of link_status or delete
on public.organization_network_company_links
for each row execute function private.p5_5_on_company_link_change();

create or replace function private.p5_5_require_match_authority()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select private.p5_3_require_entitlement_authority();
$function$;

revoke all on function private.p5_5_require_match_authority()
from public,anon;
grant execute on function private.p5_5_require_match_authority()
to authenticated,service_role;

create or replace function public.p5_5_refresh_request_matches(
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path=''
as $function$
begin
  perform private.p5_5_require_match_authority();
  return private.p5_5_refresh_request_matches_impl(p_request_id);
end;
$function$;

revoke all on function public.p5_5_refresh_request_matches(uuid)
from public,anon;
grant execute on function public.p5_5_refresh_request_matches(uuid)
to authenticated,service_role;

create or replace function private.p5_5_sanitized_line_matches(
  p_line_matches jsonb
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'line_number',(x.item->>'line_number')::integer,
      'score',(x.item->>'line_score')::integer,
      'band',x.item->>'line_band',
      'relationship_type',x.item->>'relationship_type',
      'criteria_count',(x.item->>'criteria_count')::integer,
      'exact_count',(x.item->>'exact_count')::integer,
      'unknown_count',(x.item->>'unknown_count')::integer,
      'reason_codes',coalesce(x.item->'reason_codes','[]'::jsonb)
    )
    order by (x.item->>'line_number')::integer
  ),'[]'::jsonb)
  from jsonb_array_elements(coalesce(p_line_matches,'[]'::jsonb)) x(item);
$function$;

revoke all on function private.p5_5_sanitized_line_matches(jsonb)
from public,anon,authenticated;

create or replace function private.p5_5_my_notifications_impl(
  p_recipient_organization_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
  v_offset integer;
  v_items jsonb;
  v_total integer;
  v_unread integer;
begin
  perform private.p5_1_require_actor(p_recipient_organization_id,false);

  v_limit := least(greatest(coalesce(p_limit,50),1),100);
  v_offset := greatest(coalesce(p_offset,0),0);

  with base as (
    select
      n.id as notification_id,
      n.status as notification_status,
      n.created_at as notification_created_at,
      m.id as match_id,
      m.request_id,
      m.match_score,
      m.match_band,
      m.matched_line_count,
      m.total_line_count,
      m.line_matches,
      m.algorithm_version,
      r.closes_at,
      resp.status as response_status
    from public.marketplace_notifications n
    join public.marketplace_matches m
      on m.id=n.match_id
     and m.status='active'
     and m.supplier_organization_id=p_recipient_organization_id
    join public.marketplace_requests r
      on r.id=n.request_id
     and r.status='published'
     and r.opens_at<=now()
     and r.closes_at>now()
     and r.organization_id<>p_recipient_organization_id
    left join public.marketplace_responses resp
      on resp.request_id=r.id
     and resp.supplier_organization_id=p_recipient_organization_id
    where n.recipient_organization_id=p_recipient_organization_id
      and n.status in ('unread','read')
  ),
  counts as (
    select
      count(*)::int as total,
      count(*) filter(where notification_status='unread')::int as unread
    from base
  ),
  paged as (
    select *
    from base
    order by
      case when notification_status='unread' then 0 else 1 end,
      match_score desc,
      notification_created_at desc,
      notification_id
    limit v_limit offset v_offset
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'notification_id',p.notification_id,
        'status',p.notification_status,
        'created_at',p.notification_created_at,
        'request_id',p.request_id,
        'closes_at',p.closes_at,
        'match',jsonb_build_object(
          'match_id',p.match_id,
          'score',p.match_score,
          'band',p.match_band,
          'matched_line_count',p.matched_line_count,
          'total_line_count',p.total_line_count,
          'algorithm_version',p.algorithm_version,
          'lines',private.p5_5_sanitized_line_matches(p.line_matches)
        ),
        'teaser',private.p5_2_teaser_item_impl(p.request_id),
        'response_status',p.response_status
      )
      order by
        case when p.notification_status='unread' then 0 else 1 end,
        p.match_score desc,
        p.notification_created_at desc,
        p.notification_id
    ),'[]'::jsonb),
    (select total from counts),
    (select unread from counts)
  into v_items,v_total,v_unread
  from paged p;

  return jsonb_build_object(
    'contract','P5.5-notifications-v1',
    'generated_at',now(),
    'items',coalesce(v_items,'[]'::jsonb),
    'total',coalesce(v_total,0),
    'unread',coalesce(v_unread,0),
    'limit',v_limit,
    'offset',v_offset
  );
end;
$function$;

revoke all on function private.p5_5_my_notifications_impl(uuid,integer,integer)
from public,anon;
grant execute on function private.p5_5_my_notifications_impl(uuid,integer,integer)
to authenticated,service_role;

create or replace function public.p5_5_my_notifications(
  p_recipient_organization_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_5_my_notifications_impl(
    p_recipient_organization_id,
    p_limit,
    p_offset
  );
$function$;

revoke all on function public.p5_5_my_notifications(uuid,integer,integer)
from public,anon;
grant execute on function public.p5_5_my_notifications(uuid,integer,integer)
to authenticated,service_role;

create or replace function private.p5_5_notification_action_impl(
  p_recipient_organization_id uuid,
  p_notification_id uuid,
  p_action text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_notification public.marketplace_notifications%rowtype;
  v_action text := lower(btrim(coalesce(p_action,'')));
  v_changed boolean := false;
begin
  v_user := private.p5_1_require_actor(
    p_recipient_organization_id,false
  );

  select * into v_notification
  from public.marketplace_notifications
  where id=p_notification_id
    and recipient_organization_id=p_recipient_organization_id
  for update;

  if not found then
    raise exception 'Marketplace notification not found' using errcode='P0002';
  end if;

  if v_action='read' then
    if v_notification.status='dismissed' then
      raise exception 'Dismissed Marketplace notification cannot be marked read'
        using errcode='22023';
    end if;

    if v_notification.status='unread' then
      update public.marketplace_notifications
      set
        status='read',
        first_read_at=now()
      where id=p_notification_id
      returning * into v_notification;
      v_changed := true;

      perform private.p5_5_record_notification_event(
        p_notification_id,
        'read',
        v_user,
        '{}'::jsonb
      );
    end if;

  elsif v_action='dismiss' then
    if v_notification.status<>'dismissed' then
      update public.marketplace_notifications
      set
        status='dismissed',
        dismissed_at=now()
      where id=p_notification_id
      returning * into v_notification;
      v_changed := true;

      perform private.p5_5_record_notification_event(
        p_notification_id,
        'dismissed',
        v_user,
        '{}'::jsonb
      );
    end if;
  else
    raise exception 'Unsupported Marketplace notification action'
      using errcode='22023';
  end if;

  return jsonb_build_object(
    'notification_id',v_notification.id,
    'status',v_notification.status,
    'changed',v_changed,
    'request_id',v_notification.request_id
  );
end;
$function$;

revoke all on function private.p5_5_notification_action_impl(uuid,uuid,text)
from public,anon;
grant execute on function private.p5_5_notification_action_impl(uuid,uuid,text)
to authenticated,service_role;

create or replace function public.p5_5_notification_action(
  p_recipient_organization_id uuid,
  p_notification_id uuid,
  p_action text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_5_notification_action_impl(
    p_recipient_organization_id,
    p_notification_id,
    p_action
  );
$function$;

revoke all on function public.p5_5_notification_action(uuid,uuid,text)
from public,anon;
grant execute on function public.p5_5_notification_action(uuid,uuid,text)
to authenticated,service_role;

create or replace function private.p5_5_buyer_match_summary_impl(
  p_buyer_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_total integer;
  v_contactable integer;
  v_notified integer;
  v_strong integer;
  v_good integer;
  v_broad integer;
begin
  perform private.p5_1_require_actor(p_buyer_organization_id,false);

  if not exists(
    select 1
    from public.marketplace_requests r
    where r.id=p_request_id
      and r.organization_id=p_buyer_organization_id
  ) then
    raise exception 'Marketplace buyer request not found' using errcode='P0002';
  end if;

  select
    count(*)::int,
    count(*) filter(where m.supplier_organization_id is not null)::int,
    count(*) filter(where m.match_band='strong')::int,
    count(*) filter(where m.match_band='good')::int,
    count(*) filter(where m.match_band='broad')::int
  into v_total,v_contactable,v_strong,v_good,v_broad
  from public.marketplace_matches m
  where m.request_id=p_request_id
    and m.status='active';

  select count(*)::int into v_notified
  from public.marketplace_notifications n
  where n.request_id=p_request_id
    and n.notification_kind='opportunity_match';

  return jsonb_build_object(
    'contract','P5.5-buyer-match-summary-v1',
    'request_id',p_request_id,
    'algorithm_version','P5.5-v1',
    'total_matches',coalesce(v_total,0),
    'contactable_matches',coalesce(v_contactable,0),
    'notifications_created',coalesce(v_notified,0),
    'bands',jsonb_build_object(
      'strong',coalesce(v_strong,0),
      'good',coalesce(v_good,0),
      'broad',coalesce(v_broad,0)
    )
  );
end;
$function$;

revoke all on function private.p5_5_buyer_match_summary_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_5_buyer_match_summary_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_5_buyer_match_summary(
  p_buyer_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_5_buyer_match_summary_impl(
    p_buyer_organization_id,p_request_id
  );
$function$;

revoke all on function public.p5_5_buyer_match_summary(uuid,uuid)
from public,anon;
grant execute on function public.p5_5_buyer_match_summary(uuid,uuid)
to authenticated,service_role;

-- Backfill currently open Marketplace demand through the deterministic matcher.
do $p55_backfill$
declare
  v_request record;
begin
  for v_request in
    select id
    from public.marketplace_requests
    where status='published'
      and opens_at<=now()
      and closes_at>now()
  loop
    perform private.p5_5_refresh_request_matches_impl(v_request.id);
  end loop;
end;
$p55_backfill$;

comment on table public.marketplace_matches is
  'P5.5 deterministic explainable Marketplace supplier matches. Candidate identity may exist without an active supplier organization; no entitlement or response right is implied.';
comment on table public.marketplace_notifications is
  'P5.5 organization-scoped in-app opportunity notifications materialized only for active linked supplier organizations.';
comment on table public.marketplace_notification_events is
  'P5.5 append-only notification lifecycle audit ledger.';
comment on function public.p5_5_my_notifications(uuid,integer,integer) is
  'P5.5 privacy-safe supplier notification inbox. Anonymous buyer identity remains governed by the P5.2 teaser contract.';
comment on function public.p5_5_buyer_match_summary(uuid,uuid) is
  'P5.5 buyer-owned aggregate match summary. Supplier identities are intentionally not exposed by this RPC.';
comment on function public.p5_5_refresh_request_matches(uuid) is
  'P5.5 privileged deterministic match refresh for service-role or Platform superadmin operations.';
