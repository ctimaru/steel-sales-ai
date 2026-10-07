
create table if not exists investor_private.investor_outreach_targets (
  id uuid primary key default gen_random_uuid(),
  investor_name text not null check (length(btrim(investor_name)) between 2 and 160),
  firm_name text null check (firm_name is null or length(btrim(firm_name)) <= 180),
  investor_email text null check (
    investor_email is null
    or investor_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  investor_type text not null default 'vc'
    check (investor_type in ('vc','corporate_vc','family_office','angel','strategic','other')),
  geography text null check (geography is null or length(btrim(geography)) <= 120),
  thesis_fit text null check (thesis_fit is null or length(thesis_fit) <= 2000),
  source text null check (source is null or length(btrim(source)) <= 180),
  stage text not null default 'target'
    check (stage in ('target','contacted','replied','meeting','diligence','term_sheet','committed','passed')),
  priority text not null default 'medium'
    check (priority in ('high','medium','low')),
  invite_id uuid null references public.investor_business_plan_invites(id) on delete set null,
  last_contacted_at timestamptz null,
  next_follow_up_at timestamptz null,
  notes text null check (notes is null or length(notes) <= 8000),
  archived_at timestamptz null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (updated_at >= created_at)
);

create index if not exists investor_outreach_targets_stage_idx
  on investor_private.investor_outreach_targets(stage, priority, updated_at desc)
  where archived_at is null;

create index if not exists investor_outreach_targets_follow_up_idx
  on investor_private.investor_outreach_targets(next_follow_up_at)
  where archived_at is null and next_follow_up_at is not null;

create index if not exists investor_outreach_targets_invite_idx
  on investor_private.investor_outreach_targets(invite_id)
  where invite_id is not null;

create table if not exists investor_private.investor_outreach_events (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references investor_private.investor_outreach_targets(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'note','email_sent','email_received','meeting_scheduled','meeting_held',
      'deck_shared','data_room_granted','follow_up','stage_changed','passed','commitment'
    )),
  summary text not null check (length(btrim(summary)) between 1 and 4000),
  occurred_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists investor_outreach_events_target_occurred_idx
  on investor_private.investor_outreach_events(target_id, occurred_at desc);

alter table investor_private.investor_outreach_targets enable row level security;
alter table investor_private.investor_outreach_events enable row level security;

revoke all on table investor_private.investor_outreach_targets from public, anon, authenticated;
revoke all on table investor_private.investor_outreach_events from public, anon, authenticated;

create or replace function investor_private.mkt8_outreach_list_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_targets jsonb;
  v_summary jsonb;
begin
  if not private.is_platform_superadmin() then
    return jsonb_build_object(
      'allowed', false,
      'targets', '[]'::jsonb,
      'summary', jsonb_build_object(
        'total', 0,
        'active', 0,
        'due_follow_up', 0,
        'diligence_or_later', 0
      )
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'investor_name', t.investor_name,
        'firm_name', t.firm_name,
        'investor_email', t.investor_email,
        'investor_type', t.investor_type,
        'geography', t.geography,
        'thesis_fit', t.thesis_fit,
        'source', t.source,
        'stage', t.stage,
        'priority', t.priority,
        'last_contacted_at', t.last_contacted_at,
        'next_follow_up_at', t.next_follow_up_at,
        'notes', t.notes,
        'created_at', t.created_at,
        'updated_at', t.updated_at,
        'invite',
          case when i.id is null then null else jsonb_build_object(
            'id', i.id,
            'share_token', i.share_token,
            'label', i.label,
            'investor_email', i.investor_email,
            'scopes', to_jsonb(i.scopes),
            'status',
              case
                when i.status = 'revoked' then 'revoked'
                when i.expires_at <= now() then 'expired'
                else 'active'
              end,
            'expires_at', i.expires_at,
            'last_accessed_at', i.last_accessed_at,
            'access_count', i.access_count
          ) end,
        'events',
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', e.id,
                'event_type', e.event_type,
                'summary', e.summary,
                'occurred_at', e.occurred_at,
                'metadata', e.metadata
              )
              order by e.occurred_at desc, e.created_at desc
            )
            from (
              select e0.*
              from investor_private.investor_outreach_events e0
              where e0.target_id = t.id
              order by e0.occurred_at desc, e0.created_at desc
              limit 8
            ) e
          ), '[]'::jsonb)
      )
      order by
        case t.priority when 'high' then 1 when 'medium' then 2 else 3 end,
        case t.stage
          when 'term_sheet' then 1
          when 'diligence' then 2
          when 'meeting' then 3
          when 'replied' then 4
          when 'contacted' then 5
          when 'target' then 6
          when 'committed' then 7
          else 8
        end,
        coalesce(t.next_follow_up_at, 'infinity'::timestamptz),
        t.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_targets
  from investor_private.investor_outreach_targets t
  left join public.investor_business_plan_invites i on i.id = t.invite_id
  where t.archived_at is null;

  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where stage not in ('committed','passed')),
    'due_follow_up', count(*) filter (
      where stage not in ('committed','passed')
        and next_follow_up_at is not null
        and next_follow_up_at <= now()
    ),
    'diligence_or_later', count(*) filter (
      where stage in ('diligence','term_sheet','committed')
    )
  )
  into v_summary
  from investor_private.investor_outreach_targets
  where archived_at is null;

  return jsonb_build_object(
    'allowed', true,
    'targets', v_targets,
    'summary', v_summary
  );
