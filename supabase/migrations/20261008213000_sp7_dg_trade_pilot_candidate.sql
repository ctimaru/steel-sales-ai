-- SP7: first official EU news feed candidate. Candidate != permission to ingest/publish.
-- Mirrors the manually registered production candidate, without changing its
-- status if human reviewers subsequently approve/suspend it.
insert into steel_pulse_private.sources (
  id, display_name, origin_url, allowed_hosts, channel, status,
  license_basis, approved_operations, feed_url, policy_url, fetch_interval_minutes
)
values (
  'ec_dg_trade',
  'Commissione europea · DG Trade',
  'https://policy.trade.ec.europa.eu/news_en',
  array['policy.trade.ec.europa.eu']::text[],
  'press_room', 'candidate', 'unverified', '{}'::text[],
  'https://policy.trade.ec.europa.eu/node/2/rss_en',
  'https://commission.europa.eu/legal-notice_en',
  1440
)
on conflict (id) do nothing;

comment on table steel_pulse_private.sources is
'SP7 production pilot: only human-reviewed sources can move from candidate to approved; an EU-wide legal notice is not by itself an item-specific rights approval.';
