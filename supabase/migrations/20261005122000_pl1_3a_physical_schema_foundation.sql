-- PL1.3A — Physical Schema Foundation
-- Smart Steel Sales — Interactive Price Lists
-- Contract basis: PL1.1 + PL1.2 + PL1.3

begin;

create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  publisher_company_id uuid not null references public.network_companies(id) on delete restrict,
  code text not null,
  name text not null,
  product_family_id uuid null references public.network_product_families(id) on delete set null,
  currency_code text not null default 'EUR'
    check (currency_code ~ '^[A-Z]{3}$'),
  default_price_unit text not null default 'per_m'
    check (default_price_unit in ('per_m','per_t','per_kg','per_piece')),
  source_terms_raw text null,
  status text not null default 'active'
    check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publisher_company_id, code)
);

create table public.price_list_source_governance_events (
  id uuid primary key default gen_random_uuid(),
  knowledge_source_id uuid not null references public.knowledge_sources(id) on delete restrict,
  knowledge_document_id uuid null references public.knowledge_documents(id) on delete restrict,
  decision_type text not null default 'publication_rights'
    check (decision_type in ('publication_rights','licence_review','source_restriction','correction')),
  decision text not null
    check (decision in ('pending_review','approved_public','approved_authenticated','internal_only','blocked')),
  raw_document_visibility text not null default 'internal'
    check (raw_document_visibility in ('public','authenticated','internal','blocked')),
  structured_data_visibility text not null default 'internal'
    check (structured_data_visibility in ('public','authenticated','internal','blocked')),
  attribution_requirement text null,
  terms_reference text null,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rationale text null,
  decided_by uuid null default auth.uid(),
  decided_at timestamptz not null default now(),
  supersedes_event_id uuid null references public.price_list_source_governance_events(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.price_list_versions (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete restrict,
  primary_source_document_id uuid not null references public.knowledge_documents(id) on delete restrict,
  manufacturer_version_code text not null,
  manufacturer_revision_code text null,
  source_date date null,
  valid_from date null,
  valid_to date null,
  platform_revision integer not null default 1 check (platform_revision >= 1),
  status text not null default 'draft'
    check (status in ('draft','review','verified','published','superseded','withdrawn')),
  supersedes_version_id uuid null references public.price_list_versions(id) on delete restrict,
  supersession_reason text null
    check (supersession_reason is null or supersession_reason in (
      'new_manufacturer_release','source_correction','platform_correction','withdrawal'
    )),
  publication_scope text not null default 'internal'
    check (publication_scope in ('internal','authenticated','public')),
  calculation_contract_version text not null default 'pl1.1-v1',
  withdrawal_reason text null,
  created_by uuid null default auth.uid(),
  published_by uuid null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  check (supersedes_version_id is null or supersedes_version_id <> id),
  unique (price_list_id, manufacturer_version_code, platform_revision)
);

create unique index price_list_versions_one_current_scope_uq
  on public.price_list_versions(price_list_id, publication_scope)
  where status = 'published';

create table public.price_list_version_documents (
  id uuid primary key default gen_random_uuid(),
  price_list_version_id uuid not null references public.price_list_versions(id) on delete cascade,
  knowledge_document_id uuid not null references public.knowledge_documents(id) on delete restrict,
  document_role text not null
    check (document_role in ('supplement','correction_notice','terms','archived_copy')),
  attached_by uuid null default auth.uid(),
  attached_at timestamptz not null default now(),
  unique (price_list_version_id, knowledge_document_id, document_role)
);

create table public.price_list_sections (
  id uuid primary key default gen_random_uuid(),
  price_list_version_id uuid not null references public.price_list_versions(id) on delete cascade,
  section_key text not null,
  raw_heading text not null,
  shape_code text not null
    check (shape_code in ('circular','square','rectangular','other')),
  standard_raw text null,
  standard_code text null,
  weight_standard_key text null,
  grade_raw text null,
  grade_code text null,
  material_grade_id uuid null references public.steel_material_grades(id) on delete restrict,
  finish_raw text null,
  finish_code text null,
  manufacturing_process text null,
  currency_code text not null default 'EUR'
    check (currency_code ~ '^[A-Z]{3}$'),
  price_unit text not null default 'per_m'
    check (price_unit in ('per_m','per_t','per_kg','per_piece')),
  sort_order integer not null default 0,
  source_locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (price_list_version_id, section_key)
);

create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.price_list_sections(id) on delete cascade,
  item_key text not null,
  dimension_label_raw text not null,
  geometry_candidate_key text null,
  outer_diameter_mm numeric(12,4) null check (outer_diameter_mm is null or outer_diameter_mm > 0),
  width_mm numeric(12,4) null check (width_mm is null or width_mm > 0),
  height_mm numeric(12,4) null check (height_mm is null or height_mm > 0),
  thickness_mm numeric(12,4) not null check (thickness_mm > 0),
  note_raw text null,
  source_row_index integer null check (source_row_index is null or source_row_index > 0),
  source_row_signature text null,
  source_locator jsonb not null default '{}'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  extraction_version text null,
  status text not null default 'active'
    check (status in ('active','inactive','review_required')),
  created_at timestamptz not null default now(),
  unique (section_id, item_key)
);

create table public.price_list_components (
  id uuid primary key default gen_random_uuid(),
  price_list_item_id uuid not null references public.price_list_items(id) on delete cascade,
  component_type text not null
    check (component_type in ('base','fixed_extra','grade_extra','surface_extra','surcharge','transport','other')),
  source_label text not null,
  amount numeric(18,6) not null check (amount >= 0),
  currency_code text not null default 'EUR'
    check (currency_code ~ '^[A-Z]{3}$'),
  price_unit text not null
    check (price_unit in ('per_m','per_t','per_kg','per_piece')),
  operation text not null default 'add'
    check (operation in ('add','subtract')),
  discountable boolean not null default false,
  calculation_order integer not null default 0 check (calculation_order >= 0),
  source_locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (not (operation = 'subtract' and discountable)),
  unique (price_list_item_id, calculation_order)
);

create table public.price_rules (
  id uuid primary key default gen_random_uuid(),
  price_list_version_id uuid not null references public.price_list_versions(id) on delete cascade,
  section_id uuid null references public.price_list_sections(id) on delete cascade,
  price_list_item_id uuid null references public.price_list_items(id) on delete cascade,
  rule_type text not null
    check (rule_type in (
      'commercial_discount','conditional_adjustment','minimum_quantity',
      'logistics_discount','rounding','other'
    )),
  scope text not null
    check (scope in ('version','section','item')),
  rule_payload jsonb not null default '{}'::jsonb,
  source_text text null,
  calculation_order integer not null default 0 check (calculation_order >= 0),
  status text not null default 'active'
    check (status in ('active','inactive','review_required')),
  source_locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (scope = 'version' and section_id is null and price_list_item_id is null)
    or (scope = 'section' and section_id is not null and price_list_item_id is null)
    or (scope = 'item' and section_id is null and price_list_item_id is not null)
  )
);

