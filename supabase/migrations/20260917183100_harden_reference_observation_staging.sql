-- P1.15 / SK4.1 hardening: raw catalog observations are ingestion/review staging.
-- They must not be visible to ordinary authenticated users before promotion.

drop policy if exists steel_reference_observations_authenticated_read
  on public.steel_reference_observations;

revoke select on table public.steel_reference_observations from authenticated;

comment on table public.steel_reference_observations is
  'P1.15 SK4.1 service-only source-observation staging. Raw/unreviewed catalog facts are promoted into authenticated-readable canonical reference tables only after review.';
