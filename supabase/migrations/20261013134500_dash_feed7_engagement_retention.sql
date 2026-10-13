-- DASH-FEED7 — owner-only aggregate engagement/returning-user evidence.
-- Authenticated callers never receive row-level actor IDs, emails, URLs,
-- organization identifiers, private RFQs, or raw usage events.
-- D+1/D+7: first *observed* Home day + exact UTC calendar day, NOT account signup.
-- A cohort with fewer than ten mature subjects never exposes a rate.
create index if not exists pilot_usage_events_home_actor_day_idx
  on public.pilot_usage_events(actor_user_id,occurred_at)
  where event_name='workspace_home_viewed';

create or replace function public.dash_feed7_platform_insights(p_days integer default 30)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $fn$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_start date;
  v_payload jsonb;
begin
  if not private.is_platform_superadmin() then
    raise exception using errcode='42501',message='platform superadmin required';
  end if;
  if p_days is null or p_days not in (7,30) then
    raise exception using errcode='22023',message='invalid insight window';
  end if;
  v_start := v_today - (p_days-1);

  with
  all_home_days as (
    select e.actor_user_id,
      (e.occurred_at at time zone 'UTC')::date as day
    from public.pilot_usage_events e
    where e.event_name='workspace_home_viewed'
      and e.actor_user_id is not null
  ),
  first_home as (
    select actor_user_id,min(day) first_day
    from all_home_days group by actor_user_id
  ),
  cohort_flags as (
    select f.actor_user_id,f.first_day,
      exists (
        select 1 from all_home_days d
        where d.actor_user_id=f.actor_user_id and d.day=f.first_day+1
      ) as returned_d1,
      exists (
        select 1 from all_home_days d
        where d.actor_user_id=f.actor_user_id and d.day=f.first_day+7
      ) as returned_d7
    from first_home f
    where f.first_day between v_start and v_today
  ),
  cohort_totals as (
    select count(*) filter(where first_day<=v_today-1) as d1_eligible,
      count(*) filter(where first_day<=v_today-1 and returned_d1) as d1_returned,
      count(*) filter(where first_day<=v_today-7) as d7_eligible,
      count(*) filter(where first_day<=v_today-7 and returned_d7) as d7_returned
    from cohort_flags
  ),
  recent as (
    select e.id,e.actor_user_id,e.event_name,
      (e.occurred_at at time zone 'UTC')::date as day
    from public.pilot_usage_events e
    where e.occurred_at >= (v_start::timestamp at time zone 'UTC')
      and e.occurred_at < ((v_today+1)::timestamp at time zone 'UTC')
      and e.event_name in (
        'workspace_home_viewed','dashboard_news_source_opened',
        'dashboard_interest_settings_opened','dashboard_network_profile_opened',
        'dashboard_marketplace_teaser_opened'
      )
  ),
  home_actors as (
    select actor_user_id,count(distinct day) as active_days
    from recent
    where event_name='workspace_home_viewed'
    group by actor_user_id
  ),
  total as (
    select
      count(*) filter(where event_name='workspace_home_viewed') as home_views,
      count(distinct day) filter(where event_name='workspace_home_viewed') as observed_home_days,
      count(*) filter(where event_name='dashboard_news_source_opened') as news_source,
      count(*) filter(where event_name='dashboard_interest_settings_opened') as interests,
      count(*) filter(where event_name='dashboard_network_profile_opened') as network_profiles,
      count(*) filter(where event_name='dashboard_marketplace_teaser_opened') as opportunities
    from recent
  ),
  daily as (
    select days.day::date as day,
      count(r.id) filter(where r.event_name='workspace_home_viewed') as home_views,
      count(distinct r.actor_user_id) filter(where r.event_name='workspace_home_viewed') as active_users,
      count(r.id) filter(where r.event_name='dashboard_news_source_opened') as news_source,
      count(r.id) filter(where r.event_name='dashboard_interest_settings_opened') as interests,
      count(r.id) filter(where r.event_name='dashboard_network_profile_opened') as network_profiles,
      count(r.id) filter(where r.event_name='dashboard_marketplace_teaser_opened') as opportunities
    from generate_series(v_start::timestamp,v_today::timestamp,'1 day'::interval) days(day)
    left join recent r on r.day=days.day::date
    group by days.day
  )
  select jsonb_build_object(
    'contract','DASH-FEED7-v1','window_days',p_days,'as_of_day',v_today,
    'first_observed_home_day',(select min(first_day) from first_home),
    'home_views',t.home_views,
    'unique_home_users',(select count(*) from home_actors),
    'returning_home_users',(select count(*) from home_actors where active_days>=2),
    'observed_home_days',t.observed_home_days,
    'actions',jsonb_build_object(
      'news_source',t.news_source,'interests',t.interests,
      'network_profiles',t.network_profiles,'opportunities',t.opportunities),
    'd1',jsonb_build_object(
      'eligible',c.d1_eligible,'returned',c.d1_returned,
      'rate_percent',case when c.d1_eligible>=10
        then round(100.0*c.d1_returned/nullif(c.d1_eligible,0),1) else null end),
    'd7',jsonb_build_object(
      'eligible',c.d7_eligible,'returned',c.d7_returned,
      'rate_percent',case when c.d7_eligible>=10
        then round(100.0*c.d7_returned/nullif(c.d7_eligible,0),1) else null end),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object(
      'day',d.day,'home_views',d.home_views,'active_users',d.active_users,
      'news_source',d.news_source,'interests',d.interests,
      'network_profiles',d.network_profiles,'opportunities',d.opportunities
    ) order by d.day),'[]'::jsonb) from daily d)
  )
  into v_payload
  from total t cross join cohort_totals c;

  return v_payload;
end;
$fn$;

revoke all on function public.dash_feed7_platform_insights(integer)
from public,anon,authenticated;
grant execute on function public.dash_feed7_platform_insights(integer) to authenticated;
comment on function public.dash_feed7_platform_insights(integer)
is 'DASH-FEED7 owner-only aggregate pilot Home insights; no actor IDs; D+1/D+7 rates suppressed below 10 mature users.';
