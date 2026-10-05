-- PL1.11 — Save, History & Export
-- Immutable personal pricing-session snapshots for authenticated organization users.

begin;

create table public.pricing_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  price_list_version_id uuid not null references public.price_list_versions(id) on delete restrict,
  title text not null,
  pricing_mode text not null
    check (pricing_mode in ('manual','saved','target')),
  manual_discount_pct numeric(8,4) null
    check (manual_discount_pct is null or (manual_discount_pct >= 0 and manual_discount_pct <= 100)),
  target_eur_t numeric(18,6) null
    check (target_eur_t is null or target_eur_t > 0),
  currency_code text not null default 'EUR'
    check (currency_code ~ '^[A-Z]{3}$'),
  pricing_formula text not null,
  snapshot_version text not null default 'pl1.11-v1',
  list_name_snapshot text not null,
  list_code_snapshot text not null,
  manufacturer_version_snapshot text not null,
  manufacturer_revision_snapshot text null,
  source_date_snapshot date null,
  line_count integer not null check (line_count > 0),
  total_meters numeric(24,8) not null check (total_meters >= 0),
  total_tonnes numeric(24,8) not null check (total_tonnes >= 0),
  total_value numeric(24,8) not null check (total_value >= 0),
  weighted_average_eur_t numeric(24,8) null
    check (weighted_average_eur_t is null or weighted_average_eur_t >= 0),
  meters_complete boolean not null,
  tonnes_complete boolean not null,
  value_complete boolean not null,
  weighted_average_status text not null
    check (weighted_average_status in (
      'empty','incomplete_lines','missing_weight','no_tonnage','ready'
    )),
  created_at timestamptz not null default now()
);

create table public.pricing_session_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pricing_sessions(id) on delete restrict,
  line_position integer not null check (line_position >= 1),
  price_list_item_id uuid not null references public.price_list_items(id) on delete restrict,
  dimension_label_snapshot text not null,
  shape_code_snapshot text not null,
  standard_code_snapshot text null,
  grade_code_snapshot text null,
  finish_code_snapshot text null,
  thickness_mm_snapshot numeric(12,4) not null,
  note_snapshot text null,
  quantity_mode text not null check (quantity_mode in ('meters','bars','tonnes')),
  quantity numeric(24,8) not null check (quantity > 0),
  bar_length_m numeric(18,6) null check (bar_length_m is null or bar_length_m > 0),
  line_meters numeric(24,8) not null check (line_meters > 0),
  weight_kg_m_snapshot numeric(18,8) null
    check (weight_kg_m_snapshot is null or weight_kg_m_snapshot > 0),
  weight_reference_id_snapshot uuid null,
  weight_resolution_mode_snapshot text null,
  formula_version_snapshot text null,
  line_tonnes numeric(24,8) null check (line_tonnes is null or line_tonnes >= 0),
  base_eur_m_snapshot numeric(18,8) not null check (base_eur_m_snapshot >= 0),
  fixed_extra_eur_m_snapshot numeric(18,8) not null check (fixed_extra_eur_m_snapshot >= 0),
  applied_discount_pct numeric(8,4) not null check (applied_discount_pct >= 0 and applied_discount_pct <= 100),
  discount_source text not null check (discount_source in ('manual','saved_profile','target')),
  discount_profile_id uuid null references public.price_discount_profiles(id) on delete set null,
  net_eur_m numeric(18,8) not null check (net_eur_m >= 0),
  net_eur_t numeric(24,8) null check (net_eur_t is null or net_eur_t >= 0),
  line_total numeric(24,8) not null check (line_total >= 0),
  price_per_t_ready_snapshot boolean not null,
  price_per_t_status_snapshot text not null,
  source_locator_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(session_id,line_position),
  unique(session_id,price_list_item_id)
);

create index pricing_sessions_owner_history_idx
  on public.pricing_sessions(owner_user_id,created_at desc);

create index pricing_sessions_org_history_idx
  on public.pricing_sessions(organization_id,created_at desc);

create index pricing_sessions_version_idx
  on public.pricing_sessions(price_list_version_id,created_at desc);

create index pricing_session_lines_session_idx
  on public.pricing_session_lines(session_id,line_position);

