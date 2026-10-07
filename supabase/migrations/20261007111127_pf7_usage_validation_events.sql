-- PF7 — Usage Validation
--
-- Adds privacy-safe product usage signals for the authenticated macro-spaces.
-- No query text, company names, prices, RFQ content, emails or document content
-- are copied into pilot_usage_events. Metadata remains constrained to
-- source/surface/format by the existing recorder.

alter table public.pilot_usage_events
  drop constraint if exists pilot_usage_events_event_name_check;

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
    'marketplace_opportunity_opened',
    'workspace_home_viewed','commercial_home_viewed','network_search_completed',
    'marketplace_home_viewed','marketplace_opportunity_viewed','rfq_hub_viewed',
    'school_home_viewed','school_calculator_viewed','school_reference_search'
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
    'network_inquiry_submitted','network_inquiry_state_changed',
    'workspace_home_viewed','commercial_home_viewed','network_search_completed',
    'marketplace_home_viewed','marketplace_opportunity_viewed','rfq_hub_viewed',
    'school_home_viewed','school_calculator_viewed','school_reference_search'
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

create or replace function private.p1_pilot_usage_summary_impl(
  p_organization_id uuid,
  p_since timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='28000', message='authentication required';
  end if;
  if p_organization_id is null or not public.is_organization_member(p_organization_id,true) then
    raise exception using errcode='42501', message='active tenant membership required';
  end if;

  select jsonb_build_object(
    'contract','PF7-v1',
    'since',p_since,
    'generated_at',now(),
    'weekly_active_users',count(distinct actor_user_id) filter (where occurred_at >= now()-interval '7 days'),
    'active_users',count(distinct actor_user_id),
    'searches',count(*) filter (where event_name='search_completed'),
    'search_success_rate',case
      when count(*) filter (where event_name='search_completed')=0 then null
      else round(
        (count(*) filter (where event_name='search_completed' and outcome='success'))::numeric
        / nullif(count(*) filter (where event_name='search_completed'),0),4
      )
    end,
    'product_views',count(*) filter (where event_name='product_viewed'),
    'company_views',count(*) filter (where event_name='company_viewed'),
    'price_history_views',count(*) filter (where event_name='price_history_viewed'),
    'evidence_opens',count(*) filter (where event_name='evidence_opened'),
    'review_views',count(*) filter (where event_name='review_viewed'),
    'corrections_completed',count(*) filter (where event_name='correction_completed'),
    'uploads_completed',count(*) filter (where event_name='upload_completed'),
    'workspace_home_views',count(*) filter (where event_name='workspace_home_viewed'),
    'commercial_home_views',count(*) filter (where event_name='commercial_home_viewed'),
    'network_searches',count(*) filter (where event_name='network_search_completed'),
    'network_profile_views',count(*) filter (where event_name='network_profile_viewed'),
    'marketplace_home_views',count(*) filter (where event_name='marketplace_home_viewed'),
    'marketplace_opportunity_views',count(*) filter (where event_name='marketplace_opportunity_viewed'),
    'rfq_hub_views',count(*) filter (where event_name='rfq_hub_viewed'),
    'school_home_views',count(*) filter (where event_name='school_home_viewed'),
    'school_calculator_views',count(*) filter (where event_name='school_calculator_viewed'),
    'school_reference_searches',count(*) filter (where event_name='school_reference_search'),
    'event_count',count(*)
  )
  into v_result
  from public.pilot_usage_events
  where organization_id=p_organization_id
    and occurred_at >= p_since;

  return v_result;
end;
$function$;

revoke all on function private.p1_record_pilot_usage_event_impl(uuid,text,text,text,text,integer,integer,jsonb)
from public,anon;
grant execute on function private.p1_record_pilot_usage_event_impl(uuid,text,text,text,text,integer,integer,jsonb)
to authenticated,service_role,postgres;

revoke all on function private.p1_pilot_usage_summary_impl(uuid,timestamptz)
from public,anon;
grant execute on function private.p1_pilot_usage_summary_impl(uuid,timestamptz)
to authenticated,service_role,postgres;
