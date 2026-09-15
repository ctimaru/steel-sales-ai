\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P0.7 entity resolution assertion failed: %', message;
  end if;
end;
$$;

-- P0.4-aligned entity keys must absorb formatting differences without fuzzy logic.
select pg_temp.assert_true(
  public.canonical_knowledge_entity_key('standard', 'EN 10224') =
  public.canonical_knowledge_entity_key('standard', 'EN10224'),
  'standard formatting variants must share one canonical key'
);
select pg_temp.assert_true(
  public.canonical_knowledge_entity_key('grade', 'S355 J2H') =
  public.canonical_knowledge_entity_key('grade', 'S355J2H'),
  'grade formatting variants must share one canonical key'
);
select pg_temp.assert_true(
  public.canonical_knowledge_entity_key('product_family', 'CHS') = 'roundtube',
  'CHS must align with the P0.4 round tube family'
);
select pg_temp.assert_true(
  public.canonical_knowledge_entity_key('product_family', 'RHS') = 'rectangulartube',
  'RHS must align with the P0.4 rectangular tube family'
);

-- Privileged resolver functions remain service-role only, but no longer rely on
-- SECURITY DEFINER in the exposed public schema.
select pg_temp.assert_true(
  not (select prosecdef from pg_proc where oid='public.resolve_commercial_entities(uuid,uuid,integer)'::regprocedure),
  'resolver must be SECURITY INVOKER'
);
select pg_temp.assert_true(
  not (select prosecdef from pg_proc where oid='public.sync_knowledge_entity_bindings(uuid)'::regprocedure),
  'binding sync must be SECURITY INVOKER'
);
select pg_temp.assert_true(
  not (select prosecdef from pg_proc where oid='public.merge_knowledge_entities(uuid,uuid,text)'::regprocedure),
  'merge RPC must be SECURITY INVOKER'
);
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.resolve_commercial_entities(uuid,uuid,integer)', 'EXECUTE'),
  'authenticated must not execute resolver RPC'
);
select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.resolve_commercial_entities(uuid,uuid,integer)', 'EXECUTE'),
  'service_role must execute resolver RPC'
);

-- Synthetic identities / tenants.
insert into auth.users (id) values
  ('71000000-0000-0000-0000-000000000001'::uuid),
  ('71000000-0000-0000-0000-000000000002'::uuid),
  ('72000000-0000-0000-0000-000000000001'::uuid);

insert into public.organizations (id, name, slug, created_by) values
  ('73000000-0000-0000-0000-000000000001'::uuid, 'P0.7 Tenant A', 'p0-7-tenant-a', '71000000-0000-0000-0000-000000000001'::uuid),
  ('73000000-0000-0000-0000-000000000002'::uuid, 'P0.7 Tenant B', 'p0-7-tenant-b', '72000000-0000-0000-0000-000000000001'::uuid);

insert into public.organization_memberships (organization_id, user_id, role, status, is_default) values
  ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'admin', 'active', true),
  ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'member', 'active', true),
  ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 'admin', 'active', true);

-- Private canonical identity is organization-scoped, not user-scoped.
insert into public.knowledge_entities (
  id, owner_id, organization_id, access_scope, entity_type,
  canonical_key, canonical_name, normalized_name, metadata
) values (
  '74000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  'owner', 'company', 'tenantacme', 'Tenant Acme', 'tenantacme', '{}'
);

do $$
begin
  begin
    insert into public.knowledge_entities (
      id, owner_id, organization_id, access_scope, entity_type,
      canonical_key, canonical_name, normalized_name, metadata
    ) values (
      '74000000-0000-0000-0000-000000000002',
      '71000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000001',
      'owner', 'company', 'tenantacme', 'Tenant Acme duplicate', 'tenantacme', '{}'
    );
    raise exception 'same-tenant duplicate private entity unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end;
$$;