create table public.price_list_item_weight_links (
  id uuid primary key default gen_random_uuid(),
  price_list_item_id uuid not null references public.price_list_items(id) on delete cascade,
  geometry_id uuid not null references public.steel_geometries(id) on delete restrict,
  material_grade_id uuid null references public.steel_material_grades(id) on delete restrict,
  weight_standard_key text null,
  geometry_match_status text not null
    check (geometry_match_status in (
      'exact_existing','exact_new_candidate','ambiguous','invalid','manual_resolved'
    )),
  geometry_match_method text not null
    check (geometry_match_method in ('geometry_key','promoted_candidate','manual')),
  weight_resolution_mode text not null
    check (weight_resolution_mode in (
      'manufacturer_published','governed_reference','standard_formula','unresolved'
    )),
  weight_reference_id uuid null references public.steel_weight_references(id) on delete restrict,
  formula_version text null,
  resolved_weight_kg_m numeric(18,6) null check (resolved_weight_kg_m is null or resolved_weight_kg_m > 0),
  resolution_status text not null default 'candidate'
    check (resolution_status in ('candidate','accepted','rejected','superseded')),
  resolution_reason text null,
  supersedes_link_id uuid null references public.price_list_item_weight_links(id) on delete restrict,
  resolved_by uuid null,
  resolved_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (supersedes_link_id is null or supersedes_link_id <> id),
  check (
    (weight_resolution_mode in ('manufacturer_published','governed_reference')
      and weight_reference_id is not null
      and resolved_weight_kg_m is not null
      and formula_version is null)
    or
    (weight_resolution_mode = 'standard_formula'
      and weight_reference_id is null
      and resolved_weight_kg_m is not null
      and formula_version is not null)
    or
    (weight_resolution_mode = 'unresolved'
      and weight_reference_id is null
      and resolved_weight_kg_m is null
      and formula_version is null)
  )
);

create unique index price_list_item_weight_links_one_accepted_uq
  on public.price_list_item_weight_links(price_list_item_id)
  where resolution_status = 'accepted';

create table public.price_list_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  price_list_version_id uuid not null references public.price_list_versions(id) on delete restrict,
  event_type text not null
    check (event_type in (
      'version_created','review_started','returned_to_draft','verification_approved',
      'verification_revoked','published','superseded','withdrawn','correction_created'
    )),
  previous_status text null,
  new_status text null,
  actor_id uuid null,
  reason text null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- FK / read-path indexes
create index price_lists_publisher_idx on public.price_lists(publisher_company_id);
create index price_lists_product_family_idx on public.price_lists(product_family_id);

create index price_list_source_governance_source_idx
  on public.price_list_source_governance_events(knowledge_source_id, decided_at desc);
