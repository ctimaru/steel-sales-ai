-- DASH-FEED6: privacy-minimal, explicit engagement actions for pilot funnel.
-- Existing P1 auth/tenant membership and metadata-stripping guard remain unchanged.
-- No automatic impression tracking, person tracking, buyer id, URL or RFQ contents.
alter table public.pilot_usage_events drop constraint pilot_usage_events_event_name_check;
alter table public.pilot_usage_events add constraint pilot_usage_events_event_name_check
  check (event_name in (
    'search_completed',
    'product_viewed',
    'company_viewed',
    'price_history_viewed',
    'evidence_opened',
    'review_viewed',
    'correction_completed',
    'upload_completed',
    'network_directory_viewed',
    'network_profile_viewed',
    'network_saved_created',
    'network_saved_removed',
    'network_follow_created',
    'network_follow_removed',
    'network_activity_feed_opened',
    'network_activity_item_opened',
    'network_inquiry_submitted',
    'network_inquiry_state_changed',
    'marketplace_opportunity_opened',
    'workspace_home_viewed',
    'commercial_home_viewed',
    'network_search_completed',
    'marketplace_home_viewed',
    'marketplace_opportunity_viewed',
    'rfq_hub_viewed',
    'school_home_viewed',
    'school_calculator_viewed',
    'school_reference_search',
    'dashboard_news_source_opened',
    'dashboard_interest_settings_opened',
    'dashboard_network_profile_opened',
    'dashboard_marketplace_teaser_opened'
  ));

create or replace function private.p1_record_pilot_usage_event_impl(
  p_organization_id uuid, p_event_name text, p_entity_type text,
  p_entity_id text, p_outcome text, p_result_count integer,
  p_duration_ms integer, p_metadata jsonb
) returns bigint language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_id bigint;
  v_safe_metadata jsonb := '{}'::jsonb;
begin
  if v_actor is null then
    raise exception using errcode='28000',message='authentication required';
  end if;
  if p_organization_id is null or not public.is_organization_member(p_organization_id,true) then
    raise exception using errcode='42501',message='active tenant membership required';
  end if;
  if p_event_name not in (
    'search_completed',
    'product_viewed',
    'company_viewed',
    'price_history_viewed',
    'evidence_opened',
    'review_viewed',
    'correction_completed',
    'upload_completed',
    'network_directory_viewed',
    'network_profile_viewed',
    'network_saved_created',
    'network_saved_removed',
    'network_follow_created',
    'network_follow_removed',
    'network_activity_feed_opened',
    'network_activity_item_opened',
    'network_inquiry_submitted',
    'network_inquiry_state_changed',
    'workspace_home_viewed',
    'commercial_home_viewed',
    'network_search_completed',
    'marketplace_home_viewed',
    'marketplace_opportunity_viewed',
    'rfq_hub_viewed',
    'school_home_viewed',
    'school_calculator_viewed',
    'school_reference_search',
    'dashboard_news_source_opened',
    'dashboard_interest_settings_opened',
    'dashboard_network_profile_opened',
    'dashboard_marketplace_teaser_opened'
  ) then
    raise exception using errcode='22023',message='unsupported pilot event';
  end if;
  if p_outcome not in ('success','empty','error') then
    raise exception using errcode='22023',message='invalid outcome';
  end if;
  v_safe_metadata := jsonb_strip_nulls(jsonb_build_object(
    'source',p_metadata->>'source',
    'surface',p_metadata->>'surface',
    'format',p_metadata->>'format'
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
$$;

-- Descriptive pilot report, restricted to the same platform permission gates
-- used for pilot analytics. No public read endpoints are added.
-- Private, owner-scoped event counts can be read from existing Platform Pilot Analytics.
comment on function private.p1_record_pilot_usage_event_impl(
  uuid,text,text,text,text,integer,integer,jsonb
) is 'P1 usage ledger with DASH-FEED6 explicit allowlisted navigation signals; auth.uid and org membership enforced.';