-- Alias governance: the same normalized alias cannot silently resolve to two
-- different canonical entities of the same type and scope.
insert into public.knowledge_entities (
  id, owner_id, organization_id, access_scope, entity_type,
  canonical_key, canonical_name, normalized_name, metadata
) values
  ('75000000-0000-0000-0000-000000000001', null, null, 'global', 'application', 'pressurepiping', 'Pressure Piping', 'pressurepiping', '{}'),
  ('75000000-0000-0000-0000-000000000002', null, null, 'global', 'application', 'structuralpiping', 'Structural Piping', 'structuralpiping', '{}');

insert into public.knowledge_entity_aliases (
  id, entity_id, alias, normalized_alias, alias_type, confidence, metadata
) values (
  '76000000-0000-0000-0000-000000000001',
  '75000000-0000-0000-0000-000000000001',
  'Pipe application', 'ignored-by-trigger', 'manual', 1, '{}'
);

do $$
begin
  begin
    insert into public.knowledge_entity_aliases (
      id, entity_id, alias, normalized_alias, alias_type, confidence, metadata
    ) values (
      '76000000-0000-0000-0000-000000000002',
      '75000000-0000-0000-0000-000000000002',
      'Pipe application', 'also-ignored', 'manual', 1, '{}'
    );
    raise exception 'ambiguous alias unexpectedly succeeded';
  exception
    when others then
      if position('Ambiguous knowledge alias' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- Explicit merge governance: same type/scope only, audited and atomic.
select public.merge_knowledge_entities(
  '75000000-0000-0000-0000-000000000001',
  '75000000-0000-0000-0000-000000000002',
  'P0.7 acceptance merge'
);
select pg_temp.assert_true(
  not exists (select 1 from public.knowledge_entities where id='75000000-0000-0000-0000-000000000001'),
  'source entity must be removed after explicit merge'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.knowledge_entity_aliases
    where entity_id='75000000-0000-0000-0000-000000000002'
      and normalized_alias='pipeapplication'
  ),
  'source alias must move to merge target'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.knowledge_entity_merge_audit
    where source_entity_id='75000000-0000-0000-0000-000000000001'
      and target_entity_id='75000000-0000-0000-0000-000000000002'
      and reason='P0.7 acceptance merge'
  ),
  'manual merge must create audit evidence'
);

-- Tenant A commercial corpus.
insert into public.commercial_datasets (
  id, owner_id, organization_id, source_run_id, source_filename, parser_version, status
) values (
  '77000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000011',
  'p0-7-test.eml', 'v4', 'active'
);

insert into public.commercial_threads (
  id, owner_id, organization_id, dataset_id, source_conversation_id,
  subject, classification, email_count
) values (
  '78000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000011',
  'P0.7 resolver acceptance', 'offer', 1
);

insert into public.commercial_observations (
  id, owner_id, organization_id, dataset_id, thread_id, source_conversation_id,
  item_role, role_method, product_type, grade, standard,
  outer_diameter_mm, thickness_mm, source_filename, source_text, confidence, flags
) values (
  7900000000001,
  '71000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000011',
  'offered', 'worker_v4', 'round_tube', 'S355 J2H', 'EN10219',
  406.4, 6.3, 'p0-7-test.eml',
  'Offro S355 J2H EN10219 406,4x6,3', 0.76, '[]'
);

