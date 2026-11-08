-- NET-RO1.GROWTH8.B — source-backed Romania claimable END-USER launch.
-- 11 industrial end users, 5 processors, MAIRON TUBES as one producer.
-- DEFINITION ONLY; applying this migration inserts NO public companies.
-- A separate privileged preview (false) and explicit atomic commit (true)
-- are mandatory. No verified tube procurement, contacts, RFQ or cert claims.
CREATE OR REPLACE FUNCTION private.network_ro1g8b_publish_wave17(
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_cohort constant jsonb := '[{"domain":"agrojet-sa.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-001"},{"domain":"astra-passengers.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-013"},{"domain":"chiulan.ro","role":"processor_service_provider","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-002"},{"domain":"comerpan.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-014"},{"domain":"ereste-star.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-003"},{"domain":"groupdual.ro","role":"processor_service_provider","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-004"},{"domain":"isaf.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-018"},{"domain":"mairon-tubes.ro","role":"producer","lane":"web_profile_review_pending","research_id":"NET-RO1-026"},{"domain":"mettim.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-020"},{"domain":"nimbconsmetal.ro","role":"processor_service_provider","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-007"},{"domain":"oehlermecanica.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-008"},{"domain":"renico.ro","role":"processor_service_provider","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-009"},{"domain":"revasimeria.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-021"},{"domain":"ruloteaxer.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-022"},{"domain":"ssabag.ro","role":"processor_service_provider","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-010"},{"domain":"umem.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-011"},{"domain":"uvaiud.ro","role":"end_user","lane":"web_profile_review_pending","research_id":"NET-RO1-G8-025"}]'::jsonb;
  v_expected constant integer := 17;
  v_wave constant text := 'NET-RO1.GROWTH8.B-WEB17';
  v_manifest_count integer;
  v_unique_domains integer;
  v_unique_research_ids integer;
  v_existing_public integer;
  v_research_count integer;
  v_eligible integer;
  v_suppressed integer;
  v_previous integer;
  v_previous_valid integer;
  v_published integer := 0;
  v_company_id uuid;
  v_role_id uuid;
  v_family_id uuid;
  v_assertion_id uuid;
  v_description text;
  v_seed record;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('NET-RO1.GROWTH8.B-WEB17')
  );
  IF coalesce(p_commit,false) THEN
    -- Take serialization locks before checking the baseline and writing.
    LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
    LOCK TABLE private.network_web_research_seeds IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  SELECT count(*),count(DISTINCT x.domain),count(DISTINCT x.research_id)
  INTO v_manifest_count,v_unique_domains,v_unique_research_ids
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS x(
    domain text,role text,lane text,research_id text
  );
  IF v_manifest_count<>v_expected OR v_unique_domains<>v_expected
     OR v_unique_research_ids<>v_expected THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH8.B: corrupted/duplicated pinned cohort';
  END IF;

  SELECT count(*) INTO v_previous
  FROM private.network_ro14c_publication_links
  WHERE publication_wave=v_wave;
  IF v_previous=v_expected THEN
    SELECT count(*) INTO v_previous_valid
    FROM private.network_ro14c_publication_links l
    JOIN public.network_companies c ON c.id=l.company_id
    JOIN private.network_web_research_seeds s ON s.id=l.seed_id
    JOIN pg_catalog.jsonb_to_recordset(v_cohort) AS m(
      domain text,role text,lane text,research_id text)
      ON m.domain=c.website_domain AND m.research_id=l.research_id
    WHERE l.publication_wave=v_wave
      AND c.country_code='RO' AND c.publication_status='published'
      AND c.archived_at IS NULL
      AND c.claimed_status='unclaimed'
      AND c.verification_status='unverified'
      AND s.canonical_domain=m.domain
      AND s.proposed_role=m.role;
    IF v_previous_valid=v_expected THEN
      RETURN pg_catalog.jsonb_build_object(
        'wave',v_wave,'status','already_published',
        'count',v_expected,'created_now',0);
    END IF;
  END IF;
  IF v_previous<>0 THEN
    RAISE EXCEPTION
      'NET-RO1.GROWTH8.B: partial/inconsistent wave %/%',
      v_previous,v_expected;
  END IF;

  SELECT count(*) INTO v_existing_public
  FROM public.network_companies
  WHERE country_code='RO' AND publication_status='published'
    AND archived_at IS NULL;
  IF v_existing_public<>171 THEN
    RAISE EXCEPTION
      'NET-RO1.GROWTH8.B: RO public baseline drifted (% vs 171)',
      v_existing_public;
  END IF;

  SELECT count(*) INTO v_research_count
  FROM private.network_web_research_seeds WHERE country_code='RO';
  IF v_research_count<>281 THEN
    RAISE EXCEPTION
      'NET-RO1.GROWTH8.B: private research baseline drifted (% vs 281)',
      v_research_count;
  END IF;

  SELECT count(*) INTO v_suppressed
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS m(
    domain text,role text,lane text,research_id text
  ) JOIN public.network_netfast3_suppressed_domains d
    ON d.domain=m.domain;
  IF v_suppressed<>0 THEN
    RAISE EXCEPTION
      'NET-RO1.GROWTH8.B: opted-out or suppressed domains (%)',
      v_suppressed;
  END IF;

  SELECT count(*) INTO v_eligible
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS m(
    domain text,role text,lane text,research_id text
  )
  JOIN private.network_web_research_seeds s
    ON s.country_code='RO'
   AND s.canonical_domain=m.domain
   AND s.proposed_role=m.role
   AND s.review_lane=m.lane
   AND s.research_id=m.research_id
  JOIN public.network_company_roles r
    ON r.canonical_key=m.role AND r.status='active'
  WHERE s.source_kind='first_party_web'
    AND s.review_lane='web_profile_review_pending'
    AND s.publication_status='not_published'
    AND s.claim_status='unclaimed'
    AND s.verification_status='web_sourced_unverified'
    AND s.source_url ~ '^https://'
    AND length(trim(s.display_name))>=3
    AND length(trim(coalesce(s.source_summary,'')))>=30
    AND ((s.batch_key='NET-RO1-G8-NEW25'
       AND s.proposed_role IN ('end_user','processor_service_provider'))
       OR (s.canonical_domain='mairon-tubes.ro'
          AND s.proposed_role='producer'
          AND s.research_id='NET-RO1-026'
          AND s.source_url='https://www.mairon.ro/wp-content/uploads/2024/09/CatalogMaironeng2024.pdf'
          AND s.source_summary LIKE 'Catalogo ufficiale MAIRON:%'))
    AND NOT EXISTS(
      SELECT 1 FROM public.network_companies c
      WHERE lower(c.website_domain)=s.canonical_domain
        OR (c.country_code='RO'
          AND pg_catalog.regexp_replace(lower(c.legal_name),
            '[^[:alnum:]]','','g')=
            pg_catalog.regexp_replace(lower(s.display_name),
            '[^[:alnum:]]','','g'))
    )
    AND NOT EXISTS(
      SELECT 1 FROM private.network_web_research_seeds other
      WHERE other.id<>s.id AND other.country_code='RO'
        AND pg_catalog.regexp_replace(lower(other.display_name),
          '[^[:alnum:]]','','g')=
          pg_catalog.regexp_replace(lower(s.display_name),
          '[^[:alnum:]]','','g')
    )
    AND NOT EXISTS(
      SELECT 1 FROM private.network_ro14c_publication_links l
      WHERE l.seed_id=s.id OR l.research_id=s.research_id
    );
  IF v_eligible<>v_expected THEN
    RAISE EXCEPTION
      'NET-RO1.GROWTH8.B: only %/% eligible, abort without partial inserts',
      v_eligible,v_expected;
  END IF;

  IF NOT coalesce(p_commit,false) THEN
    RETURN pg_catalog.jsonb_build_object(
      'wave',v_wave,'status','preview_only',
      'eligible',v_eligible,'suppressed',v_suppressed,'created_now',0,
      'would_publish',v_expected,
      'already_public_ro_expected',171,'expected_total_public_ro',188,
      'new_end_users',11,'new_processors',5,'new_producers',1,
      'requires_explicit_commit',true);
  END IF;

  SELECT id INTO v_family_id FROM public.network_product_families
  WHERE canonical_key='tubes_pipes' AND status='active';
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH8.B: active tubes_pipes family missing';
  END IF;

  FOR v_seed IN
    SELECT s.* FROM pg_catalog.jsonb_to_recordset(v_cohort) AS m(
      domain text,role text,lane text,research_id text)
    JOIN private.network_web_research_seeds s
      ON s.country_code='RO' AND s.canonical_domain=m.domain
      AND s.proposed_role=m.role AND s.review_lane=m.lane
      AND s.research_id=m.research_id
    ORDER BY s.research_id
  LOOP
    IF EXISTS(
      SELECT 1 FROM public.network_companies c
      WHERE lower(c.website_domain)=v_seed.canonical_domain OR
      (c.country_code='RO' AND
        pg_catalog.regexp_replace(lower(c.legal_name),
          '[^[:alnum:]]','','g')=
        pg_catalog.regexp_replace(lower(v_seed.display_name),
          '[^[:alnum:]]','','g'))
    ) THEN
      RAISE EXCEPTION 'NET-RO1.GROWTH8.B: live duplicate on %',
        v_seed.canonical_domain;
    END IF;

    SELECT id INTO STRICT v_role_id
    FROM public.network_company_roles
    WHERE canonical_key=v_seed.proposed_role AND status='active';

    v_description:=CASE v_seed.proposed_role
      WHEN 'end_user' THEN
        'Utilizzatore industriale potenziale individuato tramite sito aziendale: produzione di componenti e strutture metalliche. Acquisti di tubi, norme e fabbisogni non verificati dall’azienda.'
      WHEN 'processor_service_provider' THEN
        'Profilo di carpenteria e lavorazioni industriali da fonte web aziendale. Servizi, capacità, lavorazioni tubolari e qualifiche da confermare con l’azienda.'
      WHEN 'producer' THEN
        'Produttore di tubi saldati identificato nel catalogo ufficiale del gruppo MAIRON. Gamma, norme, certificazioni e capacità produttive non verificate dal proprietario.'
      ELSE
        'Profilo industriale individuato da fonte web aziendale; attività da verificare.'
    END;

    INSERT INTO public.network_companies(
      legal_name,country_code,website_url,website_domain,description,
      publication_status,claimed_status,verification_status
    ) VALUES(
      v_seed.display_name,'RO','https://'||v_seed.canonical_domain,
      v_seed.canonical_domain,v_description,
      'published','unclaimed','unverified'
    ) RETURNING id INTO v_company_id;

    INSERT INTO public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,
      source_type,source_reference,ownership_type,asserted_by,
      confidence,review_state
    ) VALUES(
      'company',v_company_id,'netro1g8b_public_web_profile',
      pg_catalog.jsonb_build_object(
        'research_id',v_seed.research_id,
        'source_kind',v_seed.source_kind,
        'source_review_lane',v_seed.review_lane,
        'source_url',v_seed.source_url,
        'role_key_proposed',v_seed.proposed_role,
        'role_confirmed_by_company',false,
        'industrial_tube_purchases_verified',false,
        'rfq_qualification_verified',false,
        'published_name',v_seed.display_name,
        'claimed_status','unclaimed',
        'verification_status','unverified',
        'company_certified',false,'source_evidence_only',true
      ),'public_web',v_seed.source_url,
      'platform_curated',NULL,0.50,'accepted'
    ) RETURNING id INTO v_assertion_id;

    INSERT INTO public.network_company_role_assignments(
      company_id,role_id,is_primary,source_assertion_id
    ) VALUES (v_company_id,v_role_id,true,v_assertion_id);

    -- ONLY the first-party documented tube mill gets a tubes/pipes product
    -- relationship. End-user or general metalworking does not establish a
    -- verified tube consumption, supplier offering or purchasing history.
    IF v_seed.canonical_domain='mairon-tubes.ro'
       AND v_seed.proposed_role='producer' THEN
      INSERT INTO public.network_company_products(
        company_id,product_family_id,relationship_type,source_assertion_id
      ) VALUES(v_company_id,v_family_id,'produces',v_assertion_id);
    END IF;

    INSERT INTO private.network_ro14c_publication_links(
      research_id,seed_id,company_id,published_source_url,publication_wave
    ) VALUES(
      v_seed.research_id,v_seed.id,v_company_id,v_seed.source_url,v_wave
    );
    v_published:=v_published+1;
  END LOOP;

  IF v_published<>v_expected THEN
    RAISE EXCEPTION
      'NET-RO1.GROWTH8.B: expected 17 atomic inserts, got %',v_published;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'wave',v_wave,'status','published',
    'published_count',v_published,'expected_total_public_ro',188,
    'new_end_users',11,'new_processors',5,'new_producers',1,
    'claimed',0,'verified',0);
END;
$fn$;

REVOKE ALL ON FUNCTION private.network_ro1g8b_publish_wave17(boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.network_ro1g8b_publish_wave17(boolean)
  TO service_role;
