alter table public.pilot_usage_events
  drop constraint pilot_usage_events_event_name_check;

alter table public.pilot_usage_events
  add constraint pilot_usage_events_event_name_check
  check (event_name in (
    'search_completed','product_viewed','company_viewed','price_history_viewed',
    'evidence_opened','review_viewed','correction_completed','upload_completed',
    'network_directory_viewed','network_profile_viewed',
    'network_saved_created','network_saved_removed',
    'network_follow_created','network_follow_removed',
    'network_activity_feed_opened','network_activity_item_opened',
    'network_inquiry_submitted','network_inquiry_state_changed'
  ));

create or replace function private.p1_record_pilot_usage_event_impl(
  p_organization_id uuid,
  p_event_name text,
  p_entity_type text,
  p_entity_id text,
  p_outcome text,
  p_result_count integer,
  p_duration_ms integer,
  p_metadata jsonb
)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_id bigint;
  v_safe_metadata jsonb := '{}'::jsonb;
begin
  if v_actor is null then
    raise exception using errcode='28000', message='authentication required';
  end if;
  if p_organization_id is null or not public.is_organization_member(p_organization_id,true) then
    raise exception using errcode='42501', message='active tenant membership required';
  end if;
  if p_event_name not in (
    'search_completed','product_viewed','company_viewed','price_history_viewed',
    'evidence_opened','review_viewed','correction_completed','upload_completed',
    'network_directory_viewed','network_profile_viewed',
    'network_saved_created','network_saved_removed',
    'network_follow_created','network_follow_removed',
    'network_activity_feed_opened','network_activity_item_opened',
    'network_inquiry_submitted','network_inquiry_state_changed'
  ) then
    raise exception using errcode='22023', message='unsupported pilot event';
  end if;
  if p_outcome not in ('success','empty','error') then
    raise exception using errcode='22023', message='invalid outcome';
  end if;

  v_safe_metadata := jsonb_strip_nulls(jsonb_build_object(
    'source', p_metadata->>'source',
    'surface', p_metadata->>'surface',
    'format', p_metadata->>'format'
  ));

  insert into public.pilot_usage_events(
    organization_id,actor_user_id,event_name,entity_type,entity_id,outcome,
    result_count,duration_ms,metadata
  ) values (
    p_organization_id,v_actor,p_event_name,
    nullif(left(coalesce(p_entity_type,''),40),''),
    nullif(left(coalesce(p_entity_id,''),120),''),
    p_outcome,p_result_count,p_duration_ms,v_safe_metadata
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create table public.network_interaction_pilot_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  started_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active','completed','cancelled')),
  label text not null default 'P4 Interaction pilot',
  protocol_version text not null default 'P4.8-v1',
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz null,
  created_at timestamptz not null default clock_timestamp(),
  constraint network_interaction_pilot_runs_end_check
    check (ended_at is null or ended_at >= started_at)
);

create unique index network_interaction_pilot_one_active_org_idx
  on public.network_interaction_pilot_runs(organization_id)
  where status='active';

create index network_interaction_pilot_org_started_idx
  on public.network_interaction_pilot_runs(organization_id,started_at desc);

alter table public.network_interaction_pilot_runs enable row level security;
revoke all on table public.network_interaction_pilot_runs from public,anon,authenticated;
grant select,insert,update,delete on table public.network_interaction_pilot_runs
  to service_role,postgres;

