-- P5.6Aa — Pilot Cohort FK Index Hardening
-- Close the five new unindexed foreign-key advisor findings introduced by P5.6A.

create index marketplace_pilot_runs_started_by_idx
  on public.marketplace_pilot_runs(started_by);

create index marketplace_pilot_participants_network_company_idx
  on public.marketplace_pilot_participants(network_company_id)
  where network_company_id is not null;

create index marketplace_pilot_participants_added_by_idx
  on public.marketplace_pilot_participants(added_by);

create index marketplace_pilot_participant_events_organization_idx
  on public.marketplace_pilot_participant_events(organization_id,event_sequence);

create index marketplace_pilot_participant_events_actor_idx
  on public.marketplace_pilot_participant_events(actor_user_id,event_sequence);
