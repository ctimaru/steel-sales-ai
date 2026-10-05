-- PL1.5 — Padana full-import review decisions, controlled promotion and geometry matching

begin;

create table public.price_list_import_review_decisions (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.price_list_import_runs(id) on delete restrict,
  import_row_id uuid not null references public.price_list_import_rows(id) on delete restrict,
  decision text not null
    check (decision in (
      'accepted_as_source',
      'accepted_with_unresolved_identity',
      'hold',
      'rejected'
    )),
  decision_code text not null,
  resolution_payload jsonb not null default '{}'::jsonb,
  rationale text not null,
  decided_by uuid null default auth.uid(),
  decided_at timestamptz not null default now(),
  unique (import_row_id)
);

create index price_list_import_review_decisions_run_idx
  on public.price_list_import_review_decisions(import_run_id, decision, decided_at);

create or replace function private.pl1_validate_import_review_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row_run_id uuid;
  v_row_status text;
  v_run_status text;
begin
  select r.import_run_id, r.validation_status
    into v_row_run_id, v_row_status
  from public.price_list_import_rows r
  where r.id = new.import_row_id;

  if v_row_run_id is null or v_row_run_id <> new.import_run_id then
    raise exception 'PL1 review decision row/run mismatch'
      using errcode = '23514';
  end if;

  if v_row_status <> 'review' then
    raise exception 'PL1 review decisions are only valid for review-routed rows'
      using errcode = '23514';
  end if;

  select status into v_run_status
  from public.price_list_import_runs
  where id = new.import_run_id;

  if v_run_status <> 'review_ready' then
    raise exception 'PL1 review decisions require a review_ready import run'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function private.pl1_validate_import_review_decision()
from public, anon, authenticated;

create trigger price_list_import_review_decisions_validate
before insert on public.price_list_import_review_decisions
for each row execute function private.pl1_validate_import_review_decision();

create trigger price_list_import_review_decisions_append_only
before update or delete on public.price_list_import_review_decisions
for each row execute function private.pl1_assert_append_only();

alter table public.price_list_import_review_decisions enable row level security;

create policy price_list_import_review_decisions_admin_read
on public.price_list_import_review_decisions
for select to authenticated
using (
  public.has_platform_permission('knowledge.read_drafts')
  or public.has_platform_permission('knowledge.review')
  or public.has_platform_permission('knowledge.publish')
);

revoke all on table public.price_list_import_review_decisions
from anon, authenticated;

grant select on table public.price_list_import_review_decisions
to authenticated;

grant select, insert on table public.price_list_import_review_decisions
to service_role;