create index price_list_source_governance_document_idx
  on public.price_list_source_governance_events(knowledge_document_id, decided_at desc)
  where knowledge_document_id is not null;
create index price_list_source_governance_supersedes_idx
  on public.price_list_source_governance_events(supersedes_event_id)
  where supersedes_event_id is not null;

create index price_list_versions_list_idx
  on public.price_list_versions(price_list_id, created_at desc);
create index price_list_versions_document_idx
  on public.price_list_versions(primary_source_document_id);
create index price_list_versions_supersedes_idx
  on public.price_list_versions(supersedes_version_id)
  where supersedes_version_id is not null;

create index price_list_version_documents_version_idx
  on public.price_list_version_documents(price_list_version_id);
create index price_list_version_documents_document_idx
  on public.price_list_version_documents(knowledge_document_id);

create index price_list_sections_version_idx
  on public.price_list_sections(price_list_version_id, sort_order);
create index price_list_sections_grade_idx
  on public.price_list_sections(material_grade_id)
  where material_grade_id is not null;

create index price_list_items_section_idx
  on public.price_list_items(section_id);
create index price_list_items_geometry_candidate_idx
  on public.price_list_items(geometry_candidate_key)
  where geometry_candidate_key is not null;

create index price_list_components_item_idx
  on public.price_list_components(price_list_item_id, calculation_order);

create index price_rules_version_idx
  on public.price_rules(price_list_version_id, calculation_order);
create index price_rules_section_idx
  on public.price_rules(section_id)
  where section_id is not null;
create index price_rules_item_idx
  on public.price_rules(price_list_item_id)
  where price_list_item_id is not null;

create index price_list_item_weight_links_item_idx
  on public.price_list_item_weight_links(price_list_item_id, created_at desc);
create index price_list_item_weight_links_geometry_idx
  on public.price_list_item_weight_links(geometry_id);
create index price_list_item_weight_links_grade_idx
  on public.price_list_item_weight_links(material_grade_id)
  where material_grade_id is not null;
create index price_list_item_weight_links_reference_idx
  on public.price_list_item_weight_links(weight_reference_id)
  where weight_reference_id is not null;
create index price_list_item_weight_links_supersedes_idx
  on public.price_list_item_weight_links(supersedes_link_id)
  where supersedes_link_id is not null;

create index price_list_lifecycle_events_version_idx
  on public.price_list_lifecycle_events(price_list_version_id, created_at desc);

-- Generic updated_at trigger
create or replace function private.pl1_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.pl1_touch_updated_at() from public, anon, authenticated;

create trigger price_lists_touch_updated_at
before update on public.price_lists
for each row execute function private.pl1_touch_updated_at();

create trigger price_list_versions_touch_updated_at
before update on public.price_list_versions
for each row execute function private.pl1_touch_updated_at();

-- Append-only ledger protection
create or replace function private.pl1_assert_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name
    using errcode = '55000';
end;
$$;

revoke all on function private.pl1_assert_append_only() from public, anon, authenticated;

create trigger price_list_source_governance_append_only
before update or delete on public.price_list_source_governance_events
for each row execute function private.pl1_assert_append_only();

create trigger price_list_lifecycle_events_append_only
before update or delete on public.price_list_lifecycle_events
for each row execute function private.pl1_assert_append_only();

-- Source governance consistency
create or replace function private.pl1_validate_source_governance_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_source_id uuid;
  v_previous public.price_list_source_governance_events%rowtype;
begin
  if new.knowledge_document_id is not null then
    select source_id
      into v_document_source_id
    from public.knowledge_documents
    where id = new.knowledge_document_id;

    if v_document_source_id is null or v_document_source_id <> new.knowledge_source_id then
      raise exception 'PL1 governance document/source mismatch'
        using errcode = '23514';
    end if;
  end if;

  if new.supersedes_event_id is not null then
    select *
      into v_previous
    from public.price_list_source_governance_events
    where id = new.supersedes_event_id;

    if v_previous.id is null
       or v_previous.knowledge_source_id <> new.knowledge_source_id
       or v_previous.knowledge_document_id is distinct from new.knowledge_document_id then
      raise exception 'PL1 governance supersession scope mismatch'
        using errcode = '23514';
    end if;
  end if;

  if new.decision = 'approved_public' and new.structured_data_visibility <> 'public' then
    raise exception 'approved_public requires public structured data visibility'
      using errcode = '23514';
  elsif new.decision = 'approved_authenticated' and new.structured_data_visibility <> 'authenticated' then
    raise exception 'approved_authenticated requires authenticated structured data visibility'
      using errcode = '23514';
  elsif new.decision = 'internal_only' and new.structured_data_visibility <> 'internal' then
    raise exception 'internal_only requires internal structured data visibility'
      using errcode = '23514';
  elsif new.decision = 'blocked' and new.structured_data_visibility <> 'blocked' then
    raise exception 'blocked requires blocked structured data visibility'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_validate_source_governance_event() from public, anon, authenticated;

