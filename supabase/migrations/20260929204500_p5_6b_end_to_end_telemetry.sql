-- P5.6B — End-to-End Telemetry
--
-- Commercial-pilot read model built from canonical Marketplace ledgers.
-- Adds one bounded soft event only: first opportunity open originating from
-- a P5.5 notification. No request title, technical line, price, message,
-- customer, email, note or Commercial Memory payload is copied to telemetry.

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
    'network_inquiry_submitted','network_inquiry_state_changed',
    'marketplace_opportunity_opened'
  ));

create unique index pilot_usage_events_marketplace_notification_open_uidx
  on public.pilot_usage_events(
    organization_id,event_name,entity_type,entity_id
  )
  where event_name='marketplace_opportunity_opened'
    and entity_type='marketplace_notification';

create or replace function private.p5_6b_participant_active_at(
  p_pilot_run_id uuid,
  p_organization_id uuid,
  p_required_role text,
  p_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_event_type text;
  v_role text;
  v_required_role text := lower(btrim(coalesce(p_required_role,'')));
begin
  if p_pilot_run_id is null
     or p_organization_id is null
     or p_at is null
     or v_required_role not in ('buyer','supplier') then
    return false;
  end if;

  select e.event_type,e.participant_role
    into v_event_type,v_role
  from public.marketplace_pilot_participants p
  join public.marketplace_pilot_participant_events e
    on e.participant_id=p.id
   and e.pilot_run_id=p.pilot_run_id
  where p.pilot_run_id=p_pilot_run_id
    and p.organization_id=p_organization_id
    and e.occurred_at<=p_at
  order by e.occurred_at desc,e.event_sequence desc
  limit 1;

  if v_event_type is null then
    return false;
  end if;

  return
    v_event_type in ('activated','resumed')
    and (v_role='both' or v_role=v_required_role);
end;
$function$;

revoke all on function private.p5_6b_participant_active_at(uuid,uuid,text,timestamptz)
from public,anon,authenticated;

create or replace function private.p5_6b_record_notification_open_impl(
  p_organization_id uuid,
  p_notification_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_run public.marketplace_pilot_runs%rowtype;
  v_notification public.marketplace_notifications%rowtype;
  v_request public.marketplace_requests%rowtype;
  v_event_id bigint;
  v_idempotent boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then
    raise exception 'authentication required'
      using errcode='28000';
  end if;

  if p_organization_id is null
     or not public.is_organization_member(p_organization_id,true) then
    raise exception 'active tenant membership required'
      using errcode='42501';
  end if;

  select * into v_notification
  from public.marketplace_notifications n
  where n.id=p_notification_id
    and n.request_id=p_request_id
    and n.recipient_organization_id=p_organization_id;

  if not found then
    raise exception 'Marketplace notification not found for organization'
      using errcode='P0002';
  end if;

  select * into v_request
  from public.marketplace_requests r
  where r.id=p_request_id;

  if not found then
    raise exception 'Marketplace request not found'
      using errcode='P0002';
  end if;

  select * into v_run
  from public.marketplace_pilot_runs r
  where r.status='active'
  order by r.started_at desc
  limit 1;

  if v_run.id is null
     or not private.p5_6b_participant_active_at(
       v_run.id,p_organization_id,'supplier',v_now
     )
     or v_request.published_at is null
     or not private.p5_6b_participant_active_at(
       v_run.id,v_request.organization_id,'buyer',v_request.published_at
     ) then
    return jsonb_build_object(
      'recorded',false,
      'reason','outside_active_pilot'
    );
  end if;

  insert into public.pilot_usage_events(
    organization_id,
    actor_user_id,
    event_name,
    entity_type,
    entity_id,
    outcome,
    metadata
  )
  values(
    p_organization_id,
    v_actor,
    'marketplace_opportunity_opened',
    'marketplace_notification',
    p_notification_id::text,
    'success',
    jsonb_build_object(
      'source','marketplace_notification',
      'surface','marketplace_notifications',
      'format','teaser'
    )
  )
  on conflict (
    organization_id,event_name,entity_type,entity_id
  )
  where event_name='marketplace_opportunity_opened'
    and entity_type='marketplace_notification'
  do nothing
  returning id into v_event_id;

  if v_event_id is null then
    v_idempotent := true;
    select e.id into v_event_id
    from public.pilot_usage_events e
    where e.organization_id=p_organization_id
      and e.event_name='marketplace_opportunity_opened'
      and e.entity_type='marketplace_notification'
      and e.entity_id=p_notification_id::text
    order by e.occurred_at asc,e.id asc
    limit 1;
  end if;

  return jsonb_build_object(
    'recorded',true,
    'event_id',v_event_id,
    'idempotent',v_idempotent
  );
end;
$function$;

revoke all on function private.p5_6b_record_notification_open_impl(uuid,uuid,uuid)
from public,anon;
grant execute on function private.p5_6b_record_notification_open_impl(uuid,uuid,uuid)
to authenticated;

create or replace function public.p5_6b_record_notification_open(
  p_organization_id uuid,
  p_notification_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_6b_record_notification_open_impl(
    p_organization_id,p_notification_id,p_request_id
  );
$function$;

revoke all on function public.p5_6b_record_notification_open(uuid,uuid,uuid)
from public,anon;
grant execute on function public.p5_6b_record_notification_open(uuid,uuid,uuid)
to authenticated;

create or replace function private.p5_6b_latency_stats(
  p_values numeric[]
)
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'samples',count(*)::integer,
    'avg_seconds',
      case when count(*)=0 then null
      else round(avg(v)::numeric,1) end,
    'p50_seconds',
      case when count(*)=0 then null
      else round(
        (percentile_cont(0.5) within group(order by v))::numeric,
        1
      ) end,
    'min_seconds',
      case when count(*)=0 then null else round(min(v)::numeric,1) end,
    'max_seconds',
      case when count(*)=0 then null else round(max(v)::numeric,1) end
  )
  from unnest(coalesce(p_values,'{}'::numeric[])) as valueset(v)
  where v>=0;
$function$;

revoke all on function private.p5_6b_latency_stats(numeric[])
from public,anon,authenticated;

create or replace function private.p5_6b_telemetry_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_actor uuid := private.p5_6a_require_owner();
  v_run public.marketplace_pilot_runs%rowtype;
  v_generated_at timestamptz := statement_timestamp();
  v_result jsonb;
begin
  select * into v_run
  from public.marketplace_pilot_runs
  where status='active'
  order by started_at desc
  limit 1;

  if v_run.id is null then
    return jsonb_build_object(
      'contract','P5.6B-v1',
      'generated_at',v_generated_at,
      'run',null,
      'funnel',jsonb_build_object(
        'listings_published',0,
        'listings_with_match',0,
        'listing_match_rate',null,
        'matches',0,
        'matches_per_listing',null,
        'pilot_contactable_matches',0,
        'notifications_created',0,
        'notifications_read',0,
        'notifications_dismissed',0,
        'notification_read_rate',null,
        'opportunities_opened',0,
        'notification_to_open_rate',null,
        'unlocks',0,
        'open_to_unlock_rate',null,
        'response_drafts',0,
        'unlock_to_draft_rate',null,
        'responses_submitted',0,
        'unlock_to_submit_rate',null,
        'buyer_engaged_responses',0,
        'submitted_to_buyer_engagement_rate',null,
        'distinct_buyer_organizations',0,
        'distinct_supplier_organizations',0,
        'distinct_organizations',0
      ),
      'latencies',jsonb_build_object(
        'listing_to_first_match',private.p5_6b_latency_stats('{}'::numeric[]),
        'match_to_notification_read',private.p5_6b_latency_stats('{}'::numeric[]),
        'notification_to_opportunity_open',private.p5_6b_latency_stats('{}'::numeric[]),
        'opportunity_open_to_unlock',private.p5_6b_latency_stats('{}'::numeric[]),
        'unlock_to_draft_response',private.p5_6b_latency_stats('{}'::numeric[]),
        'unlock_to_submitted_response',private.p5_6b_latency_stats('{}'::numeric[]),
        'submitted_response_to_buyer_engagement',private.p5_6b_latency_stats('{}'::numeric[])
      ),
      'participants','[]'::jsonb,
      'listings','[]'::jsonb
    );
  end if;

  with
  pilot_requests as (
    select r.*
    from public.marketplace_requests r
    where r.published_at is not null
      and r.published_at>=v_run.started_at
      and r.published_at<=v_generated_at
      and private.p5_6b_participant_active_at(
        v_run.id,r.organization_id,'buyer',r.published_at
      )
  ),
  all_matches as (
    select m.*
    from public.marketplace_matches m
    join pilot_requests r on r.id=m.request_id
    where m.created_at>=r.published_at
      and m.created_at<=v_generated_at
  ),
  pilot_matches as (
    select m.*
    from all_matches m
    where m.supplier_organization_id is not null
      and private.p5_6b_participant_active_at(
        v_run.id,m.supplier_organization_id,'supplier',m.created_at
      )
  ),
  pilot_notifications as (
    select n.*
    from public.marketplace_notifications n
    join pilot_requests r on r.id=n.request_id
    where n.created_at>=r.published_at
      and n.created_at<=v_generated_at
      and private.p5_6b_participant_active_at(
        v_run.id,n.recipient_organization_id,'supplier',n.created_at
      )
  ),
  pilot_opens as (
    select
      e.id as usage_event_id,
      e.organization_id,
      n.id as notification_id,
      n.request_id,
      e.occurred_at as opened_at
    from public.pilot_usage_events e
    join pilot_notifications n
      on e.entity_id=n.id::text
     and e.organization_id=n.recipient_organization_id
    where e.event_name='marketplace_opportunity_opened'
      and e.entity_type='marketplace_notification'
      and e.occurred_at>=n.created_at
      and e.occurred_at<=v_generated_at
      and private.p5_6b_participant_active_at(
        v_run.id,e.organization_id,'supplier',e.occurred_at
      )
  ),
  pilot_unlocks as (
    select u.*
    from public.marketplace_unlocks u
    join pilot_requests r on r.id=u.request_id
    where u.unlocked_at>=r.published_at
      and u.unlocked_at<=v_generated_at
      and private.p5_6b_participant_active_at(
        v_run.id,u.supplier_organization_id,'supplier',u.unlocked_at
      )
  ),
  response_created as (
    select e.*
    from public.marketplace_response_events e
    join pilot_requests r on r.id=e.request_id
    where e.event_type='created'
      and e.actor_side='supplier'
      and e.created_at>=r.published_at
      and e.created_at<=v_generated_at
      and private.p5_6b_participant_active_at(
        v_run.id,e.supplier_organization_id,'supplier',e.created_at
      )
  ),
  response_submitted as (
    select e.*
    from public.marketplace_response_events e
    join pilot_requests r on r.id=e.request_id
    where e.event_type='submitted'
      and e.actor_side='supplier'
      and e.created_at>=r.published_at
      and e.created_at<=v_generated_at
      and private.p5_6b_participant_active_at(
        v_run.id,e.supplier_organization_id,'supplier',e.created_at
      )
  ),
  buyer_engagement as (
    select e.*
    from public.marketplace_response_events e
    join pilot_requests r on r.id=e.request_id
    where e.event_type in ('acknowledged','declined','closed')
      and e.actor_side='buyer'
      and e.actor_organization_id=r.organization_id
      and e.created_at>=r.published_at
      and e.created_at<=v_generated_at
      and private.p5_6b_participant_active_at(
        v_run.id,r.organization_id,'buyer',e.created_at
      )
  ),
  first_matches as (
    select r.id as request_id,min(m.created_at) as first_match_at
    from pilot_requests r
    join all_matches m on m.request_id=r.id
    group by r.id
  ),
  first_notification_opens as (
    select notification_id,min(opened_at) as first_open_at
    from pilot_opens
    group by notification_id
  ),
  first_unlocks as (
    select
      u.request_id,
      u.supplier_organization_id,
      min(u.unlocked_at) as first_unlock_at
    from pilot_unlocks u
    group by u.request_id,u.supplier_organization_id
  ),
  first_drafts as (
    select
      e.request_id,
      e.supplier_organization_id,
      min(e.created_at) as first_draft_at
    from response_created e
    group by e.request_id,e.supplier_organization_id
  ),
  first_submissions as (
    select
      e.response_id,
      e.request_id,
      e.supplier_organization_id,
      min(e.created_at) as first_submitted_at
    from response_submitted e
    group by e.response_id,e.request_id,e.supplier_organization_id
  ),
  first_buyer_engagement as (
    select
      e.response_id,
      min(e.created_at) as first_engaged_at
    from buyer_engagement e
    group by e.response_id
  ),
  listing_match_latency as (
    select extract(epoch from (f.first_match_at-r.published_at))::numeric as seconds
    from pilot_requests r
    join first_matches f on f.request_id=r.id
    where f.first_match_at>=r.published_at
  ),
  match_notification_read_latency as (
    select extract(epoch from (n.first_read_at-m.created_at))::numeric as seconds
    from pilot_notifications n
    join public.marketplace_matches m on m.id=n.match_id
    where n.first_read_at is not null
      and n.first_read_at>=m.created_at
      and private.p5_6b_participant_active_at(
        v_run.id,n.recipient_organization_id,'supplier',n.first_read_at
      )
  ),
  notification_open_latency as (
    select extract(epoch from (o.first_open_at-n.created_at))::numeric as seconds
    from pilot_notifications n
    join first_notification_opens o on o.notification_id=n.id
    where o.first_open_at>=n.created_at
  ),
  open_unlock_latency as (
    select extract(epoch from (u.first_unlock_at-o.first_open_at))::numeric as seconds
    from pilot_notifications n
    join first_notification_opens o on o.notification_id=n.id
    join first_unlocks u
      on u.request_id=n.request_id
     and u.supplier_organization_id=n.recipient_organization_id
    where u.first_unlock_at>=o.first_open_at
  ),
  unlock_draft_latency as (
    select extract(epoch from (d.first_draft_at-u.first_unlock_at))::numeric as seconds
    from first_unlocks u
    join first_drafts d
      on d.request_id=u.request_id
     and d.supplier_organization_id=u.supplier_organization_id
    where d.first_draft_at>=u.first_unlock_at
  ),
  unlock_submit_latency as (
    select extract(epoch from (s.first_submitted_at-u.first_unlock_at))::numeric as seconds
    from first_unlocks u
    join first_submissions s
      on s.request_id=u.request_id
     and s.supplier_organization_id=u.supplier_organization_id
    where s.first_submitted_at>=u.first_unlock_at
  ),
  submit_buyer_latency as (
    select extract(epoch from (b.first_engaged_at-s.first_submitted_at))::numeric as seconds
    from first_submissions s
    join first_buyer_engagement b on b.response_id=s.response_id
    where b.first_engaged_at>=s.first_submitted_at
  ),
  participant_orgs as (
    select distinct p.organization_id
    from public.marketplace_pilot_participants p
    where p.pilot_run_id=v_run.id
      and p.status<>'removed'
  ),
  actual_supplier_orgs as (
    select recipient_organization_id as organization_id from pilot_notifications
    union
    select organization_id from pilot_opens
    union
    select supplier_organization_id from pilot_unlocks
    union
    select supplier_organization_id from response_created
    union
    select supplier_organization_id from response_submitted
  ),
  actual_orgs as (
    select organization_id from pilot_requests
    union
    select organization_id from actual_supplier_orgs
  ),
  counts as (
    select
      (select count(*)::integer from pilot_requests) as listings_published,
      (select count(*)::integer from pilot_requests r where exists(
        select 1 from all_matches m where m.request_id=r.id
      )) as listings_with_match,
      (select count(*)::integer from all_matches) as matches,
      (select count(*)::integer from pilot_matches) as pilot_contactable_matches,
      (select count(*)::integer from pilot_notifications) as notifications_created,
      (select count(*)::integer from pilot_notifications n
        where n.first_read_at is not null
          and private.p5_6b_participant_active_at(
            v_run.id,n.recipient_organization_id,'supplier',n.first_read_at
          )
      ) as notifications_read,
      (select count(*)::integer from pilot_notifications n
        where n.dismissed_at is not null
          and private.p5_6b_participant_active_at(
            v_run.id,n.recipient_organization_id,'supplier',n.dismissed_at
          )
      ) as notifications_dismissed,
      (select count(distinct (organization_id,request_id))::integer from pilot_opens) as opportunities_opened,
      (select count(*)::integer from first_unlocks) as unlocks,
      (select count(distinct response_id)::integer from response_created) as response_drafts,
      (select count(*)::integer from first_submissions) as responses_submitted,
      (select count(*)::integer from first_buyer_engagement b
        where exists(select 1 from first_submissions s where s.response_id=b.response_id)
      ) as buyer_engaged_responses,
      (select count(distinct organization_id)::integer from pilot_requests) as distinct_buyer_organizations,
      (select count(distinct organization_id)::integer from actual_supplier_orgs) as distinct_supplier_organizations,
      (select count(distinct organization_id)::integer from actual_orgs) as distinct_organizations
  ),
  participant_metrics as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'participant_id',p.id,
        'organization_id',p.organization_id,
        'organization_name',o.name,
        'participant_role',p.participant_role,
        'status',p.status,
        'published_listings',(select count(*) from pilot_requests r where r.organization_id=p.organization_id),
        'notifications_received',(select count(*) from pilot_notifications n where n.recipient_organization_id=p.organization_id),
        'notifications_read',(select count(*) from pilot_notifications n where n.recipient_organization_id=p.organization_id and n.first_read_at is not null),
        'opportunities_opened',(select count(distinct po.request_id) from pilot_opens po where po.organization_id=p.organization_id),
        'unlocks',(select count(*) from first_unlocks u where u.supplier_organization_id=p.organization_id),
        'response_drafts',(select count(distinct rc.response_id) from response_created rc where rc.supplier_organization_id=p.organization_id),
        'responses_submitted',(select count(*) from first_submissions rs where rs.supplier_organization_id=p.organization_id),
        'buyer_engagement_actions',(select count(*) from buyer_engagement be where be.actor_organization_id=p.organization_id)
      )
      order by o.name
    ),'[]'::jsonb) as items
    from public.marketplace_pilot_participants p
    join public.organizations o on o.id=p.organization_id
    where p.pilot_run_id=v_run.id
      and p.status<>'removed'
  ),
  listing_metrics as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'request_id',r.id,
        'buyer_organization_id',r.organization_id,
        'buyer_organization_name',o.name,
        'visibility_mode',r.visibility_mode,
        'published_at',r.published_at,
        'matches',(select count(*) from all_matches m where m.request_id=r.id),
        'pilot_contactable_matches',(select count(*) from pilot_matches m where m.request_id=r.id),
        'notifications_created',(select count(*) from pilot_notifications n where n.request_id=r.id),
        'notifications_read',(select count(*) from pilot_notifications n where n.request_id=r.id and n.first_read_at is not null),
        'opportunities_opened',(select count(distinct po.organization_id) from pilot_opens po where po.request_id=r.id),
        'unlocks',(select count(*) from first_unlocks u where u.request_id=r.id),
        'response_drafts',(select count(distinct rc.response_id) from response_created rc where rc.request_id=r.id),
        'responses_submitted',(select count(*) from first_submissions rs where rs.request_id=r.id),
        'buyer_engaged_responses',(
          select count(*)
          from first_buyer_engagement be
          where exists(
            select 1 from first_submissions rs
            where rs.response_id=be.response_id
              and rs.request_id=r.id
          )
        ),
        'first_match_at',(select fm.first_match_at from first_matches fm where fm.request_id=r.id)
      )
      order by r.published_at desc,r.id
    ),'[]'::jsonb) as items
    from pilot_requests r
    join public.organizations o on o.id=r.organization_id
  )
  select jsonb_build_object(
    'contract','P5.6B-v1',
    'generated_at',v_generated_at,
    'run',jsonb_build_object(
      'id',v_run.id,
      'status',v_run.status,
      'label',v_run.label,
      'protocol_version',v_run.protocol_version,
      'started_at',v_run.started_at,
      'planned_ends_at',v_run.planned_ends_at
    ),
    'funnel',jsonb_build_object(
      'listings_published',c.listings_published,
      'listings_with_match',c.listings_with_match,
      'listing_match_rate',
        case when c.listings_published=0 then null
        else round(c.listings_with_match::numeric/c.listings_published,4) end,
      'matches',c.matches,
      'matches_per_listing',
        case when c.listings_published=0 then null
        else round(c.matches::numeric/c.listings_published,2) end,
      'pilot_contactable_matches',c.pilot_contactable_matches,
      'notifications_created',c.notifications_created,
      'notifications_read',c.notifications_read,
      'notifications_dismissed',c.notifications_dismissed,
      'notification_read_rate',
        case when c.notifications_created=0 then null
        else round(c.notifications_read::numeric/c.notifications_created,4) end,
      'opportunities_opened',c.opportunities_opened,
      'notification_to_open_rate',
        case when c.notifications_created=0 then null
        else round(c.opportunities_opened::numeric/c.notifications_created,4) end,
      'unlocks',c.unlocks,
      'open_to_unlock_rate',
        case when c.opportunities_opened=0 then null
        else round(c.unlocks::numeric/c.opportunities_opened,4) end,
      'response_drafts',c.response_drafts,
      'unlock_to_draft_rate',
        case when c.unlocks=0 then null
        else round(c.response_drafts::numeric/c.unlocks,4) end,
      'responses_submitted',c.responses_submitted,
      'unlock_to_submit_rate',
        case when c.unlocks=0 then null
        else round(c.responses_submitted::numeric/c.unlocks,4) end,
      'buyer_engaged_responses',c.buyer_engaged_responses,
      'submitted_to_buyer_engagement_rate',
        case when c.responses_submitted=0 then null
        else round(c.buyer_engaged_responses::numeric/c.responses_submitted,4) end,
      'distinct_buyer_organizations',c.distinct_buyer_organizations,
      'distinct_supplier_organizations',c.distinct_supplier_organizations,
      'distinct_organizations',c.distinct_organizations
    ),
    'latencies',jsonb_build_object(
      'listing_to_first_match',private.p5_6b_latency_stats(
        array(select seconds from listing_match_latency)
      ),
      'match_to_notification_read',private.p5_6b_latency_stats(
        array(select seconds from match_notification_read_latency)
      ),
      'notification_to_opportunity_open',private.p5_6b_latency_stats(
        array(select seconds from notification_open_latency)
      ),
      'opportunity_open_to_unlock',private.p5_6b_latency_stats(
        array(select seconds from open_unlock_latency)
      ),
      'unlock_to_draft_response',private.p5_6b_latency_stats(
        array(select seconds from unlock_draft_latency)
      ),
      'unlock_to_submitted_response',private.p5_6b_latency_stats(
        array(select seconds from unlock_submit_latency)
      ),
      'submitted_response_to_buyer_engagement',private.p5_6b_latency_stats(
        array(select seconds from submit_buyer_latency)
      )
    ),
    'participants',pm.items,
    'listings',lm.items,
    'measurement',jsonb_build_object(
      'hard_event_source','canonical_marketplace_ledgers',
      'soft_event','marketplace_opportunity_opened',
      'soft_event_source','notification_open_action',
      'content_payload_copied',false
    )
  )
  into v_result
  from counts c
  cross join participant_metrics pm
  cross join listing_metrics lm;

  return v_result;
end;
$function$;

revoke all on function private.p5_6b_telemetry_impl()
from public,anon;
grant execute on function private.p5_6b_telemetry_impl()
to authenticated;

create or replace function public.p5_6b_pilot_telemetry()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_6b_telemetry_impl();
$function$;

revoke all on function public.p5_6b_pilot_telemetry()
from public,anon;
grant execute on function public.p5_6b_pilot_telemetry()
to authenticated;

comment on function public.p5_6b_record_notification_open(uuid,uuid,uuid) is
  'P5.6B privacy-bounded first opportunity-open signal from a P5.5 notification. Records only active commercial-pilot buyer/supplier flow.';
comment on function public.p5_6b_pilot_telemetry() is
  'Platform Owner-only P5.6B Marketplace funnel. Hard events derive from canonical Marketplace ledgers; telemetry adds only the first notification-driven opportunity open.';
