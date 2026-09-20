-- P1.15 / SK4.5k — grade cross-reference policy.
--
-- Formal semantics for grade-to-grade relations.
--
-- Critical policy:
--   * same material number is an identity/correlation signal, not automatic
--     normative equivalence;
--   * normative substitution is allowed ONLY for an explicit
--     relation_type='normative_equivalent' backed by official normative
--     documentary evidence;
--   * national adoption / historical mapping remain contextual;
--   * supplier cross-references and commercial comparability are explicitly
--     non-normative and may never authorize substitution.

alter table public.steel_grade_cross_references
  drop constraint if exists steel_grade_cross_references_relation_type_check;

alter table public.steel_grade_cross_references
  add constraint steel_grade_cross_references_relation_type_check
  check (
    relation_type in (
      'same_material',
      'normative_equivalent',
      'national_adoption',
      'historical_mapping',
      'supplier_cross_reference',
      'commercially_comparable'
    )
  );

alter table public.steel_grade_cross_references
  add column evidence_class text not null default 'unspecified'
    check (
      evidence_class in (
        'unspecified',
        'official_normative',
        'official_adoption',
        'manufacturer_reference',
        'supplier_reference',
        'historical_reference',
        'commercial_internal'
      )
    ),
  add column valid_from date,
  add column valid_to date,
  add constraint steel_grade_cross_references_validity_check
    check (valid_to is null or valid_from is null or valid_to >= valid_from);

create unique index steel_grade_cross_references_symmetric_uq
  on public.steel_grade_cross_references (
    least(from_material_grade_id::text,to_material_grade_id::text),
    greatest(from_material_grade_id::text,to_material_grade_id::text),
    relation_type,
    coalesce(knowledge_source_id,'00000000-0000-0000-0000-000000000000'::uuid)
  )
  where relation_type in (
    'same_material',
    'normative_equivalent',
    'commercially_comparable'
  );

create or replace function public.steel_grade_cross_reference_policy_class(
  p_relation_type text
)
returns table (
  policy_class text,
  same_material_identity boolean,
  normative_equivalence boolean,
  normative_substitution_allowed boolean,
  commercial_comparison_allowed boolean,
  historical_context_only boolean,
  weak_relation boolean,
  relation_directionality text
)
language plpgsql
immutable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_relation_type is null or p_relation_type not in (
    'same_material',
    'normative_equivalent',
    'national_adoption',
    'historical_mapping',
    'supplier_cross_reference',
    'commercially_comparable'
  ) then
    raise exception using errcode='22023',
      message='unsupported steel grade cross-reference relation type';
  end if;

  policy_class :=
    case
      when p_relation_type='same_material'
        then 'same_material_identity'
      when p_relation_type='normative_equivalent'
        then 'normative_equivalence'
      when p_relation_type in ('national_adoption','historical_mapping')
        then 'historical_mapping'
      else 'commercial_comparability'
    end;

  same_material_identity := p_relation_type='same_material';

  -- Deliberately false for same_material: sharing a material number is useful
  -- identity evidence but is not itself a normative substitution authorization.
  normative_equivalence := p_relation_type='normative_equivalent';
  normative_substitution_allowed := p_relation_type='normative_equivalent';

  commercial_comparison_allowed := p_relation_type in (
    'same_material',
    'normative_equivalent',
    'supplier_cross_reference',
    'commercially_comparable'
  );

  historical_context_only := p_relation_type in (
    'national_adoption',
    'historical_mapping'
  );

  weak_relation := p_relation_type in (
    'supplier_cross_reference',
    'commercially_comparable'
  );

  relation_directionality :=
    case
      when p_relation_type in (
        'same_material',
        'normative_equivalent',
        'commercially_comparable'
      ) then 'symmetric'
      else 'directional'
    end;

  return next;
end
$$;

comment on function public.steel_grade_cross_reference_policy_class(text) is
  'SK4.5k pure classifier. Only explicit normative_equivalent may authorize normative substitution; same material number, supplier, commercial and historical relations may not.';

revoke all on function public.steel_grade_cross_reference_policy_class(text)
  from public,anon;

grant execute on function public.steel_grade_cross_reference_policy_class(text)
  to authenticated,service_role;