create trigger price_list_source_governance_validate
before insert on public.price_list_source_governance_events
for each row execute function private.pl1_validate_source_governance_event();

-- Effective visibility helper; used by RLS and later public read models.
create or replace function public.pl1_version_visible_to(
  p_version_id uuid,
  p_audience text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.price_list_versions v
    join public.knowledge_documents d
      on d.id = v.primary_source_document_id
    join lateral (
      select g.decision, g.structured_data_visibility
      from public.price_list_source_governance_events g
      where g.knowledge_source_id = d.source_id
        and (g.knowledge_document_id = d.id or g.knowledge_document_id is null)
      order by g.decided_at desc, g.created_at desc, g.id desc
      limit 1
    ) g on true
    where v.id = p_version_id
      and v.status = 'published'
      and (
        (p_audience = 'public'
          and v.publication_scope = 'public'
          and g.decision = 'approved_public'
          and g.structured_data_visibility = 'public')
        or
        (p_audience = 'authenticated'
          and v.publication_scope in ('public','authenticated')
          and g.decision in ('approved_public','approved_authenticated')
          and g.structured_data_visibility in ('public','authenticated'))
      )
  );
$$;

revoke all on function public.pl1_version_visible_to(uuid, text) from public;
grant execute on function public.pl1_version_visible_to(uuid, text) to anon, authenticated;

-- Version state machine, publication gate and immutable published identity.
create or replace function private.pl1_guard_price_list_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_predecessor_list_id uuid;
  v_doc_source_id uuid;
  v_doc_checksum text;
  v_doc_algorithm text;
  v_governance_decision text;
  v_structured_visibility text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New PL1 versions must start in draft'
        using errcode = '23514';
    end if;
  elsif tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft PL1 versions may be deleted'
        using errcode = '55000';
    end if;
    return old;
  else
    if old.status is distinct from new.status then
      if not (
        (old.status = 'draft' and new.status = 'review')
        or (old.status = 'review' and new.status in ('draft','verified'))
        or (old.status = 'verified' and new.status in ('review','published'))
        or (old.status = 'published' and new.status in ('superseded','withdrawn'))
        or (old.status = 'superseded' and new.status = 'withdrawn')
      ) then
        raise exception 'Invalid PL1 version transition: % -> %', old.status, new.status
          using errcode = '23514';
      end if;
    end if;

    if old.status in ('published','superseded','withdrawn') then
      if row(
        new.price_list_id,
        new.primary_source_document_id,
        new.manufacturer_version_code,
        new.manufacturer_revision_code,
        new.source_date,
        new.valid_from,
        new.valid_to,
        new.platform_revision,
        new.supersedes_version_id,
        new.supersession_reason,
        new.publication_scope,
        new.calculation_contract_version,
        new.created_by,
        new.published_by,
        new.published_at
      ) is distinct from row(
        old.price_list_id,
        old.primary_source_document_id,
        old.manufacturer_version_code,
        old.manufacturer_revision_code,
        old.source_date,
        old.valid_from,
        old.valid_to,
        old.platform_revision,
        old.supersedes_version_id,
        old.supersession_reason,
        old.publication_scope,
        old.calculation_contract_version,
        old.created_by,
        old.published_by,
        old.published_at
      ) then
        raise exception 'Published/superseded/withdrawn PL1 version identity is immutable'
          using errcode = '55000';
      end if;
    end if;
  end if;

  if new.supersedes_version_id is not null then
    select price_list_id
      into v_predecessor_list_id
    from public.price_list_versions
    where id = new.supersedes_version_id;

    if v_predecessor_list_id is null or v_predecessor_list_id <> new.price_list_id then
      raise exception 'PL1 supersedes_version_id must belong to the same price list'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'withdrawn'
     and coalesce(btrim(new.withdrawal_reason),'') = '' then
    raise exception 'PL1 withdrawal requires a reason'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status <> 'published' and new.status = 'published' then
    select d.source_id, d.content_checksum, d.checksum_algorithm
      into v_doc_source_id, v_doc_checksum, v_doc_algorithm
    from public.knowledge_documents d
    where d.id = new.primary_source_document_id;

    if v_doc_source_id is null
       or coalesce(v_doc_checksum,'') = ''
       or lower(coalesce(v_doc_algorithm,'')) <> 'sha256' then
      raise exception 'PL1 publication requires an immutable SHA-256 source document'
        using errcode = '23514';
    end if;

    select g.decision, g.structured_data_visibility
      into v_governance_decision, v_structured_visibility
    from public.price_list_source_governance_events g
    where g.knowledge_source_id = v_doc_source_id
      and (g.knowledge_document_id = new.primary_source_document_id or g.knowledge_document_id is null)
    order by g.decided_at desc, g.created_at desc, g.id desc
    limit 1;

    if new.publication_scope = 'public' then
      if v_governance_decision <> 'approved_public'
         or v_structured_visibility <> 'public' then
        raise exception 'PL1 public publication is blocked by source governance'
          using errcode = '42501';
      end if;
    elsif new.publication_scope = 'authenticated' then
      if v_governance_decision not in ('approved_public','approved_authenticated')
         or v_structured_visibility not in ('public','authenticated') then
        raise exception 'PL1 authenticated publication is blocked by source governance'
          using errcode = '42501';
      end if;
    else
      if v_governance_decision in ('pending_review','blocked')
         or v_governance_decision is null
         or v_structured_visibility = 'blocked' then
        raise exception 'PL1 internal publication is blocked by source governance'
          using errcode = '42501';
      end if;
    end if;

    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(new.published_by, auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_guard_price_list_version() from public, anon, authenticated;

create trigger price_list_versions_guard
before insert or update or delete on public.price_list_versions
for each row execute function private.pl1_guard_price_list_version();

-- Published source snapshot guard.
create or replace function private.pl1_version_is_immutable(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select status in ('published','superseded','withdrawn')
    from public.price_list_versions
    where id = p_version_id
  ), false);
