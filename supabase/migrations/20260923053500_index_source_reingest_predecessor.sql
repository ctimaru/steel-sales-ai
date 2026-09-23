-- PA2.30.3 hardening — cover source re-ingest predecessor FK.
create index if not exists commercial_offer_source_reingests_requested_from_run_idx
  on public.commercial_offer_source_reingests(requested_from_run_id);