create or replace function private.p4_start_interaction_pilot_impl(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  v_run public.network_interaction_pilot_runs%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_admin(p_organization_id) then
    raise exception 'organization admin role required' using errcode='42501';
  end if;

  select * into v_run
  from public.network_interaction_pilot_runs
  where organization_id=p_organization_id and status='active'
  order by started_at desc
  limit 1;

  if v_run.id is null then
    insert into public.network_interaction_pilot_runs(
      organization_id,started_by,status,label,protocol_version
    )
    values(
      p_organization_id,v_user,'active',
      'P4 Interaction → P5 readiness pilot','P4.8-v1'
    )
    returning * into v_run;
  end if;

  return jsonb_build_object(
    'id',v_run.id,
    'organization_id',v_run.organization_id,
    'status',v_run.status,
    'label',v_run.label,
    'protocol_version',v_run.protocol_version,
    'started_at',v_run.started_at
  );
end;
$function$;

revoke all on function private.p4_start_interaction_pilot_impl(uuid) from public,anon;
grant execute on function private.p4_start_interaction_pilot_impl(uuid)
  to authenticated,service_role,postgres;

create or replace function public.p4_start_interaction_pilot(p_organization_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_start_interaction_pilot_impl(p_organization_id);
$function$;

revoke all on function public.p4_start_interaction_pilot(uuid) from public,anon;
grant execute on function public.p4_start_interaction_pilot(uuid)
  to authenticated,service_role,postgres;

create or replace function private.p4_active_interaction_pilot_impl(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  v_run public.network_interaction_pilot_runs%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active tenant membership required' using errcode='42501';
  end if;

  select * into v_run
  from public.network_interaction_pilot_runs
  where organization_id=p_organization_id and status='active'
  order by started_at desc
  limit 1;

  if v_run.id is null then return null; end if;

  return jsonb_build_object(
    'id',v_run.id,
    'organization_id',v_run.organization_id,
    'status',v_run.status,
    'label',v_run.label,
    'protocol_version',v_run.protocol_version,
    'started_at',v_run.started_at
  );
end;
$function$;

revoke all on function private.p4_active_interaction_pilot_impl(uuid) from public,anon;
grant execute on function private.p4_active_interaction_pilot_impl(uuid)
  to authenticated,service_role,postgres;

create or replace function public.p4_active_interaction_pilot(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p4_active_interaction_pilot_impl(p_organization_id);
$function$;

revoke all on function public.p4_active_interaction_pilot(uuid) from public,anon;
grant execute on function public.p4_active_interaction_pilot(uuid)
  to authenticated,service_role,postgres;

create or replace function private.p4_interaction_pilot_summary_impl(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  v_started_at timestamptz;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active tenant membership required' using errcode='42501';
  end if;

  select started_at into v_started_at
  from public.network_interaction_pilot_runs
  where organization_id=p_organization_id and status='active'
  order by started_at desc
  limit 1;

  if v_started_at is null then return null; end if;

  with usage as (
    select
      count(distinct occurred_at::date) filter (where event_name like 'network_%')::integer as active_days,
      count(*) filter (where event_name='network_directory_viewed')::integer as directory_views,
      count(*) filter (where event_name='network_profile_viewed')::integer as profile_views,
      count(*) filter (where event_name='network_saved_created')::integer as saves_created,
      count(*) filter (where event_name='network_saved_removed')::integer as saves_removed,
      count(*) filter (where event_name='network_follow_created')::integer as follows_created,
      count(*) filter (where event_name='network_follow_removed')::integer as follows_removed,
      count(*) filter (where event_name='network_activity_feed_opened')::integer as activity_feed_opens,
      count(*) filter (where event_name='network_activity_item_opened')::integer as activity_item_opens,
      count(distinct actor_user_id) filter (where event_name like 'network_%')::integer as active_users
    from public.pilot_usage_events
    where organization_id=p_organization_id and occurred_at>=v_started_at
  ),
  inquiry as (
    select
      count(*)::integer as inquiries_submitted,
      count(distinct recipient_organization_id)::integer as distinct_recipient_organizations
    from public.network_inquiries
    where sender_organization_id=p_organization_id and submitted_at>=v_started_at
  ),
  engaged as (
    select count(distinct e.inquiry_id)::integer as recipient_engaged_inquiries
    from public.network_inquiry_events e
    join public.network_inquiries i on i.id=e.inquiry_id
    where i.sender_organization_id=p_organization_id
      and i.submitted_at>=v_started_at
      and e.actor_organization_id=i.recipient_organization_id
      and e.event_type in ('read','responded','declined','closed')
  )
  select jsonb_build_object(
    'contract','P4.8-v1',
    'started_at',v_started_at,
    'generated_at',clock_timestamp(),
    'active_days',u.active_days,
    'active_users',u.active_users,
    'directory_views',u.directory_views,
    'profile_views',u.profile_views,
    'saves_created',u.saves_created,
    'saves_removed',u.saves_removed,
    'follows_created',u.follows_created,
    'follows_removed',u.follows_removed,
    'persistent_intent_signals',(u.saves_created+u.follows_created),
    'activity_feed_opens',u.activity_feed_opens,
    'activity_item_opens',u.activity_item_opens,
    'inquiries_submitted',i.inquiries_submitted,
    'distinct_recipient_organizations',i.distinct_recipient_organizations,
    'recipient_engaged_inquiries',e.recipient_engaged_inquiries
  )
  into v_result
  from usage u cross join inquiry i cross join engaged e;

  return v_result;
end;
$function$;

revoke all on function private.p4_interaction_pilot_summary_impl(uuid) from public,anon;
grant execute on function private.p4_interaction_pilot_summary_impl(uuid)
  to authenticated,service_role,postgres;

create or replace function public.p4_interaction_pilot_summary(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p4_interaction_pilot_summary_impl(p_organization_id);
$function$;

revoke all on function public.p4_interaction_pilot_summary(uuid) from public,anon;
grant execute on function public.p4_interaction_pilot_summary(uuid)
  to authenticated,service_role,postgres;

create or replace function private.p5_readiness_impl(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_summary jsonb;
  v_active_days integer;
  v_profile_views integer;
  v_persistent integer;
  v_inquiries integer;
  v_engaged integer;
  v_passed integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active tenant membership required' using errcode='42501';
  end if;

  v_summary := private.p4_interaction_pilot_summary_impl(p_organization_id);
  if v_summary is null then return null; end if;

  v_active_days := coalesce((v_summary->>'active_days')::integer,0);
  v_profile_views := coalesce((v_summary->>'profile_views')::integer,0);
  v_persistent := coalesce((v_summary->>'persistent_intent_signals')::integer,0);
  v_inquiries := coalesce((v_summary->>'inquiries_submitted')::integer,0);
  v_engaged := coalesce((v_summary->>'recipient_engaged_inquiries')::integer,0);

  v_passed :=
    (v_active_days>=3)::integer +
    (v_profile_views>=10)::integer +
    (v_persistent>=3)::integer +
    (v_inquiries>=2)::integer +
    (v_engaged>=1)::integer;

  return jsonb_build_object(
    'contract','P5-readiness-v1',
    'evidence_ready',(v_passed=5),
    'criteria_passed_count',v_passed,
    'criteria_total',5,
    'criteria',jsonb_build_object(
      'multi_day_use',jsonb_build_object('actual',v_active_days,'target',3,'passed',(v_active_days>=3)),
      'profile_discovery',jsonb_build_object('actual',v_profile_views,'target',10,'passed',(v_profile_views>=10)),
      'persistent_intent',jsonb_build_object('actual',v_persistent,'target',3,'passed',(v_persistent>=3)),
      'b2b_inquiries',jsonb_build_object('actual',v_inquiries,'target',2,'passed',(v_inquiries>=2)),
      'recipient_engagement',jsonb_build_object('actual',v_engaged,'target',1,'passed',(v_engaged>=1))
    ),
    'summary',v_summary,
    'interpretation','Evidence threshold only; P5 requires an explicit product decision.'
  );
end;
$function$;

revoke all on function private.p5_readiness_impl(uuid) from public,anon;
grant execute on function private.p5_readiness_impl(uuid)
  to authenticated,service_role,postgres;

create or replace function public.p5_readiness(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_readiness_impl(p_organization_id);
$function$;

revoke all on function public.p5_readiness(uuid) from public,anon;
grant execute on function public.p5_readiness(uuid)
  to authenticated,service_role,postgres;

comment on table public.network_interaction_pilot_runs is
  'P4.8 bounded Interaction pilot windows, independent from the P1 Commercial Memory pilot.';
comment on function public.p5_readiness(uuid) is
  'P4.8 evidence readiness for designing a first P5 RFQ pilot. This is not an automatic build/go decision.';