create or replace function public.steel_guard_grade_cross_reference_policy()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_from public.steel_material_grades;
  v_to public.steel_material_grades;
  v_source public.knowledge_sources;
  v_same_material_number boolean;
  v_reference_purpose text;
  v_reuse_basis text;
  v_not_normative_complete boolean;
begin
  select * into v_from
  from public.steel_material_grades
  where id=new.from_material_grade_id;

  select * into v_to
  from public.steel_material_grades
  where id=new.to_material_grade_id;

  if v_from.id is null or v_to.id is null then
    raise exception using errcode='22023',
      message='grade cross-reference requires two existing material grades';
  end if;

  if new.from_material_grade_id=new.to_material_grade_id then
    raise exception using errcode='22023',
      message='grade cross-reference cannot point a grade to itself';
  end if;

  if new.valid_to is not null
     and new.valid_from is not null
     and new.valid_to<new.valid_from then
    raise exception using errcode='22023',
      message='grade cross-reference valid_to cannot precede valid_from';
  end if;

  v_same_material_number :=
    v_from.material_number_key<>''
    and v_to.material_number_key<>''
    and v_from.material_number_key=v_to.material_number_key;

  if new.knowledge_source_id is not null then
    select * into v_source
    from public.knowledge_sources
    where id=new.knowledge_source_id;

    if v_source.id is null then
      raise exception using errcode='22023',
        message='grade cross-reference knowledge source was not found';
    end if;

    v_reference_purpose :=
      lower(coalesce(v_source.metadata->>'reference_purpose',''));
    v_reuse_basis :=
      lower(coalesce(v_source.metadata->>'reuse_basis',''));
    v_not_normative_complete :=
      coalesce((v_source.metadata->>'not_normative_complete')::boolean,false);
  end if;

  case new.relation_type
    when 'same_material' then
      if not v_same_material_number then
        raise exception using errcode='22023',
          message='same_material relation requires the same non-null material number on both grades';
      end if;

      if new.knowledge_source_id is null
         or new.evidence_class='unspecified' then
        raise exception using errcode='22023',
          message='same_material relation requires explicit provenance and evidence class';
      end if;

    when 'normative_equivalent' then
      if new.evidence_class<>'official_normative' then
        raise exception using errcode='22023',
          message='normative_equivalent requires evidence_class=official_normative';
      end if;

      if new.knowledge_source_id is null
         or new.source_document_id is null then
        raise exception using errcode='22023',
          message='normative_equivalent requires an official source and supporting source document';
      end if;

      if v_source.source_class<>'official' then
        raise exception using errcode='22023',
          message='normative_equivalent requires source_class=official';
      end if;

      if v_not_normative_complete
         or v_reuse_basis='public_metadata_reference_only'
         or v_reference_purpose like '%status_scope_only%' then
        raise exception using errcode='22023',
          message='metadata-only or explicitly incomplete sources cannot support normative equivalence';
      end if;

    when 'national_adoption' then
      if new.evidence_class<>'official_adoption'
         or new.knowledge_source_id is null
         or v_source.source_class<>'official' then
        raise exception using errcode='22023',
          message='national_adoption requires official adoption evidence';
      end if;

    when 'historical_mapping' then
      if new.evidence_class not in (
        'official_adoption',
        'historical_reference'
      )
         or new.knowledge_source_id is null then
        raise exception using errcode='22023',
          message='historical_mapping requires historical or official-adoption provenance';
      end if;

    when 'supplier_cross_reference' then
      if new.evidence_class not in (
        'supplier_reference',
        'manufacturer_reference'
      )
         or new.knowledge_source_id is null
         or v_source.source_class not in ('primary','secondary') then
        raise exception using errcode='22023',
          message='supplier_cross_reference requires supplier/manufacturer provenance';
      end if;

    when 'commercially_comparable' then
      if new.evidence_class not in (
        'supplier_reference',
        'manufacturer_reference',
        'commercial_internal'
      )
         or new.knowledge_source_id is null then
        raise exception using errcode='22023',
          message='commercially_comparable requires explicit commercial provenance';
      end if;

    else
      raise exception using errcode='22023',
        message='unsupported grade cross-reference relation type';
  end case;

  new.metadata := coalesce(new.metadata,'{}'::jsonb)
    || jsonb_build_object(
      'policy_microblock','SK4.5k',
      'grade_cross_reference_policy_version',1,
      'same_material_number',v_same_material_number,
      'normative_substitution_allowed',
        new.relation_type='normative_equivalent'
    );

  return new;