$$;

revoke all on function private.pl1_version_is_immutable(uuid) from public, anon, authenticated;

create or replace function private.pl1_guard_source_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_version_id uuid;
  v_new_version_id uuid;
begin
  if tg_table_name in ('price_list_version_documents','price_rules') then
    if tg_op <> 'INSERT' then v_old_version_id := old.price_list_version_id; end if;
    if tg_op <> 'DELETE' then v_new_version_id := new.price_list_version_id; end if;

  elsif tg_table_name = 'price_list_sections' then
    if tg_op <> 'INSERT' then v_old_version_id := old.price_list_version_id; end if;
    if tg_op <> 'DELETE' then v_new_version_id := new.price_list_version_id; end if;

  elsif tg_table_name = 'price_list_items' then
    if tg_op <> 'INSERT' then
      select s.price_list_version_id into v_old_version_id
      from public.price_list_sections s where s.id = old.section_id;
    end if;
    if tg_op <> 'DELETE' then
      select s.price_list_version_id into v_new_version_id
      from public.price_list_sections s where s.id = new.section_id;
    end if;

  elsif tg_table_name = 'price_list_components' then
    if tg_op <> 'INSERT' then
      select s.price_list_version_id into v_old_version_id
      from public.price_list_items i
      join public.price_list_sections s on s.id = i.section_id
      where i.id = old.price_list_item_id;
    end if;
    if tg_op <> 'DELETE' then
      select s.price_list_version_id into v_new_version_id
      from public.price_list_items i
      join public.price_list_sections s on s.id = i.section_id
      where i.id = new.price_list_item_id;
    end if;
  end if;

  if (v_old_version_id is not null and private.pl1_version_is_immutable(v_old_version_id))
     or (v_new_version_id is not null and private.pl1_version_is_immutable(v_new_version_id)) then
    raise exception 'Published PL1 source snapshot is immutable: %', tg_table_name
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.pl1_guard_source_child_mutation() from public, anon, authenticated;

create trigger price_list_version_documents_immutable_guard
before insert or update or delete on public.price_list_version_documents
for each row execute function private.pl1_guard_source_child_mutation();

create trigger price_list_sections_immutable_guard
before insert or update or delete on public.price_list_sections
for each row execute function private.pl1_guard_source_child_mutation();

create trigger price_list_items_immutable_guard
before insert or update or delete on public.price_list_items
for each row execute function private.pl1_guard_source_child_mutation();

create trigger price_list_components_immutable_guard
before insert or update or delete on public.price_list_components
for each row execute function private.pl1_guard_source_child_mutation();

create trigger price_rules_immutable_guard
before insert or update or delete on public.price_rules
for each row execute function private.pl1_guard_source_child_mutation();

-- Item geometry sanity.
create or replace function private.pl1_validate_item_dimensions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shape text;
begin
  select shape_code into v_shape
  from public.price_list_sections
  where id = new.section_id;

  if v_shape = 'circular' then
    if new.outer_diameter_mm is null or new.width_mm is not null or new.height_mm is not null
       or 2 * new.thickness_mm >= new.outer_diameter_mm then
      raise exception 'Invalid circular PL1 dimensions'
        using errcode = '23514';
    end if;
  elsif v_shape = 'square' then
    if new.outer_diameter_mm is not null or new.width_mm is null or new.height_mm is null
       or new.width_mm <> new.height_mm
       or 2 * new.thickness_mm >= new.width_mm then
      raise exception 'Invalid square PL1 dimensions'
        using errcode = '23514';
    end if;
  elsif v_shape = 'rectangular' then
    if new.outer_diameter_mm is not null or new.width_mm is null or new.height_mm is null
       or new.width_mm = new.height_mm
       or 2 * new.thickness_mm >= least(new.width_mm, new.height_mm) then
      raise exception 'Invalid rectangular PL1 dimensions'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_validate_item_dimensions() from public, anon, authenticated;

