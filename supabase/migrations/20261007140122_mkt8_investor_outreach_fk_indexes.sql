
create index if not exists investor_outreach_targets_created_by_idx
  on investor_private.investor_outreach_targets(created_by);

create index if not exists investor_outreach_targets_updated_by_idx
  on investor_private.investor_outreach_targets(updated_by);

create index if not exists investor_outreach_events_created_by_idx
  on investor_private.investor_outreach_events(created_by);
