create table if not exists public.sample_ingest_gateway (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  batch_token text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.sample_ingest_gateway enable row level security;
revoke all on public.sample_ingest_gateway from anon, authenticated;
grant insert on public.sample_ingest_gateway to anon;
create policy "temporary_sample_ingest_insert" on public.sample_ingest_gateway
for insert to anon
with check (batch_token = 'WllV30fbM5gckF60qe2F8p22KRWp94bClPvfBDLum05aklSjIRQPe31e4-tBnTM7');