create trigger price_list_items_dimension_validate
before insert or update of section_id, outer_diameter_mm, width_mm, height_mm, thickness_mm
on public.price_list_items
for each row execute function private.pl1_validate_item_dimensions();

-- Rule scope must belong to its declared version.
create or replace function private.pl1_validate_rule_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_version_id uuid;
begin
  if new.scope = 'section' then
    select price_list_version_id into v_parent_version_id
    from public.price_list_sections where id = new.section_id;
  elsif new.scope = 'item' then
    select s.price_list_version_id into v_parent_version_id
    from public.price_list_items i
    join public.price_list_sections s on s.id = i.section_id
    where i.id = new.price_list_item_id;
  else
    v_parent_version_id := new.price_list_version_id;
  end if;

  if v_parent_version_id is null or v_parent_version_id <> new.price_list_version_id then
    raise exception 'PL1 rule scope/version mismatch'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_validate_rule_scope() from public, anon, authenticated;

create trigger price_rules_scope_validate
before insert or update of price_list_version_id, section_id, price_list_item_id, scope
on public.price_rules
for each row execute function private.pl1_validate_rule_scope();

-- Weight-link provenance and state machine.
create or replace function private.pl1_guard_weight_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref_geometry_id uuid;
  v_ref_grade_id uuid;
  v_previous_item_id uuid;
begin
  if new.supersedes_link_id is not null then
    select price_list_item_id into v_previous_item_id
    from public.price_list_item_weight_links
    where id = new.supersedes_link_id;

    if v_previous_item_id is null or v_previous_item_id <> new.price_list_item_id then
      raise exception 'PL1 weight-link supersession item mismatch'
        using errcode = '23514';
    end if;
  end if;

  if new.weight_reference_id is not null then
    select geometry_id, material_grade_id
      into v_ref_geometry_id, v_ref_grade_id
    from public.steel_weight_references
    where id = new.weight_reference_id;

    if v_ref_geometry_id is null or v_ref_geometry_id <> new.geometry_id then
      raise exception 'PL1 weight reference geometry mismatch'
        using errcode = '23514';
    end if;

    if v_ref_grade_id is not null
       and v_ref_grade_id is distinct from new.material_grade_id then
      raise exception 'PL1 grade-scoped weight reference mismatch'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.resolution_status <> 'candidate' then
      raise exception 'New PL1 weight links must start as candidate'
        using errcode = '23514';
    end if;
  else
    if old.resolution_status is distinct from new.resolution_status then
      if not (
        (old.resolution_status = 'candidate' and new.resolution_status in ('accepted','rejected'))
        or (old.resolution_status = 'accepted' and new.resolution_status = 'superseded')
      ) then
        raise exception 'Invalid PL1 weight-link transition: % -> %',
          old.resolution_status, new.resolution_status
          using errcode = '23514';
      end if;
    end if;

    if old.resolution_status in ('accepted','rejected','superseded') then
      if row(
        new.price_list_item_id,
        new.geometry_id,
        new.material_grade_id,
        new.weight_standard_key,
        new.geometry_match_status,
        new.geometry_match_method,
        new.weight_resolution_mode,
        new.weight_reference_id,
        new.formula_version,
        new.resolved_weight_kg_m,
        new.resolution_reason,
        new.supersedes_link_id,
        new.metadata
      ) is distinct from row(
        old.price_list_item_id,
        old.geometry_id,
        old.material_grade_id,
        old.weight_standard_key,
        old.geometry_match_status,
        old.geometry_match_method,
        old.weight_resolution_mode,
        old.weight_reference_id,
        old.formula_version,
        old.resolved_weight_kg_m,
        old.resolution_reason,
        old.supersedes_link_id,
        old.metadata
      ) then
        raise exception 'Resolved PL1 weight-link snapshot is immutable'
          using errcode = '55000';
      end if;
    end if;
  end if;

  if new.resolution_status in ('accepted','rejected') then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_guard_weight_link() from public, anon, authenticated;

create trigger price_list_item_weight_links_guard
before insert or update on public.price_list_item_weight_links
for each row execute function private.pl1_guard_weight_link();

