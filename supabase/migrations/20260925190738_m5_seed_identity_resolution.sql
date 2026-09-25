create table public.network_seed_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  description text not null,
  source_policy text not null,
  seed_status text not null default 'applied',
  created_at timestamptz not null default now(),

  constraint network_seed_batches_batch_key_check
    check (char_length(btrim(batch_key)) between 1 and 120),
  constraint network_seed_batches_description_check
    check (char_length(btrim(description)) between 1 and 1000),
  constraint network_seed_batches_source_policy_check
    check (char_length(btrim(source_policy)) between 1 and 2000),
  constraint network_seed_batches_status_check
    check (seed_status in ('planned','applied','superseded','withdrawn'))
);

alter table public.network_seed_batches enable row level security;
revoke all on table public.network_seed_batches from public, anon, authenticated;
grant select,insert,update,delete on table public.network_seed_batches to service_role;

alter table public.network_data_assertions
  add column seed_batch_id uuid null
    references public.network_seed_batches(id) on delete restrict;

create index network_data_assertions_seed_batch_idx
  on public.network_data_assertions (seed_batch_id)
  where seed_batch_id is not null;

alter table public.network_data_assertions
  drop constraint network_data_assertions_source_type_check;

alter table public.network_data_assertions
  add constraint network_data_assertions_source_type_check
  check (source_type in (
    'platform_curated','company_declared','public_web','document',
    'registration_application','manual_review','system_derived','imported_seed'
  ));

create table public.network_identity_resolution_candidates (
  id uuid primary key default gen_random_uuid(),
  company_a_id uuid not null references public.network_companies(id) on delete restrict,
  company_b_id uuid not null references public.network_companies(id) on delete restrict,
  signals jsonb not null,
  match_score numeric(5,4) not null,
  status text not null default 'open',
  is_active boolean not null default true,
  generated_at timestamptz not null default now(),
  last_evaluated_at timestamptz not null default now(),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint network_identity_resolution_candidates_pair_order_check
    check (company_a_id < company_b_id),
  constraint network_identity_resolution_candidates_score_check
    check (match_score > 0 and match_score <= 1),
  constraint network_identity_resolution_candidates_signals_check
    check (
      jsonb_typeof(signals) = 'array'
      and jsonb_array_length(signals) >= 1
      and pg_column_size(signals) <= 4096
    ),
  constraint network_identity_resolution_candidates_status_check
    check (status in ('open','confirmed_match','dismissed')),
  constraint network_identity_resolution_candidates_review_check
    check (
      (status = 'open' and reviewed_by is null and reviewed_at is null)
      or
      (status in ('confirmed_match','dismissed') and reviewed_by is not null and reviewed_at is not null)
    ),
  constraint network_identity_resolution_candidates_note_check
    check (review_note is null or char_length(review_note) <= 2000),
  constraint network_identity_resolution_candidates_pair_unique
    unique (company_a_id, company_b_id)
);

create index network_identity_resolution_candidates_status_idx
  on public.network_identity_resolution_candidates (status, is_active, match_score desc);

create index network_identity_resolution_candidates_company_a_idx
  on public.network_identity_resolution_candidates (company_a_id);

create index network_identity_resolution_candidates_company_b_idx
  on public.network_identity_resolution_candidates (company_b_id);

alter table public.network_identity_resolution_candidates enable row level security;
revoke all on table public.network_identity_resolution_candidates from public, anon, authenticated;
grant select,insert,update,delete on table public.network_identity_resolution_candidates to service_role;

create or replace function private.m5_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.m5_touch_updated_at() from public, anon, authenticated;

create trigger network_identity_resolution_candidates_touch_updated_at
before update on public.network_identity_resolution_candidates
for each row execute function private.m5_touch_updated_at();