end
$$;

comment on function public.steel_guard_grade_cross_reference_policy() is
  'SK4.5k row guard enforcing evidence requirements and preventing weak grade relations from masquerading as normative equivalence.';

revoke all on function public.steel_guard_grade_cross_reference_policy()
  from public,anon,authenticated;

drop trigger if exists steel_guard_grade_cross_reference_policy
  on public.steel_grade_cross_references;

create trigger steel_guard_grade_cross_reference_policy
before insert or update
on public.steel_grade_cross_references
for each row execute function public.steel_guard_grade_cross_reference_policy();

create or replace function public.p1_record_steel_grade_cross_reference(
  p_from_material_grade_id uuid,
  p_to_material_grade_id uuid,
  p_relation_type text,
  p_evidence_class text,
  p_knowledge_source_id uuid,
  p_source_document_id uuid default null,
  p_notes text default null,
  p_valid_from date default null,
  p_valid_to date default null,
  p_source_locator jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns public.steel_grade_cross_references
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_row public.steel_grade_cross_references;
begin
  if p_from_material_grade_id is null
     or p_to_material_grade_id is null then
    raise exception using errcode='22023',
      message='grade cross-reference requires from and to grade ids';
  end if;

  if p_relation_type is null or p_evidence_class is null then
    raise exception using errcode='22023',
      message='grade cross-reference requires relation_type and evidence_class';
  end if;

  insert into public.steel_grade_cross_references (
    from_material_grade_id,
    to_material_grade_id,
    relation_type,
    evidence_class,
    notes,
    knowledge_source_id,
    source_document_id,
    source_locator,
    metadata,
    valid_from,
    valid_to
  ) values (
    p_from_material_grade_id,
    p_to_material_grade_id,
    p_relation_type,
    p_evidence_class,
    nullif(btrim(p_notes),''),
    p_knowledge_source_id,
    p_source_document_id,
    coalesce(p_source_locator,'{}'::jsonb),
    coalesce(p_metadata,'{}'::jsonb),
    p_valid_from,
    p_valid_to
  )
  returning * into v_row;

  return v_row;
end
$$;

comment on function public.p1_record_steel_grade_cross_reference(
  uuid,uuid,text,text,uuid,uuid,text,date,date,jsonb,jsonb
) is
  'SK4.5k service-only controlled writer for grade cross-references. Row trigger enforces relation-specific evidence policy.';

revoke all on function public.p1_record_steel_grade_cross_reference(
  uuid,uuid,text,text,uuid,uuid,text,date,date,jsonb,jsonb
) from public,anon,authenticated;

grant execute on function public.p1_record_steel_grade_cross_reference(
  uuid,uuid,text,text,uuid,uuid,text,date,date,jsonb,jsonb
) to service_role;

create or replace function public.p1_shared_steel_grade_cross_reference_policy(
  p_material_grade_id uuid default null,
  p_policy_class text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  cross_reference_id uuid,
  from_material_grade_id uuid,
  from_designation text,
  from_material_number text,
  to_material_grade_id uuid,
  to_designation text,
  to_material_number text,
  relation_type text,
  evidence_class text,
  policy_class text,
  same_material_identity boolean,
  normative_equivalence boolean,
  normative_substitution_allowed boolean,
  commercial_comparison_allowed boolean,
  historical_context_only boolean,
  weak_relation boolean,
  relation_directionality text,
  knowledge_source_id uuid,
  source_key text,
  source_class text,
  source_document_id uuid,
  valid_from date,
  valid_to date,
  notes text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_policy_class is not null
     and p_policy_class not in (
       'same_material_identity',
       'normative_equivalence',
       'historical_mapping',
       'commercial_comparability'
     ) then
    raise exception using errcode='22023',
      message='unsupported grade cross-reference policy class';
  end if;

  if p_limit is null or p_limit<1 or p_limit>1000 then
    raise exception using errcode='22023',
      message='grade cross-reference limit must be between 1 and 1000';
  end if;

  if p_offset is null or p_offset<0 then
    raise exception using errcode='22023',
      message='grade cross-reference offset must be non-negative';
  end if;

  return query
  with classified as (
    select
      x.*,
      f.designation as from_designation,
      f.material_number as from_material_number,
      t.designation as to_designation,
      t.material_number as to_material_number,
      ks.source_key,
      ks.source_class,
      p.policy_class,
      p.same_material_identity,
      p.normative_equivalence,
      p.normative_substitution_allowed,
      p.commercial_comparison_allowed,
      p.historical_context_only,
      p.weak_relation,
      p.relation_directionality
    from public.steel_grade_cross_references x
    join public.steel_material_grades f
      on f.id=x.from_material_grade_id
    join public.steel_material_grades t
      on t.id=x.to_material_grade_id
    left join public.knowledge_sources ks
      on ks.id=x.knowledge_source_id
    cross join lateral public.steel_grade_cross_reference_policy_class(
      x.relation_type
    ) p
    where p_material_grade_id is null
       or x.from_material_grade_id=p_material_grade_id
       or x.to_material_grade_id=p_material_grade_id
  )
  select
    c.id,
    c.from_material_grade_id,
    c.from_designation,
    c.from_material_number,
    c.to_material_grade_id,
    c.to_designation,
    c.to_material_number,
    c.relation_type,
    c.evidence_class,
    c.policy_class,
    c.same_material_identity,
    c.normative_equivalence,
    c.normative_substitution_allowed,
    c.commercial_comparison_allowed,
    c.historical_context_only,
    c.weak_relation,
    c.relation_directionality,
    c.knowledge_source_id,
    c.source_key,
    c.source_class,
    c.source_document_id,
    c.valid_from,
    c.valid_to,
    c.notes,
    c.metadata,
    c.created_at
  from classified c
  where p_policy_class is null or c.policy_class=p_policy_class
  order by
    case c.policy_class
      when 'normative_equivalence' then 1
      when 'same_material_identity' then 2
      when 'commercial_comparability' then 3
      when 'historical_mapping' then 4
      else 5
    end,
    c.from_designation,
    c.to_designation,
    c.created_at
  limit p_limit offset p_offset;
end
$$;

comment on function public.p1_shared_steel_grade_cross_reference_policy(
  uuid,text,integer,integer
) is
  'SK4.5k read contract for grade cross-reference semantics. Weak/commercial/historical/same-material-number relations are explicitly distinguishable from normative equivalence.';

revoke all on function public.p1_shared_steel_grade_cross_reference_policy(
  uuid,text,integer,integer
) from public,anon;

grant execute on function public.p1_shared_steel_grade_cross_reference_policy(
  uuid,text,integer,integer
) to authenticated,service_role;

-- Acceptance assertions.
do $$
declare
  v_source public.knowledge_sources;
  v_grade_a public.steel_material_grades;
  v_grade_b public.steel_material_grades;
  v_other_a public.steel_material_grades;
  v_other_b public.steel_material_grades;
  v_same public.steel_grade_cross_references;
  v_commercial public.steel_grade_cross_references;
  v_policy record;
  v_blocked boolean := false;
  v_suffix text := replace(gen_random_uuid()::text,'-','');
begin
  select * into v_source
  from public.knowledge_sources
  where source_class in ('primary','secondary')
  order by source_key
  limit 1;

  if v_source.id is null then
    raise exception 'SK4.5k requires one primary/secondary knowledge source for acceptance';
  end if;

  insert into public.steel_material_grades (
    standard_system,designation,material_number,material_family,metadata
  ) values (
    'TEST',
    'SK45K-A-'||v_suffix,
    'SK45K-'||v_suffix,
    'policy_fixture',
    jsonb_build_object('migration_fixture','SK4.5k')
  )
  returning * into v_grade_a;

  insert into public.steel_material_grades (
    standard_system,designation,material_number,material_family,metadata
  ) values (
    'TEST',
    'SK45K-B-'||v_suffix,
    'SK45K-'||v_suffix,
    'policy_fixture',
    jsonb_build_object('migration_fixture','SK4.5k')
  )
  returning * into v_grade_b;

  insert into public.steel_material_grades (
    standard_system,designation,material_number,material_family,metadata
  ) values (
    'TEST',
    'SK45K-C-'||v_suffix,
    'SK45K-C-'||v_suffix,
    'policy_fixture',
    jsonb_build_object('migration_fixture','SK4.5k')
  )
  returning * into v_other_a;

  insert into public.steel_material_grades (
    standard_system,designation,material_number,material_family,metadata
  ) values (
    'TEST',
    'SK45K-D-'||v_suffix,
    'SK45K-D-'||v_suffix,
    'policy_fixture',
    jsonb_build_object('migration_fixture','SK4.5k')
  )
  returning * into v_other_b;

  select * into v_same
  from public.p1_record_steel_grade_cross_reference(
    v_grade_a.id,
    v_grade_b.id,
    'same_material',
    case
      when v_source.source_class='primary'
        then 'manufacturer_reference'
      else 'supplier_reference'
    end,
    v_source.id,
    null,
    'SK4.5k same-material identity fixture',
    null,
    null,
    '{}'::jsonb,
    '{}'::jsonb
  );

  select * into v_policy
  from public.p1_shared_steel_grade_cross_reference_policy(
    v_grade_a.id,
    'same_material_identity',
    100,
    0
  )
  where cross_reference_id=v_same.id;

  if not found
     or not v_policy.same_material_identity
     or v_policy.normative_equivalence
     or v_policy.normative_substitution_allowed then
    raise exception
      'SK4.5k same-material identity must not imply normative substitution';
  end if;

  select * into v_commercial
  from public.p1_record_steel_grade_cross_reference(
    v_other_a.id,
    v_other_b.id,
    'commercially_comparable',
    case
      when v_source.source_class='primary'
        then 'manufacturer_reference'
      else 'supplier_reference'
    end,
    v_source.id,
    null,
    'SK4.5k commercial comparability fixture',
    null,
    null,
    '{}'::jsonb,
    '{}'::jsonb
  );

  select * into v_policy
  from public.p1_shared_steel_grade_cross_reference_policy(
    v_other_a.id,
    'commercial_comparability',
    100,
    0
  )
  where cross_reference_id=v_commercial.id;

  if not found
     or not v_policy.commercial_comparison_allowed
     or not v_policy.weak_relation
     or v_policy.normative_equivalence
     or v_policy.normative_substitution_allowed then
    raise exception
      'SK4.5k commercial relation leaked into normative equivalence';
  end if;

  begin
    perform public.p1_record_steel_grade_cross_reference(
      v_other_a.id,
      v_other_b.id,
      'normative_equivalent',
      'official_normative',
      v_source.id,
      null,
      'SK4.5k invalid normative attempt',
      null,
      null,
      '{}'::jsonb,
      '{}'::jsonb
    );
  exception
    when sqlstate '22023' then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception
      'SK4.5k weak/non-official evidence unexpectedly created normative equivalence';
  end if;

  select * into v_policy
  from public.steel_grade_cross_reference_policy_class('historical_mapping');

  if v_policy.policy_class<>'historical_mapping'
     or not v_policy.historical_context_only
     or v_policy.normative_substitution_allowed then
    raise exception 'SK4.5k historical mapping policy regression';
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_shared_steel_grade_cross_reference_policy(uuid,text,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.p1_record_steel_grade_cross_reference(uuid,uuid,text,text,uuid,uuid,text,date,date,jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5k anon privilege regression';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.p1_shared_steel_grade_cross_reference_policy(uuid,text,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.p1_record_steel_grade_cross_reference(uuid,uuid,text,text,uuid,uuid,text,date,date,jsonb,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5k authenticated privilege regression';
  end if;

  delete from public.steel_grade_cross_references
  where id in (v_same.id,v_commercial.id);

  delete from public.steel_material_grades
  where id in (
    v_grade_a.id,
    v_grade_b.id,
    v_other_a.id,
    v_other_b.id
  );
end
$$;
