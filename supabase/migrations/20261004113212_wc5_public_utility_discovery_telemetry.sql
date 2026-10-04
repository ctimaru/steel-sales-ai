-- WC5 — Homepage Shortcut & Public Discovery
-- Privacy-minimal public utility telemetry for calculator discovery.
-- No user id, organization id, calculator input, email or commercial payload is stored.

create table if not exists public.public_utility_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  source text not null default 'direct',
  surface text not null default 'unknown',
  occurred_at timestamptz not null default now(),
  constraint public_utility_events_event_name_check
    check (event_name in ('calculator_opened')),
  constraint public_utility_events_source_check
    check (source in ('direct','home','school')),
  constraint public_utility_events_surface_check
    check (surface in ('direct','header','hero','quick_actions','school_section','nav','home_card'))
);

alter table public.public_utility_events enable row level security;

revoke all on table public.public_utility_events from public, anon, authenticated;
grant insert (event_name, source, surface) on table public.public_utility_events to anon, authenticated;

drop policy if exists "public utility event insert" on public.public_utility_events;
create policy "public utility event insert"
on public.public_utility_events
for insert
to anon, authenticated
with check (
  event_name = 'calculator_opened'
  and source in ('direct','home','school')
  and surface in ('direct','header','hero','quick_actions','school_section','nav','home_card')
);

create index if not exists public_utility_events_occurred_at_idx
  on public.public_utility_events (occurred_at desc);

create index if not exists public_utility_events_funnel_idx
  on public.public_utility_events (event_name, source, surface, occurred_at desc);

comment on table public.public_utility_events is
  'WC5 privacy-minimal public utility discovery telemetry. Stores no user, organization, calculator input, IP, email, or commercial payload.';
