-- P5.3b — Entitlement FK Index Hardening
-- Add dedicated covering indexes for P5.3 foreign keys reported by the
-- Supabase performance advisor.

create index marketplace_entitlement_events_request_idx
  on public.marketplace_entitlement_events(request_id)
  where request_id is not null;

create index marketplace_entitlement_events_actor_user_idx
  on public.marketplace_entitlement_events(actor_user_id)
  where actor_user_id is not null;

create index marketplace_unlocks_entitlement_event_idx
  on public.marketplace_unlocks(entitlement_event_id);

create index marketplace_unlocks_unlocked_by_user_idx
  on public.marketplace_unlocks(unlocked_by_user_id);