-- Lifecycle audit generated by version transitions.
create or replace function private.pl1_record_version_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.price_list_lifecycle_events(
      price_list_version_id, event_type, previous_status, new_status, actor_id
    ) values (
      new.id, 'version_created', null, new.status, new.created_by
    );
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  v_event_type := case
    when old.status = 'draft' and new.status = 'review' then 'review_started'
    when new.status = 'draft' then 'returned_to_draft'
    when new.status = 'verified' then 'verification_approved'
    when old.status = 'verified' and new.status = 'review' then 'verification_revoked'
    when new.status = 'published' then 'published'
    when new.status = 'superseded' then 'superseded'
    when new.status = 'withdrawn' then 'withdrawn'
    else null
  end;

  if v_event_type is not null then
    v_actor := case
      when new.status = 'published' then new.published_by
      else auth.uid()
    end;

    insert into public.price_list_lifecycle_events(
      price_list_version_id,
      event_type,
      previous_status,
      new_status,
      actor_id,
      reason
    ) values (
      new.id,
      v_event_type,
      old.status,
      new.status,
      v_actor,
      case when new.status = 'withdrawn' then new.withdrawal_reason else null end
    );
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_record_version_lifecycle() from public, anon, authenticated;

create trigger price_list_versions_lifecycle
after insert or update of status on public.price_list_versions
for each row execute function private.pl1_record_version_lifecycle();

-- RLS
alter table public.price_lists enable row level security;
alter table public.price_list_versions enable row level security;
alter table public.price_list_version_documents enable row level security;
alter table public.price_list_sections enable row level security;
alter table public.price_list_items enable row level security;
alter table public.price_list_components enable row level security;
alter table public.price_rules enable row level security;
alter table public.price_list_item_weight_links enable row level security;
alter table public.price_list_source_governance_events enable row level security;
alter table public.price_list_lifecycle_events enable row level security;

-- Public catalogue reads are fail-closed through effective source governance.
create policy price_lists_public_read
on public.price_lists for select to anon
using (
  exists (
    select 1 from public.price_list_versions v
    where v.price_list_id = price_lists.id
      and public.pl1_version_visible_to(v.id, 'public')
  )
);

create policy price_lists_authenticated_read
on public.price_lists for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or exists (
    select 1 from public.price_list_versions v
    where v.price_list_id = price_lists.id
      and public.pl1_version_visible_to(v.id, 'authenticated')
  )
);

create policy price_list_versions_public_read
on public.price_list_versions for select to anon
using (public.pl1_version_visible_to(id, 'public'));

create policy price_list_versions_authenticated_read
on public.price_list_versions for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or public.pl1_version_visible_to(id, 'authenticated')
);

create policy price_list_version_documents_public_read
on public.price_list_version_documents for select to anon
using (public.pl1_version_visible_to(price_list_version_id, 'public'));

create policy price_list_version_documents_authenticated_read
on public.price_list_version_documents for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or public.pl1_version_visible_to(price_list_version_id, 'authenticated')
);

create policy price_list_sections_public_read
on public.price_list_sections for select to anon
using (public.pl1_version_visible_to(price_list_version_id, 'public'));

create policy price_list_sections_authenticated_read
on public.price_list_sections for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or public.pl1_version_visible_to(price_list_version_id, 'authenticated')
);

create policy price_list_items_public_read
on public.price_list_items for select to anon
using (
  exists (
    select 1 from public.price_list_sections s
    where s.id = price_list_items.section_id
      and public.pl1_version_visible_to(s.price_list_version_id, 'public')
  )
);

create policy price_list_items_authenticated_read
on public.price_list_items for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or exists (
    select 1 from public.price_list_sections s
    where s.id = price_list_items.section_id
      and public.pl1_version_visible_to(s.price_list_version_id, 'authenticated')
  )
);

create policy price_list_components_public_read
on public.price_list_components for select to anon
using (
  exists (
    select 1
    from public.price_list_items i
    join public.price_list_sections s on s.id = i.section_id
    where i.id = price_list_components.price_list_item_id
      and public.pl1_version_visible_to(s.price_list_version_id, 'public')
  )
);

create policy price_list_components_authenticated_read
on public.price_list_components for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or exists (
    select 1
    from public.price_list_items i
    join public.price_list_sections s on s.id = i.section_id
    where i.id = price_list_components.price_list_item_id
      and public.pl1_version_visible_to(s.price_list_version_id, 'authenticated')
  )
);

create policy price_rules_public_read
on public.price_rules for select to anon
using (public.pl1_version_visible_to(price_list_version_id, 'public'));

create policy price_rules_authenticated_read
on public.price_rules for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or public.pl1_version_visible_to(price_list_version_id, 'authenticated')
);

create policy price_list_item_weight_links_public_read
on public.price_list_item_weight_links for select to anon
using (
  exists (
    select 1
    from public.price_list_items i
    join public.price_list_sections s on s.id = i.section_id
    where i.id = price_list_item_weight_links.price_list_item_id
      and public.pl1_version_visible_to(s.price_list_version_id, 'public')
  )
);

create policy price_list_item_weight_links_authenticated_read
on public.price_list_item_weight_links for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or exists (
    select 1
    from public.price_list_items i
    join public.price_list_sections s on s.id = i.section_id
    where i.id = price_list_item_weight_links.price_list_item_id
      and public.pl1_version_visible_to(s.price_list_version_id, 'authenticated')
  )
);