create or replace function private.m5_refresh_identity_candidates_impl()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_upserted integer := 0;
  v_active integer := 0;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required'
      using errcode = '42501';
  end if;

  update public.network_identity_resolution_candidates
  set
    is_active = false,
    last_evaluated_at = now()
  where is_active = true;

  with pair_signals as (
    select
      a.id as company_a_id,
      b.id as company_b_id,
      array_remove(array[
        case
          when a.country_code = b.country_code
           and nullif(lower(btrim(a.vat_id)), '') is not null
           and lower(btrim(a.vat_id)) = lower(btrim(b.vat_id))
          then 'country_vat_exact'
        end,
        case
          when a.country_code = b.country_code
           and nullif(lower(btrim(a.registration_id)), '') is not null
           and lower(btrim(a.registration_id)) = lower(btrim(b.registration_id))
          then 'country_registration_exact'
        end,
        case
          when nullif(lower(btrim(a.website_domain)), '') is not null
           and lower(btrim(a.website_domain)) = lower(btrim(b.website_domain))
          then 'website_domain_exact'
        end,
        case
          when a.country_code = b.country_code
           and a.normalized_legal_name = b.normalized_legal_name
          then 'country_normalized_legal_name_exact'
        end
      ], null)::text[] as signals,
      greatest(
        case
          when a.country_code = b.country_code
           and nullif(lower(btrim(a.vat_id)), '') is not null
           and lower(btrim(a.vat_id)) = lower(btrim(b.vat_id))
          then 1.0000 else 0 end,
        case
          when a.country_code = b.country_code
           and nullif(lower(btrim(a.registration_id)), '') is not null
           and lower(btrim(a.registration_id)) = lower(btrim(b.registration_id))
          then 0.9800 else 0 end,
        case
          when nullif(lower(btrim(a.website_domain)), '') is not null
           and lower(btrim(a.website_domain)) = lower(btrim(b.website_domain))
          then 0.8500 else 0 end,
        case
          when a.country_code = b.country_code
           and a.normalized_legal_name = b.normalized_legal_name
          then 0.7500 else 0 end
      )::numeric(5,4) as match_score
    from public.network_companies a
    join public.network_companies b
      on a.id < b.id
    where a.publication_status <> 'archived'
      and b.publication_status <> 'archived'
  ),
  matches as (
    select
      company_a_id,
      company_b_id,
      to_jsonb(signals) as signals,
      match_score
    from pair_signals
    where cardinality(signals) > 0
      and match_score > 0
  ),
  upserted as (
    insert into public.network_identity_resolution_candidates(
      company_a_id,
      company_b_id,
      signals,
      match_score,
      status,
      is_active,
      generated_at,
      last_evaluated_at
    )
    select
      company_a_id,
      company_b_id,
      signals,
      match_score,
      'open',
      true,
      now(),
      now()
    from matches
    on conflict (company_a_id, company_b_id)
    do update set
      signals = excluded.signals,
      match_score = excluded.match_score,
      is_active = true,
      last_evaluated_at = now()
    returning 1
  )
  select count(*) into v_upserted from upserted;

  select count(*) into v_active
  from public.network_identity_resolution_candidates
  where is_active = true;

  return jsonb_build_object(
    'upserted_candidates', v_upserted,
    'active_candidates', v_active,
    'automatic_merge_performed', false
  );
end;
$function$;

revoke all on function private.m5_refresh_identity_candidates_impl()
from public, anon;
grant execute on function private.m5_refresh_identity_candidates_impl()
to authenticated, service_role;

create or replace function public.m5_refresh_identity_candidates()
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.m5_refresh_identity_candidates_impl();
$function$;

revoke all on function public.m5_refresh_identity_candidates()
from public, anon;
grant execute on function public.m5_refresh_identity_candidates()
to authenticated, service_role;