end;
$$;

create or replace function investor_private.mkt8_outreach_target_upsert_impl(
  p_target_id uuid,
  p_investor_name text,
  p_firm_name text,
  p_investor_email text,
  p_investor_type text,
  p_geography text,
  p_thesis_fit text,
  p_source text,
  p_stage text,
  p_priority text,
  p_invite_id uuid,
  p_next_follow_up_at timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
  v_old_stage text;
  v_old_invite uuid;
  v_name text := btrim(coalesce(p_investor_name,''));
  v_email text := nullif(lower(btrim(coalesce(p_investor_email,''))),'');
  v_stage text := lower(btrim(coalesce(p_stage,'target')));
  v_priority text := lower(btrim(coalesce(p_priority,'medium')));
  v_type text := lower(btrim(coalesce(p_investor_type,'vc')));
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;

  if length(v_name) < 2 or length(v_name) > 160 then
    raise exception 'Investor name is required' using errcode='22023';
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid investor email required' using errcode='22023';
  end if;
  if v_type not in ('vc','corporate_vc','family_office','angel','strategic','other') then
    raise exception 'Invalid investor type' using errcode='22023';
  end if;
  if v_stage not in ('target','contacted','replied','meeting','diligence','term_sheet','committed','passed') then
    raise exception 'Invalid outreach stage' using errcode='22023';
  end if;
  if v_priority not in ('high','medium','low') then
    raise exception 'Invalid priority' using errcode='22023';
  end if;
  if p_invite_id is not null and not exists (
    select 1 from public.investor_business_plan_invites i where i.id = p_invite_id
  ) then
    raise exception 'Investor Room invite not found' using errcode='P0002';
  end if;

  if p_target_id is null then
    insert into investor_private.investor_outreach_targets(
      investor_name, firm_name, investor_email, investor_type, geography,
      thesis_fit, source, stage, priority, invite_id, next_follow_up_at,
      notes, created_by, updated_by
    )
    values (
      v_name,
      nullif(btrim(coalesce(p_firm_name,'')),''),
      v_email,
      v_type,
      nullif(btrim(coalesce(p_geography,'')),''),
      nullif(btrim(coalesce(p_thesis_fit,'')),''),
      nullif(btrim(coalesce(p_source,'')),''),
      v_stage,
      v_priority,
      p_invite_id,
      case when v_stage in ('committed','passed') then null else p_next_follow_up_at end,
      nullif(btrim(coalesce(p_notes,'')),''),
      v_actor,
      v_actor
    )
    returning id into v_id;

    insert into investor_private.investor_outreach_events(
      target_id,event_type,summary,created_by,metadata
    )
    values (
      v_id,
      'stage_changed',
      'Investor target created in ' || v_stage,
      v_actor,
      jsonb_build_object('to_stage',v_stage)
    );

    if p_invite_id is not null then
      insert into investor_private.investor_outreach_events(
        target_id,event_type,summary,created_by,metadata
      )
      values (
        v_id,
        'data_room_granted',
        'Investor Room invite linked',
        v_actor,
        jsonb_build_object('invite_id',p_invite_id)
      );
    end if;
  else
    select stage, invite_id
      into v_old_stage, v_old_invite
    from investor_private.investor_outreach_targets
    where id = p_target_id and archived_at is null
    for update;

    if not found then
      raise exception 'Investor outreach target not found' using errcode='P0002';
    end if;

    update investor_private.investor_outreach_targets
    set investor_name = v_name,
        firm_name = nullif(btrim(coalesce(p_firm_name,'')),''),
        investor_email = v_email,
        investor_type = v_type,
        geography = nullif(btrim(coalesce(p_geography,'')),''),
        thesis_fit = nullif(btrim(coalesce(p_thesis_fit,'')),''),
        source = nullif(btrim(coalesce(p_source,'')),''),
        stage = v_stage,
        priority = v_priority,
        invite_id = p_invite_id,
        next_follow_up_at = case when v_stage in ('committed','passed') then null else p_next_follow_up_at end,
        notes = nullif(btrim(coalesce(p_notes,'')),''),
        updated_by = v_actor,
        updated_at = now()
    where id = p_target_id
    returning id into v_id;

    if v_old_stage is distinct from v_stage then
      insert into investor_private.investor_outreach_events(
        target_id,event_type,summary,created_by,metadata
      )
      values (
        v_id,
        'stage_changed',
        'Stage changed from ' || v_old_stage || ' to ' || v_stage,
        v_actor,
        jsonb_build_object('from_stage',v_old_stage,'to_stage',v_stage)
      );
    end if;

    if v_old_invite is distinct from p_invite_id and p_invite_id is not null then
      insert into investor_private.investor_outreach_events(
        target_id,event_type,summary,created_by,metadata
      )
      values (
        v_id,
        'data_room_granted',
        'Investor Room invite linked',
        v_actor,
        jsonb_build_object('invite_id',p_invite_id,'previous_invite_id',v_old_invite)
      );
    end if;
  end if;

  return jsonb_build_object('id',v_id,'stage',v_stage,'priority',v_priority);
end;
$$;

create or replace function investor_private.mkt8_outreach_log_event_impl(
  p_target_id uuid,
  p_event_type text,
  p_summary text,
  p_occurred_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_event_type text := lower(btrim(coalesce(p_event_type,'')));
  v_summary text := btrim(coalesce(p_summary,''));
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_event_id uuid;
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;
  if not exists (
    select 1 from investor_private.investor_outreach_targets
    where id = p_target_id and archived_at is null
  ) then
    raise exception 'Investor outreach target not found' using errcode='P0002';
  end if;
  if v_event_type not in (
    'note','email_sent','email_received','meeting_scheduled','meeting_held',
    'deck_shared','data_room_granted','follow_up','stage_changed','passed','commitment'
  ) then
    raise exception 'Invalid investor outreach event type' using errcode='22023';
  end if;
  if length(v_summary) < 1 or length(v_summary) > 4000 then
    raise exception 'Event summary is required' using errcode='22023';
  end if;

  insert into investor_private.investor_outreach_events(
    target_id,event_type,summary,occurred_at,created_by,metadata
  )
  values (
    p_target_id,v_event_type,v_summary,v_occurred_at,v_actor,coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_event_id;

  update investor_private.investor_outreach_targets
  set last_contacted_at = case
        when v_event_type in ('email_sent','email_received','meeting_held','follow_up')
          then greatest(coalesce(last_contacted_at,'-infinity'::timestamptz),v_occurred_at)
        else last_contacted_at
      end,
      stage = case
        when v_event_type = 'passed' then 'passed'
        when v_event_type = 'commitment' then 'committed'
        else stage
      end,
      next_follow_up_at = case
        when v_event_type in ('passed','commitment') then null
        else next_follow_up_at
      end,
      updated_by = v_actor,
      updated_at = now()
  where id = p_target_id;

  return jsonb_build_object('id',v_event_id,'target_id',p_target_id,'event_type',v_event_type);
end;
$$;

create or replace function investor_private.mkt8_outreach_archive_impl(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not private.is_platform_superadmin() then
    raise exception 'Platform Owner required' using errcode='42501';
  end if;

  update investor_private.investor_outreach_targets
  set archived_at = now(),
      updated_by = v_actor,
      updated_at = now()
  where id = p_target_id
    and archived_at is null;

  if not found then
    raise exception 'Investor outreach target not found' using errcode='P0002';
  end if;

  return jsonb_build_object('id',p_target_id,'archived',true);
end;
$$;

create or replace function public.mkt8_investor_outreach_list()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select investor_private.mkt8_outreach_list_impl();
$$;

create or replace function public.mkt8_investor_outreach_target_upsert(
  p_target_id uuid,
  p_investor_name text,
  p_firm_name text,
  p_investor_email text,
  p_investor_type text,
  p_geography text,
  p_thesis_fit text,
  p_source text,
  p_stage text,
  p_priority text,
  p_invite_id uuid,
  p_next_follow_up_at timestamptz,
  p_notes text
)
returns jsonb
language sql
set search_path = ''
as $$
  select investor_private.mkt8_outreach_target_upsert_impl(
    p_target_id,p_investor_name,p_firm_name,p_investor_email,p_investor_type,
    p_geography,p_thesis_fit,p_source,p_stage,p_priority,p_invite_id,
    p_next_follow_up_at,p_notes
  );
$$;

create or replace function public.mkt8_investor_outreach_log_event(
  p_target_id uuid,
  p_event_type text,
  p_summary text,
  p_occurred_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
set search_path = ''
as $$
  select investor_private.mkt8_outreach_log_event_impl(
    p_target_id,p_event_type,p_summary,p_occurred_at,p_metadata
  );
$$;

create or replace function public.mkt8_investor_outreach_archive(p_target_id uuid)
returns jsonb
language sql
set search_path = ''
as $$
  select investor_private.mkt8_outreach_archive_impl(p_target_id);
$$;

revoke execute on function investor_private.mkt8_outreach_list_impl() from public, anon;
revoke execute on function investor_private.mkt8_outreach_target_upsert_impl(
  uuid,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text
) from public, anon;
revoke execute on function investor_private.mkt8_outreach_log_event_impl(
  uuid,text,text,timestamptz,jsonb
) from public, anon;
revoke execute on function investor_private.mkt8_outreach_archive_impl(uuid) from public, anon;

grant execute on function investor_private.mkt8_outreach_list_impl() to authenticated, service_role;
grant execute on function investor_private.mkt8_outreach_target_upsert_impl(
  uuid,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text
) to authenticated, service_role;
grant execute on function investor_private.mkt8_outreach_log_event_impl(
  uuid,text,text,timestamptz,jsonb
) to authenticated, service_role;
grant execute on function investor_private.mkt8_outreach_archive_impl(uuid) to authenticated, service_role;

revoke execute on function public.mkt8_investor_outreach_list() from public, anon;
revoke execute on function public.mkt8_investor_outreach_target_upsert(
  uuid,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text
) from public, anon;
revoke execute on function public.mkt8_investor_outreach_log_event(
  uuid,text,text,timestamptz,jsonb
) from public, anon;
revoke execute on function public.mkt8_investor_outreach_archive(uuid) from public, anon;

grant execute on function public.mkt8_investor_outreach_list() to authenticated, service_role;
grant execute on function public.mkt8_investor_outreach_target_upsert(
  uuid,text,text,text,text,text,text,text,text,text,uuid,timestamptz,text
) to authenticated, service_role;
grant execute on function public.mkt8_investor_outreach_log_event(
  uuid,text,text,timestamptz,jsonb
) to authenticated, service_role;
grant execute on function public.mkt8_investor_outreach_archive(uuid) to authenticated, service_role;