-- Admin catalogue writes reuse existing Knowledge Operations RBAC.
create policy price_lists_admin_insert
on public.price_lists for insert to authenticated
with check (public.has_platform_permission('knowledge.edit'));

create policy price_lists_admin_update
on public.price_lists for update to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));

create policy price_lists_admin_delete
on public.price_lists for delete to authenticated
using (public.has_platform_permission('knowledge.edit'));

create policy price_list_versions_admin_insert
on public.price_list_versions for insert to authenticated
with check (
  public.has_platform_permission('knowledge.edit')
  and status = 'draft'
);

create policy price_list_versions_admin_update
on public.price_list_versions for update to authenticated
using (
  public.has_platform_permission('knowledge.edit')
  or public.has_platform_permission('knowledge.review')
  or public.has_platform_permission('knowledge.publish')
)
with check (
  (status in ('draft','review') and public.has_platform_permission('knowledge.edit'))
  or (status = 'verified' and public.has_platform_permission('knowledge.review'))
  or (status in ('published','superseded','withdrawn') and public.has_platform_permission('knowledge.publish'))
);

create policy price_list_versions_admin_delete
on public.price_list_versions for delete to authenticated
using (public.has_platform_permission('knowledge.edit'));

create policy price_list_version_documents_admin_all
on public.price_list_version_documents for all to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));

create policy price_list_sections_admin_all
on public.price_list_sections for all to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));

create policy price_list_items_admin_all
on public.price_list_items for all to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));

create policy price_list_components_admin_all
on public.price_list_components for all to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));

create policy price_rules_admin_all
on public.price_rules for all to authenticated
using (public.has_platform_permission('knowledge.edit'))
with check (public.has_platform_permission('knowledge.edit'));

create policy price_list_item_weight_links_admin_select
on public.price_list_item_weight_links for select to authenticated
using (public.has_platform_permission('knowledge.read_drafts'));

create policy price_list_item_weight_links_admin_insert
on public.price_list_item_weight_links for insert to authenticated
with check (
  public.has_platform_permission('knowledge.edit')
  and resolution_status = 'candidate'
);

create policy price_list_item_weight_links_admin_update
on public.price_list_item_weight_links for update to authenticated
using (
  public.has_platform_permission('knowledge.edit')
  or public.has_platform_permission('knowledge.review')
)
with check (
  (resolution_status = 'candidate' and public.has_platform_permission('knowledge.edit'))
  or (resolution_status in ('accepted','rejected','superseded')
      and public.has_platform_permission('knowledge.review'))
);

create policy price_list_item_weight_links_admin_delete
on public.price_list_item_weight_links for delete to authenticated
using (
  public.has_platform_permission('knowledge.edit')
  and resolution_status = 'candidate'
);

-- Source-governance decisions remain owner/governance-review controlled.
create policy price_list_source_governance_admin_read
on public.price_list_source_governance_events for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or public.has_platform_permission('discovery.governance_review')
);

create policy price_list_source_governance_admin_insert
on public.price_list_source_governance_events for insert to authenticated
with check (
  public.is_platform_superadmin()
  or public.has_platform_permission('discovery.governance_review')
);

create policy price_list_lifecycle_admin_read
on public.price_list_lifecycle_events for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or public.has_platform_permission('platform.audit.read')
);

-- Explicit grants: public catalogue is read-only; writes are RLS-admin gated.
revoke all on table
  public.price_lists,
  public.price_list_versions,
  public.price_list_version_documents,
  public.price_list_sections,
  public.price_list_items,
  public.price_list_components,
  public.price_rules,
  public.price_list_item_weight_links,
  public.price_list_source_governance_events,
  public.price_list_lifecycle_events
from anon, authenticated;

grant select on table
  public.price_lists,
  public.price_list_versions,
  public.price_list_version_documents,
  public.price_list_sections,
  public.price_list_items,
  public.price_list_components,
  public.price_rules,
  public.price_list_item_weight_links
to anon, authenticated;

grant insert, update, delete on table
  public.price_lists,
  public.price_list_versions,
  public.price_list_version_documents,
  public.price_list_sections,
  public.price_list_items,
  public.price_list_components,
  public.price_rules,
  public.price_list_item_weight_links
to authenticated;

grant select, insert on table
  public.price_list_source_governance_events
to authenticated;

grant select on table
  public.price_list_lifecycle_events
to authenticated;

comment on table public.price_lists is
  'PL1 manufacturer price-list families. Publisher identity reuses network_companies.';
comment on table public.price_list_versions is
  'PL1 immutable commercial list releases/revisions linked to knowledge_documents.';
comment on table public.price_list_items is
  'PL1 structured manufacturer source rows. Canonical geometry/weight resolution lives in price_list_item_weight_links.';
comment on table public.price_list_source_governance_events is
  'PL1 append-only source-rights/publication decision ledger.';
comment on table public.price_list_lifecycle_events is
  'PL1 append-only version lifecycle audit ledger.';

commit;
