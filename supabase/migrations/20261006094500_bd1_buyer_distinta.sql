-- BD1 — Buyer Distinta: private saved snapshots and supplier delivery log.

create table if not exists public.buyer_distintas (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete cascade,
  title text not null,
  currency_code text not null default 'EUR' check (currency_code='EUR'),
  line_count integer not null check (line_count > 0 and line_count <= 500),
  total_meters numeric not null default 0 check (total_meters >= 0),
  total_tonnes numeric not null default 0 check (total_tonnes >= 0),
  target_total_eur numeric not null default 0 check (target_total_eur >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_distinta_lines (
  id uuid primary key default gen_random_uuid(),
  distinta_id uuid not null references public.buyer_distintas(id) on delete cascade,
  line_position integer not null check (line_position > 0),
  description text not null,
  standard_code text null,
  grade_code text null,
  finish_code text null,
  quantity_mode text not null check (quantity_mode in ('meters','bars','tonnes')),
  quantity numeric not null check (quantity > 0),
  bar_length_m numeric null check (bar_length_m is null or bar_length_m > 0),
  weight_kg_m numeric not null check (weight_kg_m > 0),
  line_meters numeric not null check (line_meters > 0),
  line_tonnes numeric not null check (line_tonnes > 0),
  target_eur_t numeric not null check (target_eur_t > 0),
  target_eur_m numeric not null check (target_eur_m > 0),
  target_total_eur numeric not null check (target_total_eur > 0),
  note text null,
  created_at timestamptz not null default now(),
  unique(distinta_id,line_position)
);

create table if not exists public.buyer_distinta_deliveries (
  id uuid primary key default gen_random_uuid(),
  distinta_id uuid not null references public.buyer_distintas(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  recipients text[] not null,
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text null,
  status text not null check (status in ('sent','failed')),
  error_message text null,
  created_at timestamptz not null default now()
);

alter table public.buyer_distintas enable row level security;
alter table public.buyer_distinta_lines enable row level security;
alter table public.buyer_distinta_deliveries enable row level security;

revoke all on public.buyer_distintas from anon, authenticated;
revoke all on public.buyer_distinta_lines from anon, authenticated;
revoke all on public.buyer_distinta_deliveries from anon, authenticated;

grant select, insert on public.buyer_distintas to authenticated;
grant select, insert on public.buyer_distinta_lines to authenticated;
grant select, insert on public.buyer_distinta_deliveries to authenticated;

drop policy if exists buyer_distintas_owner_select on public.buyer_distintas;
create policy buyer_distintas_owner_select
on public.buyer_distintas for select to authenticated
using (owner_user_id=(select auth.uid()));

drop policy if exists buyer_distintas_owner_insert on public.buyer_distintas;
create policy buyer_distintas_owner_insert
on public.buyer_distintas for insert to authenticated
with check (owner_user_id=(select auth.uid()));

drop policy if exists buyer_distinta_lines_owner_select on public.buyer_distinta_lines;
create policy buyer_distinta_lines_owner_select
on public.buyer_distinta_lines for select to authenticated
using (
  exists (
    select 1
    from public.buyer_distintas d
    where d.id=buyer_distinta_lines.distinta_id
      and d.owner_user_id=(select auth.uid())
  )
);

drop policy if exists buyer_distinta_lines_owner_insert on public.buyer_distinta_lines;
create policy buyer_distinta_lines_owner_insert
on public.buyer_distinta_lines for insert to authenticated
with check (
  exists (
    select 1
    from public.buyer_distintas d
    where d.id=buyer_distinta_lines.distinta_id
      and d.owner_user_id=(select auth.uid())
  )
);

drop policy if exists buyer_distinta_deliveries_owner_select on public.buyer_distinta_deliveries;
create policy buyer_distinta_deliveries_owner_select
on public.buyer_distinta_deliveries for select to authenticated
using (owner_user_id=(select auth.uid()));

drop policy if exists buyer_distinta_deliveries_owner_insert on public.buyer_distinta_deliveries;
create policy buyer_distinta_deliveries_owner_insert
on public.buyer_distinta_deliveries for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and exists (
    select 1
    from public.buyer_distintas d
    where d.id=buyer_distinta_deliveries.distinta_id
      and d.owner_user_id=(select auth.uid())
  )
);

create or replace function public.buyer_create_distinta_snapshot(
  p_distinta jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id uuid;
  v_distinta_id uuid;
  v_line_count integer;
  v_row jsonb;
  v_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be an array';
  end if;

  v_line_count := jsonb_array_length(p_lines);
  if v_line_count < 1 or v_line_count > 500 then
    raise exception 'line_count out of range';
  end if;

  v_org_id := public.default_organization_for_user(v_user_id);

  insert into public.buyer_distintas(
    owner_user_id,
    organization_id,
    title,
    line_count,
    total_meters,
    total_tonnes,
    target_total_eur
  ) values (
    v_user_id,
    v_org_id,
    coalesce(nullif(btrim(p_distinta->>'title'),''),'Richiesta di offerta'),
    v_line_count,
    coalesce((p_distinta->>'total_meters')::numeric,0),
    coalesce((p_distinta->>'total_tonnes')::numeric,0),
    coalesce((p_distinta->>'target_total_eur')::numeric,0)
  )
  returning id into v_distinta_id;

  for v_row in select value from jsonb_array_elements(p_lines)
  loop
    v_position := v_position + 1;

    insert into public.buyer_distinta_lines(
      distinta_id,
      line_position,
      description,
      standard_code,
      grade_code,
      finish_code,
      quantity_mode,
      quantity,
      bar_length_m,
      weight_kg_m,
      line_meters,
      line_tonnes,
      target_eur_t,
      target_eur_m,
      target_total_eur,
      note
    ) values (
      v_distinta_id,
      v_position,
      nullif(btrim(v_row->>'description'),''),
      nullif(btrim(v_row->>'standard'),''),
      nullif(btrim(v_row->>'grade'),''),
      nullif(btrim(v_row->>'finish'),''),
      v_row->>'quantity_mode',
      (v_row->>'quantity')::numeric,
      nullif(v_row->>'bar_length_m','')::numeric,
      (v_row->>'weight_kg_m')::numeric,
      (v_row->>'line_meters')::numeric,
      (v_row->>'line_tonnes')::numeric,
      (v_row->>'target_eur_t')::numeric,
      (v_row->>'target_eur_m')::numeric,
      (v_row->>'target_total_eur')::numeric,
      nullif(btrim(v_row->>'note'),'')
    );
  end loop;

  return v_distinta_id;
end;
$$;

revoke all on function public.buyer_create_distinta_snapshot(jsonb,jsonb)
from public, anon, authenticated;
grant execute on function public.buyer_create_distinta_snapshot(jsonb,jsonb)
to authenticated;

create index if not exists buyer_distintas_owner_created_idx
  on public.buyer_distintas(owner_user_id,created_at desc);

create index if not exists buyer_distinta_lines_distinta_position_idx
  on public.buyer_distinta_lines(distinta_id,line_position);

create index if not exists buyer_distinta_deliveries_distinta_created_idx
  on public.buyer_distinta_deliveries(distinta_id,created_at desc);
