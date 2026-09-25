create table if not exists public.pilot_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  started_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  label text not null default 'P1 controlled pilot',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  baseline_event_count integer not null default 0 check (baseline_event_count >= 0),
  protocol_version text not null default 'PA2.36-v1',
  created_at timestamptz not null default now(),
  check (
    (status='active' and ended_at is null)
    or (status in ('completed','cancelled') and ended_at is not null)
  )
);

create unique index if not exists pilot_runs_one_active_per_org_idx
  on public.pilot_runs(organization_id)
  where status='active';

create index if not exists pilot_runs_org_started_idx
  on public.pilot_runs(organization_id, started_at desc);

alter table public.pilot_runs enable row level security;
revoke all on table public.pilot_runs from public, anon, authenticated;
grant select,insert,update,delete on table public.pilot_runs to service_role, postgres;

create or replace function private.p1_active_pilot_run_impl(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='28000', message='authentication required';
  end if;
  if p_organization_id is null or not public.is_organization_member(p_organization_id,true) then
    raise exception using errcode='42501', message='active tenant membership required';
  end if;

  select jsonb_build_object(
    'id',r.id,
    'status',r.status,
    'label',r.label,
    'started_at',r.started_at,
    'ended_at',r.ended_at,
    'baseline_event_count',r.baseline_event_count,
    'protocol_version',r.protocol_version
  )
  into v_result
  from public.pilot_runs r
  where r.organization_id=p_organization_id
    and r.status='active'
  order by r.started_at desc
  limit 1;

  return v_result;
end;
$$;

create or replace function public.p1_active_pilot_run(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  select private.p1_active_pilot_run_impl(p_organization_id);
$$;

revoke all on function private.p1_active_pilot_run_impl(uuid) from public,anon;
grant execute on function private.p1_active_pilot_run_impl(uuid) to authenticated,service_role,postgres;
revoke all on function public.p1_active_pilot_run(uuid) from public,anon;
grant execute on function public.p1_active_pilot_run(uuid) to authenticated,service_role,postgres;
