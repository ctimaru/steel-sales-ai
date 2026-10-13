-- DASH-FEED6 acceptance: aggregate, no identity or buyer disclosure.
-- Operator-only read-only query. Dashboard emits best-effort explicit clicks.
-- A click may be lost on immediate navigation; ratios are directional, not causal.
with daily as (
  select
    date_trunc('day',occurred_at at time zone 'UTC')::date as day,
    event_name,
    count(*) as actions
  from public.pilot_usage_events
  where occurred_at >= now() - interval '30 days'
    and event_name in (
      'workspace_home_viewed',
      'dashboard_news_source_opened',
      'dashboard_interest_settings_opened',
      'dashboard_network_profile_opened',
      'dashboard_marketplace_teaser_opened'
    )
  group by 1,2
)
select day,
  coalesce(sum(actions) filter(where event_name='workspace_home_viewed'),0) as home_views,
  coalesce(sum(actions) filter(where event_name='dashboard_news_source_opened'),0) as news_source_clicks,
  coalesce(sum(actions) filter(where event_name='dashboard_interest_settings_opened'),0) as settings_clicks,
  coalesce(sum(actions) filter(where event_name='dashboard_network_profile_opened'),0) as network_clicks,
  coalesce(sum(actions) filter(where event_name='dashboard_marketplace_teaser_opened'),0) as marketplace_clicks
from daily group by day order by day desc;
