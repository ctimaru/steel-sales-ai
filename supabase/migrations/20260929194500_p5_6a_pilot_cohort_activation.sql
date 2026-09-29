-- P5.6A — Pilot Cohort & Activation
--
-- Controlled real-company cohort foundation for the Marketplace commercial pilot.
-- No synthetic usage, no automatic Company claim/verification, and no automatic
-- opportunity unlock. Supplier activation may grant only the existing P5.3
-- organization-wide pilot marketplace_access entitlement.

create table public.marketplace_pilot_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active'
    check (status in ('active','completed','cancelled')),
  label text not null default 'P5.6 Commercial Pilot',
  protocol_version text not null default 'P5.6-v1',
  started_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default clock_timestamp(),
  planned_ends_at timestamptz not null,
  ended_at timestamptz null,
  created_at timestamptz not null default clock_timestamp(),
  constraint marketplace_pilot_runs_label_check
    check (char_length(btrim(label)) between 3 and 120),
  constraint marketplace_pilot_runs_window_check
    check (planned_ends_at > started_at),
  constraint marketplace_pilot_runs_lifecycle_check
    check (
      (status='active' and ended_at is null)
      or
      (status in ('completed','cancelled') and ended_at is not null)
    )
);

create unique index marketplace_pilot_one_active_run_idx
  on public.marketplace_pilot_runs ((status))
  where status='active';

create index marketplace_pilot_runs_started_idx
  on public.marketplace_pilot_runs (started_at desc);