create or replace function private.m5_review_identity_candidate_impl(
  p_candidate_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_row public.network_identity_resolution_candidates%rowtype;
  v_note text;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required'
      using errcode = '42501';
  end if;

  if p_decision not in ('confirmed_match','dismissed') then
    raise exception 'invalid identity candidate decision'
      using errcode = '22023';
  end if;

  v_note := nullif(btrim(p_note), '');
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'review note exceeds 2000 characters'
      using errcode = '22023';
  end if;

  select *
  into v_row
  from public.network_identity_resolution_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'identity candidate not found'
      using errcode = 'P0002';
  end if;

  if v_row.status <> 'open' then
    raise exception 'only open identity candidates can be reviewed'
      using errcode = '22023';
  end if;

  update public.network_identity_resolution_candidates
  set
    status = p_decision,
    reviewed_by = v_user_id,
    reviewed_at = now(),
    review_note = v_note
  where id = p_candidate_id
  returning * into v_row;

  return jsonb_build_object(
    'candidate_id', v_row.id,
    'company_a_id', v_row.company_a_id,
    'company_b_id', v_row.company_b_id,
    'status', v_row.status,
    'merge_performed', false
  );
end;
$function$;

revoke all on function private.m5_review_identity_candidate_impl(uuid,text,text)
from public, anon;
grant execute on function private.m5_review_identity_candidate_impl(uuid,text,text)
to authenticated, service_role;

create or replace function public.m5_review_identity_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.m5_review_identity_candidate_impl(p_candidate_id,p_decision,p_note);
$function$;

revoke all on function public.m5_review_identity_candidate(uuid,text,text)
from public, anon;
grant execute on function public.m5_review_identity_candidate(uuid,text,text)
to authenticated, service_role;

insert into public.network_seed_batches(
  id,
  batch_key,
  description,
  source_policy,
  seed_status
)
values (
  '50000000-0000-5000-8000-000000000001'::uuid,
  'm5-launch-public-official-2026-09-25',
  'M5 launch seed: three steel-industry legal entities from official public sources.',
  'Only official company-controlled or company-published sources. Seeded profiles remain pending_review and unverified. No tenant-private Commercial Memory is used.',
  'applied'
);

insert into public.network_companies(
  id,
  legal_name,
  country_code,
  website_url,
  website_domain,
  publication_status,
  claimed_status,
  verification_status
)
values
(
  '51000000-0000-5000-8000-000000000001'::uuid,
  'Marcegaglia Carbon Steel S.p.A.',
  'IT',
  'https://www.marcegaglia.com/officialwebsite/en/',
  'marcegaglia.com',
  'pending_review',
  'unclaimed',
  'unverified'
),
(
  '51000000-0000-5000-8000-000000000002'::uuid,
  'Marcegaglia Specialties S.p.A.',
  'IT',
  'https://www.marcegaglia.com/officialwebsite/en/',
  'marcegaglia.com',
  'pending_review',
  'unclaimed',
  'unverified'
),
(
  '51000000-0000-5000-8000-000000000003'::uuid,
  'Dalmine S.p.A.',
  'IT',
  'https://www.tenaris.com/en',
  'tenaris.com',
  'pending_review',
  'unclaimed',
  'unverified'
);

insert into public.network_data_assertions(
  id, entity_type, entity_id, field_path, asserted_value,
  source_type, source_reference, ownership_type, asserted_by,
  confidence, review_state, seed_batch_id
)
values
(
  '52000000-0000-5000-8000-000000000001'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000001'::uuid,
  'legal_name',
  to_jsonb('Marcegaglia Carbon Steel S.p.A.'::text),
  'imported_seed',
  'https://www.publications.marcegaglia.com/doc/marcegaglia-carbon-steel-s-p-a/',
  'platform_curated',
  null,
  0.9500,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
),
(
  '52000000-0000-5000-8000-000000000002'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000001'::uuid,
  'country_code',
  to_jsonb('IT'::text),
  'imported_seed',
  'https://www.publications.marcegaglia.com/doc/marcegaglia-carbon-steel-s-p-a/',
  'platform_curated',
  null,
  0.9500,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
),
(
  '52000000-0000-5000-8000-000000000003'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000001'::uuid,
  'website_domain',
  to_jsonb('marcegaglia.com'::text),
  'imported_seed',
  'https://www.marcegaglia.com/officialwebsite/en/',
  'platform_curated',
  null,
  0.9000,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
),
(
  '52000000-0000-5000-8000-000000000004'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000002'::uuid,
  'legal_name',
  to_jsonb('Marcegaglia Specialties S.p.A.'::text),
  'imported_seed',
  'https://www.publications.marcegaglia.com/doc/marcegaglia-specialties-s-p-a/',
  'platform_curated',
  null,
  0.9500,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
),
(
  '52000000-0000-5000-8000-000000000005'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000002'::uuid,
  'country_code',
  to_jsonb('IT'::text),
  'imported_seed',
  'https://www.publications.marcegaglia.com/doc/marcegaglia-specialties-s-p-a/',
  'platform_curated',
  null,
  0.9500,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
),
(
  '52000000-0000-5000-8000-000000000006'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000002'::uuid,
  'website_domain',
  to_jsonb('marcegaglia.com'::text),
  'imported_seed',
  'https://www.marcegaglia.com/officialwebsite/en/',
  'platform_curated',
  null,
  0.9000,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
),
(
  '52000000-0000-5000-8000-000000000007'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000003'::uuid,
  'legal_name',
  to_jsonb('Dalmine S.p.A.'::text),
  'imported_seed',
  'https://www.tenaris.com/media/i4nbasbp/certificato-50001.pdf',
  'platform_curated',
  null,
  0.9500,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
),
(
  '52000000-0000-5000-8000-000000000008'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000003'::uuid,
  'country_code',
  to_jsonb('IT'::text),
  'imported_seed',
  'https://www.tenaris.com/media/i4nbasbp/certificato-50001.pdf',
  'platform_curated',
  null,
  0.9500,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
),
(
  '52000000-0000-5000-8000-000000000009'::uuid,
  'company',
  '51000000-0000-5000-8000-000000000003'::uuid,
  'website_domain',
  to_jsonb('tenaris.com'::text),
  'imported_seed',
  'https://www.tenaris.com/en',
  'platform_curated',
  null,
  0.9000,
  'accepted',
  '50000000-0000-5000-8000-000000000001'::uuid
);

comment on table public.network_seed_batches is
  'M5 controlled seed batch registry. Seed sources must be public/approved and never silently sourced from tenant-private Commercial Memory.';
comment on table public.network_identity_resolution_candidates is
  'M5 identity resolution review queue. Candidate signals never trigger an automatic company merge.';
comment on function public.m5_refresh_identity_candidates() is
  'Superadmin-only candidate generation using PB6 identity signals. Performs no merge.';
comment on function public.m5_review_identity_candidate(uuid,text,text) is
  'Superadmin-only review decision. confirmed_match is evidence for later resolution; M5 performs no merge.';