create index pricing_session_lines_item_idx
  on public.pricing_session_lines(price_list_item_id);

create index pricing_session_lines_profile_idx
  on public.pricing_session_lines(discount_profile_id)
  where discount_profile_id is not null;

alter table public.pricing_sessions enable row level security;
alter table public.pricing_session_lines enable row level security;

revoke all on public.pricing_sessions from anon;
revoke all on public.pricing_session_lines from anon;
revoke all on public.pricing_sessions from authenticated;
revoke all on public.pricing_session_lines from authenticated;

grant select,insert on public.pricing_sessions to authenticated;
grant select,insert on public.pricing_session_lines to authenticated;

create policy pricing_sessions_select_own
on public.pricing_sessions
for select to authenticated
using (
  owner_user_id=(select auth.uid())
  and public.is_organization_member(organization_id,false)
);

create policy pricing_sessions_insert_own
on public.pricing_sessions
for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and public.is_organization_member(organization_id,true)
);

create policy pricing_session_lines_select_own
on public.pricing_session_lines
for select to authenticated
using (
  exists (
    select 1
    from public.pricing_sessions s
    where s.id=pricing_session_lines.session_id
      and s.owner_user_id=(select auth.uid())
      and public.is_organization_member(s.organization_id,false)
  )
);

create policy pricing_session_lines_insert_own
on public.pricing_session_lines
for insert to authenticated
with check (
  exists (
    select 1
    from public.pricing_sessions s
    where s.id=pricing_session_lines.session_id
      and s.owner_user_id=(select auth.uid())
      and public.is_organization_member(s.organization_id,true)
  )
);

create or replace function private.pl1_pricing_snapshot_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'PL1.11 pricing snapshots are immutable'
    using errcode='55000';
end;
$$;

revoke all on function private.pl1_pricing_snapshot_immutable()
from public,anon,authenticated;

create trigger pricing_sessions_immutable
before update or delete on public.pricing_sessions
for each row execute function private.pl1_pricing_snapshot_immutable();

create trigger pricing_session_lines_immutable
before update or delete on public.pricing_session_lines
for each row execute function private.pl1_pricing_snapshot_immutable();

