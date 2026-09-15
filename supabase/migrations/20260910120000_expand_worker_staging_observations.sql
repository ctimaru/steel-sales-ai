-- Reconcile the original worker staging table with the v3.1 observation shape.
-- Idempotent by design so existing production databases are unaffected.

alter table public.worker_staging_observations
  add column if not exists outer_diameter_mm numeric,
  add column if not exists width_mm numeric,
  add column if not exists height_mm numeric,
  add column if not exists thickness_mm numeric,
  add column if not exists length_mm numeric,
  add column if not exists quantity_unit text,
  add column if not exists price_value numeric,
  add column if not exists price_unit text,
  add column if not exists availability_status text;

-- Preserve compatibility with the original generic fields while the worker
-- writes only the canonical v3.1 columns.