create table public.marketplace_pilot_participants (
  id uuid primary key default gen_random_uuid(),
  pilot_run_id uuid not null references public.marketplace_pilot_runs(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  network_company_id uuid null references public.network_companies(id) on delete restrict,
  participant_role text not null
    check (participant_role in ('buyer','supplier','both')),
  status text not null default 'candidate'
    check (status in ('candidate','active','paused','completed','removed')),
  activation_cycle integer not null default 0
    check (activation_cycle >= 0),
  added_by uuid not null references auth.users(id) on delete restrict,
  added_at timestamptz not null default clock_timestamp(),
  activated_at timestamptz null,
  paused_at timestamptz null,
  completed_at timestamptz null,
  removed_at timestamptz null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint marketplace_pilot_participants_run_org_uq
    unique (pilot_run_id,organization_id)
);

create index marketplace_pilot_participants_status_idx
  on public.marketplace_pilot_participants (pilot_run_id,status,participant_role);

create index marketplace_pilot_participants_org_idx
  on public.marketplace_pilot_participants (organization_id,added_at desc);

create table public.marketplace_pilot_participant_events (
  event_sequence bigint generated always as identity primary key,
  participant_id uuid not null references public.marketplace_pilot_participants(id) on delete restrict,
  pilot_run_id uuid not null references public.marketplace_pilot_runs(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null
    check (event_type in ('candidate_added','role_updated','activated','paused','resumed','completed','removed')),
  from_status text null,
  to_status text null,
  participant_role text not null
    check (participant_role in ('buyer','supplier','both')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint marketplace_pilot_participant_events_metadata_check
    check (jsonb_typeof(metadata)='object' and pg_column_size(metadata)<=16384)
);

create index marketplace_pilot_participant_events_participant_idx
  on public.marketplace_pilot_participant_events (participant_id,event_sequence);

create index marketplace_pilot_participant_events_run_idx
  on public.marketplace_pilot_participant_events (pilot_run_id,event_sequence);

alter table public.marketplace_pilot_runs enable row level security;
alter table public.marketplace_pilot_participants enable row level security;
alter table public.marketplace_pilot_participant_events enable row level security;

revoke all on table public.marketplace_pilot_runs from public,anon,authenticated;
revoke all on table public.marketplace_pilot_participants from public,anon,authenticated;
revoke all on table public.marketplace_pilot_participant_events from public,anon,authenticated;

grant select,insert,update on table public.marketplace_pilot_runs to service_role,postgres;
grant select,insert,update on table public.marketplace_pilot_participants to service_role,postgres;
grant select,insert on table public.marketplace_pilot_participant_events to service_role,postgres;
grant usage,select on sequence public.marketplace_pilot_participant_events_event_sequence_seq to service_role,postgres;

create or replace function private.p5_6a_reject_event_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  raise exception 'P5.6 participant event ledger is append-only'
    using errcode='42501';
end;
$function$;

revoke all on function private.p5_6a_reject_event_mutation()
from public,anon,authenticated;

create trigger marketplace_pilot_participant_events_append_only
before update or delete on public.marketplace_pilot_participant_events
for each row execute function private.p5_6a_reject_event_mutation();

create or replace function private.p5_6a_require_owner()
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Authenticated Platform Owner required'
      using errcode='42501';
  end if;

  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner authority required for P5.6 pilot control'
      using errcode='42501';
  end if;

  return v_user;
end;
$function$;

revoke all on function private.p5_6a_require_owner()
from public,anon;
grant execute on function private.p5_6a_require_owner()
to authenticated,service_role;

create or replace function private.p5_6a_readiness_impl(
  p_organization_id uuid,
  p_participant_role text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_role text := lower(btrim(coalesce(p_participant_role,'')));
  v_org public.organizations%rowtype;
  v_active_members integer := 0;
  v_network_company_id uuid;
  v_network_name text;
  v_publication_status text;
  v_claimed_status text;
  v_verification_status text;
  v_supplier_products integer := 0;
  v_technical_products integer := 0;
  v_blockers text[] := '{}'::text[];
  v_ready boolean;
begin
  if v_role not in ('buyer','supplier','both') then
    raise exception 'Invalid pilot participant role'
      using errcode='22023';
  end if;

  select * into v_org
  from public.organizations o
  where o.id=p_organization_id;

  if not found then
    raise exception 'Organization not found'
      using errcode='P0002';
  end if;

  select count(*)::integer
    into v_active_members
  from public.organization_memberships m
  where m.organization_id=p_organization_id
    and m.status='active';

  select
    l.network_company_id,
    coalesce(nc.trading_name,nc.legal_name),
    nc.publication_status,
    nc.claimed_status,
    nc.verification_status
  into
    v_network_company_id,
    v_network_name,
    v_publication_status,
    v_claimed_status,
    v_verification_status
  from public.organization_network_company_links l
  join public.network_companies nc on nc.id=l.network_company_id
  where l.organization_id=p_organization_id
    and l.link_status='active'
  order by l.linked_at desc
  limit 1;

  if v_network_company_id is not null then
    select count(*)::integer
      into v_supplier_products
    from public.network_company_products cp
    where cp.company_id=v_network_company_id
      and cp.relationship_type in ('produces','distributes','stocks','processes');

    select count(distinct cp.id)::integer
      into v_technical_products
    from public.network_company_products cp
    where cp.company_id=v_network_company_id
      and cp.relationship_type in ('produces','distributes','stocks','processes')
      and (
        exists (
          select 1
          from public.network_company_product_standard_scopes s
          where s.company_product_id=cp.id
        )
        or exists (
          select 1
          from public.network_company_product_grade_scopes g
          where g.company_product_id=cp.id
        )
        or exists (
          select 1
          from public.network_company_product_dimension_scopes d
          where d.company_product_id=cp.id
        )
      );
  end if;

  if v_org.onboarding_status<>'completed' then
    v_blockers := array_append(v_blockers,'organization_onboarding_incomplete');
  end if;
  if v_active_members=0 then
    v_blockers := array_append(v_blockers,'no_active_organization_member');
  end if;
  if v_network_company_id is null then
    v_blockers := array_append(v_blockers,'network_company_link_required');
  else
    if v_publication_status<>'published' then
      v_blockers := array_append(v_blockers,'network_profile_not_published');
    end if;
    if v_claimed_status<>'claimed' then
      v_blockers := array_append(v_blockers,'network_profile_not_claimed');
    end if;
  end if;

  if v_role in ('supplier','both') then
    if v_supplier_products=0 then
      v_blockers := array_append(v_blockers,'supplier_product_scope_required');
    elsif v_technical_products=0 then
      v_blockers := array_append(v_blockers,'supplier_technical_scope_required');
    end if;
  end if;

  v_ready := cardinality(v_blockers)=0;

  return jsonb_build_object(
    'organization_id',v_org.id,
    'organization_name',v_org.name,
    'organization_slug',v_org.slug,
    'onboarding_status',v_org.onboarding_status,
    'participant_role',v_role,
    'ready',v_ready,
    'blockers',to_jsonb(v_blockers),
    'active_members',v_active_members,
    'network_company_id',v_network_company_id,
    'network_company_name',v_network_name,
    'publication_status',v_publication_status,
    'claimed_status',v_claimed_status,
    'verification_status',v_verification_status,
    'supplier_product_relationships',v_supplier_products,
    'technical_scope_products',v_technical_products
  );
end;
$function$;

revoke all on function private.p5_6a_readiness_impl(uuid,text)
from public,anon,authenticated;

create or replace function private.p5_6a_record_event(
  p_participant public.marketplace_pilot_participants,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_actor uuid := private.p5_6a_require_owner();
  v_sequence bigint;
begin
  insert into public.marketplace_pilot_participant_events(
    participant_id,pilot_run_id,organization_id,actor_user_id,
    event_type,from_status,to_status,participant_role,metadata
  )
  values(
    p_participant.id,p_participant.pilot_run_id,p_participant.organization_id,v_actor,
    p_event_type,p_from_status,p_to_status,p_participant.participant_role,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning event_sequence into v_sequence;

  return v_sequence;
end;
$function$;

revoke all on function private.p5_6a_record_event(public.marketplace_pilot_participants,text,text,text,jsonb)
from public,anon,authenticated;

create or replace function private.p5_6a_start_pilot_impl(
  p_label text,
  p_planned_ends_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_actor uuid := private.p5_6a_require_owner();
  v_label text := coalesce(nullif(btrim(p_label),''),'P5.6 Commercial Pilot');
  v_end timestamptz := coalesce(p_planned_ends_at,clock_timestamp()+interval '90 days');
  v_run public.marketplace_pilot_runs%rowtype;
begin
  select * into v_run
  from public.marketplace_pilot_runs r
  where r.status='active'
  order by r.started_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'id',v_run.id,
      'status',v_run.status,
      'label',v_run.label,
      'protocol_version',v_run.protocol_version,
      'started_at',v_run.started_at,
      'planned_ends_at',v_run.planned_ends_at,
      'idempotent',true
    );
  end if;

  if v_end<=clock_timestamp()+interval '1 day'
     or v_end>clock_timestamp()+interval '180 days' then
    raise exception 'Pilot planned end must be between 1 and 180 days from now'
      using errcode='22023';
  end if;

  insert into public.marketplace_pilot_runs(
    label,protocol_version,started_by,planned_ends_at
  )
  values(v_label,'P5.6-v1',v_actor,v_end)
  returning * into v_run;

  perform private.sa2_record_platform_event(
    'platform.console.access',
    'p5_6a_pilot_started',
    'marketplace_pilot_run',
    v_run.id::text,
    null,
    null,
    jsonb_build_object(
      'status',v_run.status,
      'protocol_version',v_run.protocol_version,
      'planned_ends_at',v_run.planned_ends_at
    ),
    'P5.6A controlled commercial pilot kickoff',
    '{}'::jsonb
  );

  return jsonb_build_object(
    'id',v_run.id,
    'status',v_run.status,
    'label',v_run.label,
    'protocol_version',v_run.protocol_version,
    'started_at',v_run.started_at,
    'planned_ends_at',v_run.planned_ends_at,
    'idempotent',false
  );
end;
$function$;

revoke all on function private.p5_6a_start_pilot_impl(text,timestamptz)
from public,anon;
grant execute on function private.p5_6a_start_pilot_impl(text,timestamptz)
to authenticated,service_role;

create or replace function public.p5_6a_start_pilot(
  p_label text default 'P5.6 Commercial Pilot',
  p_planned_ends_at timestamptz default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_6a_start_pilot_impl(p_label,p_planned_ends_at);
$function$;

revoke all on function public.p5_6a_start_pilot(text,timestamptz)
from public,anon;
grant execute on function public.p5_6a_start_pilot(text,timestamptz)
to authenticated,service_role;

create or replace function private.p5_6a_upsert_participant_impl(
  p_organization_id uuid,
  p_participant_role text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_actor uuid := private.p5_6a_require_owner();
  v_role text := lower(btrim(coalesce(p_participant_role,'')));
  v_run public.marketplace_pilot_runs%rowtype;
  v_participant public.marketplace_pilot_participants%rowtype;
  v_before public.marketplace_pilot_participants%rowtype;
  v_readiness jsonb;
  v_event text;
begin
  if v_role not in ('buyer','supplier','both') then
    raise exception 'Invalid pilot participant role'
      using errcode='22023';
  end if;

  select * into v_run
  from public.marketplace_pilot_runs
  where status='active'
  order by started_at desc
  limit 1;

  if not found then
    raise exception 'No active P5.6 pilot run'
      using errcode='22023';
  end if;

  v_readiness := private.p5_6a_readiness_impl(p_organization_id,v_role);

  select * into v_before
  from public.marketplace_pilot_participants
  where pilot_run_id=v_run.id
    and organization_id=p_organization_id
  for update;

  if found and v_before.status='active' and v_before.participant_role<>v_role then
    raise exception 'Pause active participant before changing pilot role'
      using errcode='22023';
  end if;

  if found then
    update public.marketplace_pilot_participants
    set participant_role=v_role,
        network_company_id=nullif(v_readiness->>'network_company_id','')::uuid,
        status=case when status in ('removed','completed') then 'candidate' else status end,
        removed_at=case when status='removed' then null else removed_at end,
        completed_at=case when status='completed' then null else completed_at end,
        updated_at=clock_timestamp()
    where id=v_before.id
    returning * into v_participant;

    v_event := case
      when v_before.participant_role<>v_role then 'role_updated'
      else 'candidate_added'
    end;
  else
    insert into public.marketplace_pilot_participants(
      pilot_run_id,organization_id,network_company_id,participant_role,status,added_by
    )
    values(
      v_run.id,p_organization_id,
      nullif(v_readiness->>'network_company_id','')::uuid,
      v_role,'candidate',v_actor
    )
    returning * into v_participant;

    v_event := 'candidate_added';
  end if;

  perform private.p5_6a_record_event(
    v_participant,
    v_event,
    case when v_before.id is null then null else v_before.status end,
    v_participant.status,
    jsonb_build_object('readiness',v_readiness)
  );

  perform private.sa2_record_platform_event(
    'platform.console.access',
    'p5_6a_cohort_upsert',
    'marketplace_pilot_participant',
    v_participant.id::text,
    v_participant.organization_id,
    case when v_before.id is null then null else to_jsonb(v_before) end,
    to_jsonb(v_participant),
    'P5.6A cohort selection',
    jsonb_build_object('readiness',v_readiness)
  );

  return jsonb_build_object(
    'participant_id',v_participant.id,
    'status',v_participant.status,
    'participant_role',v_participant.participant_role,
    'readiness',v_readiness
  );
end;
$function$;

revoke all on function private.p5_6a_upsert_participant_impl(uuid,text)
from public,anon;
grant execute on function private.p5_6a_upsert_participant_impl(uuid,text)
to authenticated,service_role;

create or replace function public.p5_6a_upsert_participant(
  p_organization_id uuid,
  p_participant_role text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_6a_upsert_participant_impl(p_organization_id,p_participant_role);
$function$;

revoke all on function public.p5_6a_upsert_participant(uuid,text)
from public,anon;
grant execute on function public.p5_6a_upsert_participant(uuid,text)
to authenticated,service_role;

create or replace function private.p5_6a_transition_participant_impl(
  p_participant_id uuid,
  p_action text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_actor uuid := private.p5_6a_require_owner();
  v_action text := lower(btrim(coalesce(p_action,'')));
  v_participant public.marketplace_pilot_participants%rowtype;
  v_before public.marketplace_pilot_participants%rowtype;
  v_run public.marketplace_pilot_runs%rowtype;
  v_readiness jsonb;
  v_target_status text;
  v_event_type text;
  v_cycle integer;
  v_source_reference text;
  v_entitlement_result jsonb;
begin
  if v_action not in ('activate','resume','pause','complete','remove') then
    raise exception 'Unsupported P5.6 participant action'
      using errcode='22023';
  end if;

  select * into v_participant
  from public.marketplace_pilot_participants
  where id=p_participant_id
  for update;

  if not found then
    raise exception 'Pilot participant not found'
      using errcode='P0002';
  end if;

  select * into v_run
  from public.marketplace_pilot_runs
  where id=v_participant.pilot_run_id
    and status='active';

  if not found then
    raise exception 'P5.6 pilot run is not active'
      using errcode='22023';
  end if;

  v_before := v_participant;
  v_readiness := private.p5_6a_readiness_impl(
    v_participant.organization_id,v_participant.participant_role
  );
  v_source_reference := 'P5.6A:' || v_run.id::text;

  if v_action in ('activate','resume') then
    if coalesce((v_readiness->>'ready')::boolean,false)=false then
      raise exception 'Pilot participant not ready: %',
        array_to_string(
          array(select jsonb_array_elements_text(v_readiness->'blockers')),
          ', '
        )
        using errcode='22023';
    end if;

    if v_action='activate' and v_participant.status<>'candidate' then
      raise exception 'Only candidate participants can be activated'
        using errcode='22023';
    end if;
    if v_action='resume' and v_participant.status<>'paused' then
      raise exception 'Only paused participants can be resumed'
        using errcode='22023';
    end if;

    v_cycle := v_participant.activation_cycle + 1;
    v_target_status := 'active';
    v_event_type := case when v_action='resume' then 'resumed' else 'activated' end;

    update public.marketplace_pilot_participants
    set status='active',
        network_company_id=nullif(v_readiness->>'network_company_id','')::uuid,
        activation_cycle=v_cycle,
        activated_at=case when activated_at is null then clock_timestamp() else activated_at end,
        paused_at=null,
        updated_at=clock_timestamp()
    where id=v_participant.id
    returning * into v_participant;

    if v_participant.participant_role in ('supplier','both') then
      v_entitlement_result := private.p5_3_grant_entitlement_impl(
        v_participant.organization_id,
        'marketplace_access',
        null,
        'pilot',
        v_source_reference,
        v_run.planned_ends_at,
        'p56a:grant:' || v_participant.id::text || ':' || v_cycle::text,
        jsonb_build_object(
          'pilot_run_id',v_run.id,
          'participant_id',v_participant.id,
          'protocol_version',v_run.protocol_version
        )
      );
    end if;

  elsif v_action='pause' then
    if v_participant.status<>'active' then
      raise exception 'Only active participants can be paused'
        using errcode='22023';
    end if;
    v_target_status := 'paused';
    v_event_type := 'paused';
    v_cycle := v_participant.activation_cycle;

    if v_participant.participant_role in ('supplier','both') then
      v_entitlement_result := private.p5_3_revoke_entitlement_impl(
        v_participant.organization_id,
        'marketplace_access',
        null,
        'pilot',
        v_source_reference,
        'p56a:revoke:' || v_participant.id::text || ':' || v_cycle::text,
        jsonb_build_object(
          'pilot_run_id',v_run.id,
          'participant_id',v_participant.id,
          'protocol_version',v_run.protocol_version,
          'reason','participant_paused'
        )
      );
    end if;

    update public.marketplace_pilot_participants
    set status='paused',
        paused_at=clock_timestamp(),
        updated_at=clock_timestamp()
    where id=v_participant.id
    returning * into v_participant;

  elsif v_action in ('complete','remove') then
    if v_participant.status not in ('candidate','active','paused') then
      raise exception 'Participant is already terminal'
        using errcode='22023';
    end if;
    v_target_status := case when v_action='complete' then 'completed' else 'removed' end;
    v_event_type := case when v_action='complete' then 'completed' else 'removed' end;
    v_cycle := v_participant.activation_cycle;

    if v_participant.status='active'
       and v_participant.participant_role in ('supplier','both') then
      v_entitlement_result := private.p5_3_revoke_entitlement_impl(
        v_participant.organization_id,
        'marketplace_access',
        null,
        'pilot',
        v_source_reference,
        'p56a:revoke:' || v_participant.id::text || ':' || v_cycle::text,
        jsonb_build_object(
          'pilot_run_id',v_run.id,
          'participant_id',v_participant.id,
          'protocol_version',v_run.protocol_version,
          'reason',case when v_action='complete' then 'participant_completed' else 'participant_removed' end
        )
      );
    end if;

    update public.marketplace_pilot_participants
    set status=v_target_status,
        completed_at=case when v_action='complete' then clock_timestamp() else completed_at end,
        removed_at=case when v_action='remove' then clock_timestamp() else removed_at end,
        updated_at=clock_timestamp()
    where id=v_participant.id
    returning * into v_participant;
  end if;

  perform private.p5_6a_record_event(
    v_participant,
    v_event_type,
    v_before.status,
    v_target_status,
    jsonb_strip_nulls(jsonb_build_object(
      'readiness',v_readiness,
      'entitlement',v_entitlement_result
    ))
  );

  perform private.sa2_record_platform_event(
    'platform.console.access',
    'p5_6a_participant_' || v_event_type,
    'marketplace_pilot_participant',
    v_participant.id::text,
    v_participant.organization_id,
    to_jsonb(v_before),
    to_jsonb(v_participant),
    'P5.6A controlled cohort lifecycle',
    jsonb_build_object('readiness',v_readiness)
  );

  return jsonb_build_object(
    'participant_id',v_participant.id,
    'status',v_participant.status,
    'participant_role',v_participant.participant_role,
    'activation_cycle',v_participant.activation_cycle,
    'readiness',v_readiness,
    'entitlement',v_entitlement_result
  );
end;
$function$;

revoke all on function private.p5_6a_transition_participant_impl(uuid,text)
from public,anon;
grant execute on function private.p5_6a_transition_participant_impl(uuid,text)
to authenticated,service_role;

create or replace function public.p5_6a_transition_participant(
  p_participant_id uuid,
  p_action text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_6a_transition_participant_impl(p_participant_id,p_action);
$function$;

revoke all on function public.p5_6a_transition_participant(uuid,text)
from public,anon;
grant execute on function public.p5_6a_transition_participant(uuid,text)
to authenticated,service_role;

create or replace function private.p5_6a_control_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_actor uuid := private.p5_6a_require_owner();
  v_run public.marketplace_pilot_runs%rowtype;
  v_participants jsonb := '[]'::jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_counts jsonb := '{}'::jsonb;
begin
  select * into v_run
  from public.marketplace_pilot_runs
  where status='active'
  order by started_at desc
  limit 1;

  if v_run.id is not null then
    select coalesce(jsonb_agg(item order by item->>'organization_name'),'[]'::jsonb)
      into v_participants
    from (
      select jsonb_build_object(
        'participant_id',p.id,
        'organization_id',p.organization_id,
        'organization_name',o.name,
        'organization_slug',o.slug,
        'participant_role',p.participant_role,
        'status',p.status,
        'activation_cycle',p.activation_cycle,
        'added_at',p.added_at,
        'activated_at',p.activated_at,
        'paused_at',p.paused_at,
        'readiness',private.p5_6a_readiness_impl(p.organization_id,p.participant_role)
      ) as item
      from public.marketplace_pilot_participants p
      join public.organizations o on o.id=p.organization_id
      where p.pilot_run_id=v_run.id
        and p.status<>'removed'
    ) q;

    select jsonb_build_object(
      'total',count(*)::integer,
      'candidates',count(*) filter(where status='candidate')::integer,
      'active',count(*) filter(where status='active')::integer,
      'paused',count(*) filter(where status='paused')::integer,
      'buyers',count(*) filter(where status='active' and participant_role in ('buyer','both'))::integer,
      'suppliers',count(*) filter(where status='active' and participant_role in ('supplier','both'))::integer
    )
    into v_counts
    from public.marketplace_pilot_participants p
    where p.pilot_run_id=v_run.id
      and p.status<>'removed';
  else
    v_counts := jsonb_build_object(
      'total',0,'candidates',0,'active',0,'paused',0,'buyers',0,'suppliers',0
    );
  end if;

  select coalesce(jsonb_agg(item order by item->>'organization_name'),'[]'::jsonb)
    into v_candidates
  from (
    select jsonb_build_object(
      'organization_id',o.id,
      'organization_name',o.name,
      'organization_slug',o.slug,
      'onboarding_status',o.onboarding_status,
      'buyer_readiness',private.p5_6a_readiness_impl(o.id,'buyer'),
      'supplier_readiness',private.p5_6a_readiness_impl(o.id,'supplier'),
      'participant',
        case
          when v_run.id is null then null
          else (
            select jsonb_build_object(
              'participant_id',p.id,
              'participant_role',p.participant_role,
              'status',p.status
            )
            from public.marketplace_pilot_participants p
            where p.pilot_run_id=v_run.id
              and p.organization_id=o.id
              and p.status<>'removed'
            limit 1
          )
        end
    ) as item
    from public.organizations o
  ) q;

  return jsonb_build_object(
    'contract','P5.6A-v1',
    'generated_at',clock_timestamp(),
    'run',
      case when v_run.id is null then null else jsonb_build_object(
        'id',v_run.id,
        'status',v_run.status,
        'label',v_run.label,
        'protocol_version',v_run.protocol_version,
        'started_at',v_run.started_at,
        'planned_ends_at',v_run.planned_ends_at
      ) end,
    'counts',v_counts,
    'participants',v_participants,
    'candidate_organizations',v_candidates
  );
end;
$function$;

revoke all on function private.p5_6a_control_impl()
from public,anon;
grant execute on function private.p5_6a_control_impl()
to authenticated,service_role;

create or replace function public.p5_6a_pilot_control()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_6a_control_impl();
$function$;

revoke all on function public.p5_6a_pilot_control()
from public,anon;
grant execute on function public.p5_6a_pilot_control()
to authenticated,service_role;

comment on table public.marketplace_pilot_runs is
  'P5.6 commercial pilot control window. Real-company evidence only; no synthetic usage.';
comment on table public.marketplace_pilot_participants is
  'P5.6 controlled buyer/supplier cohort. Candidate admission is distinct from readiness and activation.';
comment on function public.p5_6a_pilot_control() is
  'Platform Owner-only P5.6A cohort/readiness control plane. Does not expose tenant Commercial Memory.';