create or replace function private.pl1_promote_import(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.price_list_import_runs%rowtype;
  v_version public.price_list_versions%rowtype;
  v_missing_review integer;
  v_error_rows integer;
  v_sections integer := 0;
  v_items integer := 0;
  v_components integer := 0;
  v_rules integer := 0;
  v_new_geometries integer := 0;
  v_geometry_candidates integer := 0;
begin
  select * into v_run
  from public.price_list_import_runs
  where id = p_run_id
  for update;

  if v_run.id is null then
    raise exception 'PL1 import run not found'
      using errcode = 'P0002';
  end if;

  if v_run.status <> 'review_ready' then
    raise exception 'PL1 promotion requires review_ready; current status=%', v_run.status
      using errcode = '55000';
  end if;

  select * into v_version
  from public.price_list_versions
  where id = v_run.price_list_version_id
  for update;

  if v_version.status not in ('draft','review') then
    raise exception 'PL1 promotion requires draft/review version'
      using errcode = '55000';
  end if;

  select count(*) into v_error_rows
  from public.price_list_import_rows
  where import_run_id = p_run_id
    and validation_status = 'error';

  if v_error_rows > 0 then
    raise exception 'PL1 promotion blocked: % error row(s)', v_error_rows
      using errcode = '23514';
  end if;

  select count(*) into v_missing_review
  from public.price_list_import_rows r
  left join public.price_list_import_review_decisions d
    on d.import_row_id = r.id
  where r.import_run_id = p_run_id
    and r.validation_status = 'review'
    and (
      d.id is null
      or d.decision not in ('accepted_as_source','accepted_with_unresolved_identity')
    );

  if v_missing_review > 0 then
    raise exception 'PL1 promotion blocked: % review row(s) not accepted', v_missing_review
      using errcode = '23514';
  end if;

  -- One governed section per normalized section context.
  with source_sections as (
    select distinct on (r.section_key)
      r.section_key,
      r.normalized_data->'section' as s,
      r.page_number,
      r.source_row_index
    from public.price_list_import_rows r
    where r.import_run_id = p_run_id
      and r.row_type = 'item'
      and r.section_key is not null
      and r.validation_status in ('valid','review')
    order by r.section_key, r.page_number, r.source_row_index
  )
  insert into public.price_list_sections(
    price_list_version_id, section_key, raw_heading, shape_code,
    standard_raw, standard_code, weight_standard_key,
    grade_raw, grade_code, material_grade_id,
    finish_raw, finish_code, manufacturing_process,
    currency_code, price_unit, sort_order, source_locator
  )
  select
    v_run.price_list_version_id,
    ss.section_key,
    coalesce(nullif(ss.s->>'raw_heading',''),'Source section'),
    coalesce(ss.s->>'shape_code','other'),
    ss.s->>'standard_raw',
    ss.s->>'standard_code',
    ss.s->>'weight_standard_key',
    ss.s->>'grade_raw',
    ss.s->>'grade_code',
    mg.id,
    ss.s->>'finish_raw',
    ss.s->>'finish_code',
    'ERW',
    coalesce(ss.s->>'currency_code','EUR'),
    coalesce(ss.s->>'price_unit','per_m'),
    ss.page_number * 10000 + ss.source_row_index,
    jsonb_build_object(
      'source_document_id',v_run.source_document_id,
      'import_run_id',p_run_id,
      'first_page',ss.page_number,
      'delivery_term_raw',ss.s->>'delivery_term_raw'
    )
  from source_sections ss
  left join lateral (
    select g.id
    from public.steel_material_grades g
    where g.designation_key =
      lower(regexp_replace(coalesce(ss.s->>'grade_code',''),'[^a-zA-Z0-9]','','g'))
    limit 1
  ) mg on true
  on conflict (price_list_version_id, section_key) do nothing;

  get diagnostics v_sections = row_count;

  -- Promote accepted source rows. Review metadata is preserved verbatim.
  insert into public.price_list_items(
    section_id, item_key, dimension_label_raw, geometry_candidate_key,
    outer_diameter_mm, width_mm, height_mm, thickness_mm,
    note_raw, source_row_index, source_row_signature, source_locator,
    raw_data, extraction_version, status
  )
  select
    s.id,
    r.normalized_data #>> '{item,item_key}',
    r.normalized_data #>> '{item,dimension_label_raw}',
    r.normalized_data #>> '{item,geometry_candidate_key}',
    nullif(r.normalized_data #>> '{item,outer_diameter_mm}','')::numeric,
    nullif(r.normalized_data #>> '{item,width_mm}','')::numeric,
    nullif(r.normalized_data #>> '{item,height_mm}','')::numeric,
    (r.normalized_data #>> '{item,thickness_mm}')::numeric,
    r.normalized_data #>> '{item,note_raw}',
    r.source_row_index,
    r.row_signature,
    r.source_locator || jsonb_build_object(
      'source_document_id',v_run.source_document_id,
      'import_run_id',p_run_id,
      'import_row_id',r.id
    ),
    jsonb_build_object(
      'import_row_id',r.id,
      'page_number',r.page_number,
      'validation_status',r.validation_status,
      'validation_codes',to_jsonb(r.validation_codes),
      'review_decision',d.decision,
      'review_decision_code',d.decision_code,
      'review_resolution',d.resolution_payload,
      'source_normalized_data',r.normalized_data
    ),
    v_run.parser_version,
    'active'
  from public.price_list_import_rows r
  join public.price_list_sections s
    on s.price_list_version_id = v_run.price_list_version_id
   and s.section_key = r.section_key
  left join public.price_list_import_review_decisions d
    on d.import_row_id = r.id
  where r.import_run_id = p_run_id
    and r.row_type = 'item'
    and (
      r.validation_status = 'valid'
      or (
        r.validation_status = 'review'
        and d.decision in ('accepted_as_source','accepted_with_unresolved_identity')
      )
    )
  on conflict (section_id, item_key) do nothing;

  get diagnostics v_items = row_count;

  -- Base and fixed extra remain separate, preserving discountability.
  insert into public.price_list_components(
    price_list_item_id, component_type, source_label, amount,
    currency_code, price_unit, operation, discountable,
    calculation_order, source_locator
  )
  select
    i.id,
    c->>'component_type',
    c->>'source_label',
    (c->>'amount')::numeric,
    c->>'currency_code',
    c->>'price_unit',
    c->>'operation',
    (c->>'discountable')::boolean,
    (c->>'calculation_order')::integer,
    r.source_locator || jsonb_build_object(
      'source_document_id',v_run.source_document_id,
      'import_run_id',p_run_id,
      'import_row_id',r.id
    )
  from public.price_list_import_rows r
  join public.price_list_sections s
    on s.price_list_version_id = v_run.price_list_version_id
   and s.section_key = r.section_key
  join public.price_list_items i
    on i.section_id = s.id
   and i.item_key = r.normalized_data #>> '{item,item_key}'
  left join public.price_list_import_review_decisions d
    on d.import_row_id = r.id
  cross join lateral jsonb_array_elements(r.normalized_data->'components') c
  where r.import_run_id = p_run_id
    and r.row_type = 'item'
    and (
      r.validation_status = 'valid'
      or (
        r.validation_status = 'review'
        and d.decision in ('accepted_as_source','accepted_with_unresolved_identity')
      )
    )
  on conflict (price_list_item_id, calculation_order) do nothing;

  get diagnostics v_components = row_count;

  -- Promote source rules. Review-routed rules remain non-auto-executable.
  insert into public.price_rules(
    price_list_version_id, section_id, price_list_item_id,
    rule_type, scope, rule_payload, source_text,
    calculation_order, status, source_locator
  )
  select
    v_run.price_list_version_id,
    null,
    null,
    r.normalized_data->>'rule_type',
    r.normalized_data->>'scope',
    coalesce(r.normalized_data->'rule_payload','{}'::jsonb),
    r.raw_text,
    coalesce((r.normalized_data->>'calculation_order')::integer,0),
    case when r.validation_status='valid' then 'active' else 'review_required' end,
    r.source_locator || jsonb_build_object(
      'source_document_id',v_run.source_document_id,
      'import_run_id',p_run_id,
      'import_row_id',r.id
    )
  from public.price_list_import_rows r
  left join public.price_list_import_review_decisions d
    on d.import_row_id = r.id
  where r.import_run_id = p_run_id
    and r.row_type = 'rule'
    and (
      r.validation_status = 'valid'
      or (
        r.validation_status = 'review'
        and d.decision in ('accepted_as_source','accepted_with_unresolved_identity')
      )
    )
    and not exists (
      select 1
      from public.price_rules pr
      where pr.price_list_version_id = v_run.price_list_version_id
        and pr.rule_type = r.normalized_data->>'rule_type'
        and pr.calculation_order = coalesce((r.normalized_data->>'calculation_order')::integer,0)
    );

  get diagnostics v_rules = row_count;

  -- Governed geometry promotion for exact circular/square/rectangular identities.
  insert into public.steel_geometries(
    product_family, outer_diameter_mm, width_mm, height_mm,
    thickness_mm, metadata
  )
  select distinct
    case s.shape_code
      when 'circular' then 'round_tube'
      when 'square' then 'square_tube'
      when 'rectangular' then 'rectangular_tube'
    end,
    case when s.shape_code='circular' then i.outer_diameter_mm else null end,
    case when s.shape_code in ('square','rectangular') then i.width_mm else null end,
    case when s.shape_code in ('square','rectangular') then i.height_mm else null end,
    i.thickness_mm,
    jsonb_build_object(
      'created_by_contract','PL1.5',
      'created_from_import_run',p_run_id,
      'price_list_version_id',v_run.price_list_version_id,
      'source_document_id',v_run.source_document_id
    )
  from public.price_list_items i
  join public.price_list_sections s on s.id=i.section_id
  where s.price_list_version_id=v_run.price_list_version_id
    and s.shape_code in ('circular','square','rectangular')
    and i.geometry_candidate_key is not null
  on conflict (geometry_key) do nothing;

  get diagnostics v_new_geometries = row_count;

  -- PL1.2 candidate geometry links. Weight remains unresolved until a compatible
  -- governed reference or WC3.1 standard-formula resolution is materialized.
  insert into public.price_list_item_weight_links(
    price_list_item_id, geometry_id, material_grade_id,
    weight_standard_key, geometry_match_status, geometry_match_method,
    weight_resolution_mode, weight_reference_id, formula_version,
    resolved_weight_kg_m, resolution_status, resolution_reason, metadata
  )
  select
    i.id,
    g.id,
    s.material_grade_id,
    s.weight_standard_key,
    case
      when g.metadata->>'created_from_import_run' = p_run_id::text
        then 'exact_new_candidate'
      else 'exact_existing'
    end,
    case
      when g.metadata->>'created_from_import_run' = p_run_id::text
        then 'promoted_candidate'
      else 'geometry_key'
    end,
    'unresolved',
    null,
    null,
    null,
    'candidate',
    case
      when s.weight_standard_key is null
        then 'Technical standard unresolved from source; €/t blocked.'
      when s.weight_standard_key not in ('EN10219','EN10210')
        then 'No PL1 standard-formula resolver enabled for this source standard.'
      else
        'Exact geometry linked; WC3.1 standard-formula resolution pending.'
    end,
    jsonb_build_object(
      'created_by_contract','PL1.5',
      'import_run_id',p_run_id,
      'source_document_id',v_run.source_document_id,
      'source_validation_status',i.raw_data->>'validation_status'
    )
  from public.price_list_items i
  join public.price_list_sections s on s.id=i.section_id
  join public.steel_geometries g on g.geometry_key=i.geometry_candidate_key
  where s.price_list_version_id=v_run.price_list_version_id
    and s.shape_code in ('circular','square','rectangular')
    and not exists (
      select 1
      from public.price_list_item_weight_links wl
      where wl.price_list_item_id=i.id
        and wl.resolution_status='candidate'
        and wl.metadata->>'import_run_id'=p_run_id::text
    );

  get diagnostics v_geometry_candidates = row_count;

  update public.price_list_import_runs
  set status='promoted',
      summary = summary || jsonb_build_object(
        'promoted_section_count',
          (select count(*) from public.price_list_sections where price_list_version_id=v_run.price_list_version_id),
        'promoted_item_count',
          (select count(*) from public.price_list_items i join public.price_list_sections s on s.id=i.section_id where s.price_list_version_id=v_run.price_list_version_id),
        'promoted_component_count',
          (select count(*) from public.price_list_components c join public.price_list_items i on i.id=c.price_list_item_id join public.price_list_sections s on s.id=i.section_id where s.price_list_version_id=v_run.price_list_version_id),
        'promoted_rule_count',
          (select count(*) from public.price_rules where price_list_version_id=v_run.price_list_version_id),
        'new_geometry_count',v_new_geometries,
        'geometry_candidate_link_count',v_geometry_candidates
      )
  where id=p_run_id;

  if v_version.status='draft' then
    update public.price_list_versions
    set status='review'
    where id=v_run.price_list_version_id;
  end if;

  return jsonb_build_object(
    'run_id',p_run_id,
    'price_list_version_id',v_run.price_list_version_id,
    'sections_inserted',v_sections,
    'items_inserted',v_items,
    'components_inserted',v_components,
    'rules_inserted',v_rules,
    'new_geometries',v_new_geometries,
    'geometry_candidate_links',v_geometry_candidates,
    'status','promoted'
  );
end;
$$;

revoke all on function private.pl1_promote_import(uuid)
from public, anon, authenticated;

grant execute on function private.pl1_promote_import(uuid)
to service_role;

comment on table public.price_list_import_review_decisions is
  'PL1.5 immutable decisions for review-routed staging rows before controlled catalogue promotion.';

commit;