create or replace function public.pl1_create_pricing_session_snapshot(
  p_session jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
  v_session_id uuid := gen_random_uuid();
  v_line jsonb;
  v_line_count integer;
begin
  if v_user_id is null then
    raise exception 'PL1.11 authentication required'
      using errcode='42501';
  end if;

  v_organization_id := public.default_organization_for_user(v_user_id);

  if v_organization_id is null
     or not public.is_organization_member(v_organization_id,true) then
    raise exception 'PL1.11 active organization write membership required'
      using errcode='42501';
  end if;

  if jsonb_typeof(p_lines)<>'array' then
    raise exception 'PL1.11 lines must be a JSON array'
      using errcode='22023';
  end if;

  v_line_count := jsonb_array_length(p_lines);
  if v_line_count<1 or v_line_count>500 then
    raise exception 'PL1.11 line count must be between 1 and 500'
      using errcode='22023';
  end if;

  if coalesce((p_session->>'line_count')::integer,-1)<>v_line_count then
    raise exception 'PL1.11 session line_count mismatch'
      using errcode='22023';
  end if;

  insert into public.pricing_sessions(
    id,
    organization_id,
    owner_user_id,
    price_list_version_id,
    title,
    pricing_mode,
    manual_discount_pct,
    target_eur_t,
    currency_code,
    pricing_formula,
    snapshot_version,
    list_name_snapshot,
    list_code_snapshot,
    manufacturer_version_snapshot,
    manufacturer_revision_snapshot,
    source_date_snapshot,
    line_count,
    total_meters,
    total_tonnes,
    total_value,
    weighted_average_eur_t,
    meters_complete,
    tonnes_complete,
    value_complete,
    weighted_average_status
  ) values (
    v_session_id,
    v_organization_id,
    v_user_id,
    (p_session->>'price_list_version_id')::uuid,
    left(coalesce(nullif(btrim(p_session->>'title'),''),'Distinta salvata'),160),
    p_session->>'pricing_mode',
    nullif(p_session->>'manual_discount_pct','')::numeric,
    nullif(p_session->>'target_eur_t','')::numeric,
    coalesce(nullif(p_session->>'currency_code',''),'EUR'),
    p_session->>'pricing_formula',
    'pl1.11-v1',
    p_session->>'list_name_snapshot',
    p_session->>'list_code_snapshot',
    p_session->>'manufacturer_version_snapshot',
    nullif(p_session->>'manufacturer_revision_snapshot',''),
    nullif(p_session->>'source_date_snapshot','')::date,
    v_line_count,
    (p_session->>'total_meters')::numeric,
    (p_session->>'total_tonnes')::numeric,
    (p_session->>'total_value')::numeric,
    nullif(p_session->>'weighted_average_eur_t','')::numeric,
    (p_session->>'meters_complete')::boolean,
    (p_session->>'tonnes_complete')::boolean,
    (p_session->>'value_complete')::boolean,
    p_session->>'weighted_average_status'
  );

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.pricing_session_lines(
      session_id,
      line_position,
      price_list_item_id,
      dimension_label_snapshot,
      shape_code_snapshot,
      standard_code_snapshot,
      grade_code_snapshot,
      finish_code_snapshot,
      thickness_mm_snapshot,
      note_snapshot,
      quantity_mode,
      quantity,
      bar_length_m,
      line_meters,
      weight_kg_m_snapshot,
      weight_reference_id_snapshot,
      weight_resolution_mode_snapshot,
      formula_version_snapshot,
      line_tonnes,
      base_eur_m_snapshot,
      fixed_extra_eur_m_snapshot,
      applied_discount_pct,
      discount_source,
      discount_profile_id,
      net_eur_m,
      net_eur_t,
      line_total,
      price_per_t_ready_snapshot,
      price_per_t_status_snapshot,
      source_locator_snapshot
    ) values (
      v_session_id,
      (v_line->>'line_position')::integer,
      (v_line->>'price_list_item_id')::uuid,
      v_line->>'dimension_label_snapshot',
      v_line->>'shape_code_snapshot',
      nullif(v_line->>'standard_code_snapshot',''),
      nullif(v_line->>'grade_code_snapshot',''),
      nullif(v_line->>'finish_code_snapshot',''),
      (v_line->>'thickness_mm_snapshot')::numeric,
      nullif(v_line->>'note_snapshot',''),
      v_line->>'quantity_mode',
      (v_line->>'quantity')::numeric,
      nullif(v_line->>'bar_length_m','')::numeric,
      (v_line->>'line_meters')::numeric,
      nullif(v_line->>'weight_kg_m_snapshot','')::numeric,
      nullif(v_line->>'weight_reference_id_snapshot','')::uuid,
      nullif(v_line->>'weight_resolution_mode_snapshot',''),
      nullif(v_line->>'formula_version_snapshot',''),
      nullif(v_line->>'line_tonnes','')::numeric,
      (v_line->>'base_eur_m_snapshot')::numeric,
      (v_line->>'fixed_extra_eur_m_snapshot')::numeric,
      (v_line->>'applied_discount_pct')::numeric,
      v_line->>'discount_source',
      nullif(v_line->>'discount_profile_id','')::uuid,
      (v_line->>'net_eur_m')::numeric,
      nullif(v_line->>'net_eur_t','')::numeric,
      (v_line->>'line_total')::numeric,
      (v_line->>'price_per_t_ready_snapshot')::boolean,
      v_line->>'price_per_t_status_snapshot',
      coalesce(v_line->'source_locator_snapshot','{}'::jsonb)
    );
  end loop;

  return v_session_id;
end;
$$;

revoke all on function public.pl1_create_pricing_session_snapshot(jsonb,jsonb)
from public,anon;

grant execute on function public.pl1_create_pricing_session_snapshot(jsonb,jsonb)
to authenticated;

comment on table public.pricing_sessions is
  'PL1.11 immutable personal pricing-session snapshots. Source list version, formula and commercial totals are frozen at save time.';
comment on table public.pricing_session_lines is
  'PL1.11 immutable line-level pricing snapshots. Published prices, governed weight used, applied discount, quantity conversion and final values are preserved.';
comment on function public.pl1_create_pricing_session_snapshot(jsonb,jsonb) is
  'PL1.11 atomic snapshot insert for authenticated writable organization members.';

commit;
