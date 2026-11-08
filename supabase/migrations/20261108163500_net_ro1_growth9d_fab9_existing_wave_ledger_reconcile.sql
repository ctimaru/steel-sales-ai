-- NET-RO1.GROWTH9.D — Reconcile ONLY source-linked nine public-company
-- ledger labels after the wave was published by a concurrent operator.
-- Legacy label was 'NET-RO1.GROWTH9.D-FAB15' due an inherited constant,
-- despite all nine domains and research IDs belonging to FAB9.
-- This migration never inserts/updates company, facility, role or contact data.
-- Historical published_at timestamps and all PK/FK identifiers are preserved.
DO $reconcile_fab9$
DECLARE
  v_manifest constant jsonb := '[{"domain":"cadranindustries.ro","research_id":"NET-RO1-G9D-001","source_url":"https://www.cadranindustries.ro/","role":"processor_service_provider","nuts":"RO11"},{"domain":"galemidmetal.ro","research_id":"NET-RO1-G9D-002","source_url":"https://galemidmetal.ro/contact/","role":"processor_service_provider","nuts":"RO11"},{"domain":"atlasmetalwork.ro","research_id":"NET-RO1-G9D-003","source_url":"https://atlasmetalwork.ro/en","role":"processor_service_provider","nuts":"RO22"},{"domain":"industrial-montaj.ro","research_id":"NET-RO1-G9D-004","source_url":"https://www.industrial-montaj.ro/","role":"processor_service_provider","nuts":"RO31"},{"domain":"confind.ro","research_id":"NET-RO1-G9D-005","source_url":"https://www.confind.ro/","role":"processor_service_provider","nuts":"RO31"},{"domain":"structb.com","research_id":"NET-RO1-G9D-006","source_url":"https://www.structb.com/","role":"processor_service_provider","nuts":"RO21"},{"domain":"ozelsteelprofil.ro","research_id":"NET-RO1-G9D-007","source_url":"https://www.ozelsteelprofil.ro/ozel-steel-profil-srl-despre-companie.html","role":"producer","nuts":"RO31"},{"domain":"skela.ro","research_id":"NET-RO1-G9D-008","source_url":"https://www.skela.ro/ro/","role":"processor_service_provider","nuts":"RO32"},{"domain":"ardacometal.ro","research_id":"NET-RO1-G9D-009","source_url":"https://www.ardacometal.ro/","role":"processor_service_provider","nuts":"RO31"}]'::jsonb;
  v_old_wave constant text := 'NET-RO1.GROWTH9.D-FAB15';
  v_correct_wave constant text := 'NET-RO1.GROWTH9.D-FAB9';
  v_total integer;
  v_matching integer;
  v_old_count integer;
  v_correct_count integer;
  v_updated integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('NET-RO1.GROWTH9.D-FAB9')
  );
  LOCK TABLE private.network_ro14c_publication_links IN SHARE ROW EXCLUSIVE MODE;

  IF (SELECT count(*) FROM public.network_companies
      WHERE country_code='RO' AND publication_status='published' AND archived_at IS NULL) <> 220
     OR (SELECT count(*) FROM private.network_web_research_seeds
         WHERE country_code='RO') <> 313
  THEN RAISE EXCEPTION
    'NET-RO1.GROWTH9.D ledger reconciliation: baseline drift (must be 220/313)'; END IF;

  SELECT count(*) INTO v_total
  FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
    domain text,research_id text,source_url text,role text,nuts text
  );
  IF v_total<>9 OR
    (SELECT count(DISTINCT m.domain)
       FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(domain text))<>9 OR
    (SELECT count(DISTINCT m.research_id)
       FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(research_id text))<>9
  THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.D ledger reconciliation: corrupt cohort'; END IF;

  SELECT count(*) INTO v_old_count
  FROM private.network_ro14c_publication_links
  WHERE publication_wave=v_old_wave;
  SELECT count(*) INTO v_correct_count
  FROM private.network_ro14c_publication_links
  WHERE publication_wave=v_correct_wave;
  IF v_old_count<>9 OR v_correct_count<>0
  THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.D ledger reconciliation: wrong old/new counts %/%',
    v_old_count,v_correct_count; END IF;

  SELECT count(*) INTO v_matching
  FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
      domain text,research_id text,source_url text,role text,nuts text)
  JOIN private.network_ro14c_publication_links l
    ON l.research_id=m.research_id AND l.publication_wave=v_old_wave
    AND l.published_source_url=m.source_url
  JOIN private.network_web_research_seeds s
    ON s.id=l.seed_id AND s.country_code='RO'
    AND s.canonical_domain=m.domain AND s.research_id=m.research_id
    AND s.proposed_role=m.role AND s.source_url=m.source_url
    AND s.batch_key='NET-RO1-G9D-FAB9'
  JOIN public.network_companies c
    ON c.id=l.company_id AND c.country_code='RO'
    AND c.website_domain=m.domain AND c.publication_status='published'
    AND c.archived_at IS NULL AND c.claimed_status='unclaimed'
    AND c.verification_status='unverified'
  WHERE EXISTS(
      SELECT 1 FROM public.network_company_role_assignments a
      JOIN public.network_company_roles r ON r.id=a.role_id
      WHERE a.company_id=c.id AND a.is_primary=true AND r.canonical_key=m.role
    )
    AND EXISTS(
      SELECT 1 FROM public.network_facilities fac
      WHERE fac.company_id=c.id AND fac.country_code='RO'
        AND fac.eu_nuts2024_code=m.nuts AND fac.publication_status='published'
    )
    AND EXISTS(
      SELECT 1 FROM public.network_data_assertions da
      WHERE da.entity_type='company' AND da.entity_id=c.id
        AND da.field_path='netro_growth9d_fabricator_web'
        AND da.source_type='public_web' AND da.source_reference=m.source_url
    );
  IF v_matching<>9
  THEN RAISE EXCEPTION
      'NET-RO1.GROWTH9.D ledger reconciliation: matching source-backed identities %/9',
      v_matching; END IF;

  UPDATE private.network_ro14c_publication_links l
    SET publication_wave=v_correct_wave
  WHERE l.publication_wave=v_old_wave
    AND EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
        domain text,research_id text,source_url text,role text,nuts text)
      WHERE m.research_id=l.research_id AND m.source_url=l.published_source_url
    );
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>9
  THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.D ledger reconciliation: only %/9 updated',v_updated; END IF;

  SELECT count(*) INTO v_correct_count
  FROM private.network_ro14c_publication_links
  WHERE publication_wave=v_correct_wave;
  SELECT count(*) INTO v_old_count
  FROM private.network_ro14c_publication_links
  WHERE publication_wave=v_old_wave;
  IF v_correct_count<>9 OR v_old_count<>0
  THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.D ledger reconciliation: readback mismatch %/%',
    v_correct_count,v_old_count; END IF;
END;
$reconcile_fab9$;