-- Tenant-local and cross-tenant documents.
insert into public.knowledge_sources (
  id, owner_id, organization_id, access_scope, source_key, source_type,
  source_class, name
) values
  ('7a000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'owner', 'p0-7-source-a', 'commercial_archive', 'internal', 'P0.7 Tenant A source'),
  ('7a000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', 'owner', 'p0-7-source-b', 'commercial_archive', 'internal', 'P0.7 Tenant B source');

insert into public.knowledge_documents (
  id, source_id, external_id, document_type, title, filename,
  content_checksum, extraction_method, extraction_version, status, metadata
) values
  ('7b000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000001', 'p0-7-doc-a', 'email_message', 'Tenant A doc', 'a.eml', 'p07-doc-a-checksum', 'test', 'p0.7', 'ready', '{}'),
  ('7b000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000002', 'p0-7-doc-b', 'email_message', 'Tenant B doc', 'b.eml', 'p07-doc-b-checksum', 'test', 'p0.7', 'ready', '{}');

insert into public.knowledge_chunks (
  id, source_id, document_id, chunk_index, content, content_checksum,
  source_locator, metadata
) values (
  '7c000000-0000-0000-0000-000000000001',
  '7a000000-0000-0000-0000-000000000001',
  '7b000000-0000-0000-0000-000000000001',
  0,
  'Offro S355 J2H EN10219 406,4x6,3',
  'p07-chunk-a-checksum',
  jsonb_build_object('test', true),
  '{}'
);

-- An explicit document from another tenant must fail closed before resolution.
do $$
begin
  begin
    perform public.resolve_commercial_entities(
      '78000000-0000-0000-0000-000000000001',
      '7b000000-0000-0000-0000-000000000002',
      100
    );
    raise exception 'cross-tenant document grounding unexpectedly succeeded';
  exception
    when others then
      if position('not visible to thread tenant' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- Tenant A document resolves three fields. Confidence must never exceed the
-- source observation, and format variants must use P0.4-aligned canonical keys.
select public.resolve_commercial_entities(
  '78000000-0000-0000-0000-000000000001',
  '7b000000-0000-0000-0000-000000000001',
  100
);

select pg_temp.assert_true(
  (select count(*) = 3 from public.knowledge_entity_mentions where observation_id=7900000000001),
  'resolver must create exactly grade/standard/product-family mentions'
);
select pg_temp.assert_true(
  (select bool_and(confidence = 0.76) from public.knowledge_entity_mentions where observation_id=7900000000001),
  'mention confidence must equal source observation confidence'
);
select pg_temp.assert_true(
  (select bool_and(resolver_version='p0.7-v2' and resolver_method='canonical_exact') from public.knowledge_entity_mentions where observation_id=7900000000001),
  'mentions must use the P0.7 resolver contract'
);
select pg_temp.assert_true(
  exists (
    select 1
    from public.knowledge_entity_mentions m
    join public.knowledge_entities e on e.id=m.entity_id
    where m.observation_id=7900000000001 and m.source_field='grade'
      and e.canonical_key='s355j2h'
  ),
  'S355 J2H must resolve to canonical grade key s355j2h'
);
select pg_temp.assert_true(
  exists (
    select 1
    from public.knowledge_entity_mentions m
    join public.knowledge_entities e on e.id=m.entity_id
    where m.observation_id=7900000000001 and m.source_field='standard'
      and e.canonical_key='en10219'
  ),
  'EN10219 must resolve to canonical standard key en10219'
);
select pg_temp.assert_true(
  (select bool_and(source_id='7a000000-0000-0000-0000-000000000001'::uuid and document_id='7b000000-0000-0000-0000-000000000001'::uuid and chunk_id='7c000000-0000-0000-0000-000000000001'::uuid)
   from public.knowledge_entity_mentions where observation_id=7900000000001),
  'all mentions must ground only to the same-tenant source/document/chunk'
);

-- Idempotency: a second resolution must select no fields and create no duplicates.
do $$
declare
  v_result jsonb;
  v_before integer;
  v_after integer;
begin
  select count(*) into v_before from public.knowledge_entity_mentions where observation_id=7900000000001;
  v_result := public.resolve_commercial_entities(
    '78000000-0000-0000-0000-000000000001',
    '7b000000-0000-0000-0000-000000000001',
    100
  );
  select count(*) into v_after from public.knowledge_entity_mentions where observation_id=7900000000001;

  if coalesce((v_result->>'selected_observation_count')::integer, -1) <> 0 then
    raise exception 'P0.7 resolver is not idempotent: %', v_result;
  end if;
  if v_after <> v_before then
    raise exception 'P0.7 second run changed mention count: % -> %', v_before, v_after;
  end if;
end;
$$;

-- Health contract must report zero critical issues inside the acceptance fixture.
do $$
declare
  v_health jsonb;
begin
  v_health := public.entity_resolution_health();
  if coalesce((v_health->>'critical_issue_count')::integer, -1) <> 0 then
    raise exception 'P0.7 health contract reports critical issues: %', v_health;
  end if;
end;
$$;

rollback;
