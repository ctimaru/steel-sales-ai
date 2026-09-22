-- PA2.27 follow-up: cover foreign keys used by controlled reparse execution.
create index if not exists commercial_offer_reparse_runs_queue_idx
on public.commercial_offer_reparse_runs(remediation_queue_id);

create index if not exists commercial_offer_reparse_runs_source_job_idx
on public.commercial_offer_reparse_runs(source_job_id);

create index if not exists commercial_offer_reparse_runs_requested_by_idx
on public.commercial_offer_reparse_runs(requested_by);

create index if not exists commercial_offer_reparse_candidates_run_idx
on public.commercial_offer_reparse_candidates(run_id);
