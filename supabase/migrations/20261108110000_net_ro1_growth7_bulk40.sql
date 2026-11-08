-- NET-RO1.GROWTH7 — Source-backed claimable Romania directory, cohort 40.
-- Exactly 2 producers, 26 steel processors, 12 distributors selected from
-- previously held first-party research; review lanes pinned per company.
-- DEFINITION ONLY. This migration publishes NOTHING; service-role preview
-- and a separately authorized commit are mandatory after protected CI.
-- Source-only claims; not a certification, RFQ qualification, or owner claim.
CREATE OR REPLACE FUNCTION private.network_ro1g_publish_bulk40(
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_cohort constant jsonb := '[{"domain":"adianacom.ro","role":"trader_distributor","lane":"retail_channel_confirm_b2b"},{"domain":"akagroup.ro","role":"trader_distributor","lane":"industrial_fit_review"},{"domain":"anterasteel.ro","role":"trader_distributor","lane":"industrial_fit_review"},{"domain":"aprov.ro","role":"trader_distributor","lane":"retail_b2b_relevance_review"},{"domain":"bormanmetal.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"cataloniainox.ro","role":"trader_distributor","lane":"industrial_fit_review"},{"domain":"comelf.ro","role":"processor_service_provider","lane":"industrial_relevance_hold"},{"domain":"comsport.ro","role":"trader_distributor","lane":"retail_channel_confirm_b2b"},{"domain":"crosconstruct.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"depozitprodsid.ro","role":"trader_distributor","lane":"retail_b2b_relevance_review"},{"domain":"estmetalcab.ro","role":"producer","lane":"narrow_galvanized_tube_line"},{"domain":"feper.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"ferobanat.ro","role":"trader_distributor","lane":"retail_industrial_fit_review"},{"domain":"foniro.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"gevmet.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"girometal.ro","role":"producer","lane":"manufacturing_role_manual_check"},{"domain":"kaysser-international.com","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"laser-nsc.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"laserprocessing.ro","role":"processor_service_provider","lane":"industrial_relevance_hold"},{"domain":"meprosisteme.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"metal-pro.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"metalcut.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"metalhub.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"metallbauprodukte.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"metalogix.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"metalxpert.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"mmindustry.ro","role":"trader_distributor","lane":"industrial_fit_review"},{"domain":"nnbindustry.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"paslatehnica.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"profinox.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"ramoss.ro","role":"trader_distributor","lane":"industrial_fit_review"},{"domain":"romnef.com","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"romradiatoare.com","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"steelhaus.ro","role":"trader_distributor","lane":"retail_channel_confirm_b2b"},{"domain":"steelprofile.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"steeltek.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"tehroind.ro","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"tibpet.com","role":"processor_service_provider","lane":"industrial_fit_review"},{"domain":"tiranasteel.ro","role":"trader_distributor","lane":"industrial_fit_review"},{"domain":"vernifida.ro","role":"processor_service_provider","lane":"tube_cutting_vs_saw_not_laser"}]'::jsonb;
  v_expected constant integer := 40;
  v_wave constant text := 'NET-RO1.GROWTH7-BULK40';
  v_manifest_count integer;
  v_manifest_unique integer;
  v_eligible integer;
  v_existing_public integer;
  v_previous integer;
  v_published_existing integer;
  v_suppressed integer;
  v_published integer := 0;
  v_role_id uuid;
  v_family_id uuid;
  v_company_id uuid;
  v_assertion_id uuid;
  v_relationship text;
  v_description text;
  v_seed record;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('NET-RO1.GROWTH7-BULK40')
  );
  IF coalesce(p_commit,false) THEN
    LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  SELECT count(*),count(DISTINCT c.domain)
  INTO v_manifest_count,v_manifest_unique
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS c(domain text, role text, lane text);
  IF v_manifest_count<>v_expected OR v_manifest_unique<>v_expected THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH7: corrupted or duplicated pinned cohort';
  END IF;

  SELECT count(*) INTO v_previous
  FROM private.network_ro14c_publication_links
  WHERE publication_wave=v_wave;
  IF v_previous=v_expected THEN
    SELECT count(*) INTO v_published_existing
    FROM private.network_ro14c_publication_links l
    JOIN public.network_companies c ON c.id=l.company_id
    WHERE l.publication_wave=v_wave
      AND c.country_code='RO'
      AND c.publication_status='published';
    IF v_published_existing=v_expected THEN
      RETURN pg_catalog.jsonb_build_object(
        'wave',v_wave,'status','already_published',
        'count',v_expected,'created_now',0);
    END IF;
  END IF;
  IF v_previous<>0 THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH7: unexpected partial wave %/%',
      v_previous,v_expected;
  END IF;

  SELECT count(*) INTO v_existing_public
  FROM public.network_companies
  WHERE country_code='RO' AND publication_status='published';
  IF v_existing_public<>131 THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH7: live RO public baseline drifted (% vs 131)',
      v_existing_public;
  END IF;

  SELECT count(*) INTO v_suppressed
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS x(domain text, role text, lane text)
  JOIN public.network_netfast3_suppressed_domains d ON d.domain=x.domain;
  IF v_suppressed<>0 THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH7: suppressed or opted-out domains (%)',
      v_suppressed;
  END IF;

  -- Fail closed if any of the 40 pinned names, domains, roles or source
  -- quality markers changed, including duplicates introduced after this PR.
  SELECT count(*) INTO v_eligible
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS m(domain text, role text, lane text)
  JOIN private.network_web_research_seeds s
    ON s.country_code='RO' AND s.canonical_domain=m.domain
   AND s.proposed_role=m.role AND s.review_lane=m.lane
  JOIN public.network_company_roles r
    ON r.canonical_key=m.role AND r.status='active'
  WHERE s.source_kind='first_party_web'
    AND s.publication_status='not_published'
    AND s.verification_status='web_sourced_unverified'
    AND s.claim_status='unclaimed'
    AND s.source_url ~ '^https://'
    AND length(trim(s.display_name))>=3
    AND length(trim(coalesce(s.source_summary,'')))>=30
    AND m.role IN ('producer','trader_distributor','processor_service_provider')
    AND NOT EXISTS (
      SELECT 1 FROM public.network_companies c
      WHERE lower(c.website_domain)=s.canonical_domain
         OR (c.country_code='RO' AND
           pg_catalog.regexp_replace(lower(c.legal_name),
             '[^[:alnum:]]','','g') =
           pg_catalog.regexp_replace(lower(s.display_name),
             '[^[:alnum:]]','','g'))
    )
    AND NOT EXISTS (
      SELECT 1 FROM private.network_web_research_seeds other
      WHERE other.country_code='RO' AND other.id<>s.id
        AND pg_catalog.regexp_replace(lower(other.display_name),
          '[^[:alnum:]]','','g') =
        pg_catalog.regexp_replace(lower(s.display_name),
          '[^[:alnum:]]','','g')
    )
    AND NOT EXISTS (
      SELECT 1 FROM private.network_ro14c_publication_links l
      WHERE l.seed_id=s.id OR l.research_id=s.research_id
    );
  IF v_eligible<>v_expected THEN
    RAISE EXCEPTION
      'NET-RO1.GROWTH7: eligible % vs pinned %, abort; reconcile without partial inserts',
      v_eligible,v_expected;
  END IF;

  IF NOT coalesce(p_commit,false) THEN
    RETURN pg_catalog.jsonb_build_object(
      'wave',v_wave,'status','preview_only','eligible',v_eligible,
      'already_public_ro_expected',131,'would_publish',v_expected,
      'expected_total_public_ro',171,'held_private_candidates',85,
      'suppressed',v_suppressed,'created_now',0,'requires_explicit_commit',true);
  END IF;

  SELECT id INTO v_family_id
  FROM public.network_product_families
  WHERE canonical_key='tubes_pipes' AND status='active';
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH7: active tubes_pipes family not found';
  END IF;

  FOR v_seed IN
    SELECT s.*
    FROM pg_catalog.jsonb_to_recordset(v_cohort) AS m(domain text, role text, lane text)
    JOIN private.network_web_research_seeds s
      ON s.canonical_domain=m.domain AND s.country_code='RO'
     AND s.proposed_role=m.role AND s.review_lane=m.lane
    ORDER BY s.research_id
  LOOP
    -- Recheck inside the locked publication transaction.
    IF EXISTS (SELECT 1 FROM public.network_companies c
       WHERE lower(c.website_domain)=v_seed.canonical_domain OR
        (c.country_code='RO' AND
         pg_catalog.regexp_replace(lower(c.legal_name),
           '[^[:alnum:]]','','g') =
         pg_catalog.regexp_replace(lower(v_seed.display_name),
           '[^[:alnum:]]','','g')))
    THEN RAISE EXCEPTION 'NET-RO1.GROWTH7: collision on %',v_seed.canonical_domain;
    END IF;

    SELECT id INTO STRICT v_role_id
    FROM public.network_company_roles
    WHERE canonical_key=v_seed.proposed_role AND status='active';

    v_relationship:=CASE v_seed.proposed_role
      WHEN 'producer' THEN 'produces'
      WHEN 'trader_distributor' THEN 'distributes'
      ELSE 'processes' END;

    v_description:=CASE v_seed.proposed_role
      WHEN 'producer' THEN
        'Profilo di produzione industriale individuato da fonte web aziendale. Prodotti, capacità e qualifiche da confermare con l’azienda.'
      WHEN 'trader_distributor' THEN
        'Profilo commerciale della filiera dell’acciaio individuato da fonte web aziendale. Gamma, disponibilità e qualifiche da confermare con l’azienda.'
      ELSE
        'Profilo di lavorazioni metalliche individuato da fonte web aziendale. Servizi, macchinari e qualifiche da confermare con l’azienda.'
    END;

    INSERT INTO public.network_companies(
      legal_name,country_code,website_url,website_domain,description,
      publication_status,claimed_status,verification_status
    ) VALUES (
      v_seed.display_name,'RO','https://'||v_seed.canonical_domain,
      v_seed.canonical_domain,v_description,'published','unclaimed','unverified'
    ) RETURNING id INTO v_company_id;

    INSERT INTO public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,
      source_type,source_reference,ownership_type,asserted_by,
      confidence,review_state
    ) VALUES (
      'company',v_company_id,'netro1g_public_web_profile',
      pg_catalog.jsonb_build_object(
        'research_id',v_seed.research_id,
        'source_kind',v_seed.source_kind,
        'source_review_lane',v_seed.review_lane,
        'source_url',v_seed.source_url,
        'role_key_proposed',v_seed.proposed_role,
        'role_confirmed_by_company',false,
        'published_name',v_seed.display_name,
        'claimed_status','unclaimed','verification_status','unverified',
        'company_certified',false,'source_evidence_only',true
      ),
      'public_web',v_seed.source_url,'platform_curated',NULL,
      0.50,'accepted'
    ) RETURNING id INTO v_assertion_id;

    INSERT INTO public.network_company_role_assignments(
      company_id,role_id,is_primary,source_assertion_id
    ) VALUES (v_company_id,v_role_id,true,v_assertion_id);

    -- Do not manufacture tube capabilities or certificate claims when a
    -- source only establishes general metallic work. Leave those profiles
    -- discoverable by company/role, without false product qualification.
    IF v_seed.canonical_domain IN ('adianacom.ro','akagroup.ro','aprov.ro','cataloniainox.ro','comsport.ro','depozitprodsid.ro','estmetalcab.ro','ferobanat.ro','girometal.ro','mmindustry.ro','romnef.com','romradiatoare.com','steelhaus.ro','steelprofile.ro','vernifida.ro')
       AND v_seed.source_summary ~* '(tub|teav|țeav|pipe|piping|profil|hss)' THEN
      INSERT INTO public.network_company_products(
        company_id,product_family_id,relationship_type,source_assertion_id
      ) VALUES (v_company_id,v_family_id,v_relationship,v_assertion_id);
    END IF;

    INSERT INTO private.network_ro14c_publication_links(
      research_id,seed_id,company_id,published_source_url,publication_wave
    ) VALUES (
      v_seed.research_id,v_seed.id,v_company_id,v_seed.source_url,v_wave
    );
    v_published:=v_published+1;
  END LOOP;

  IF v_published<>v_expected THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH7: atomic count mismatch % vs %',
      v_published,v_expected;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'wave',v_wave,'status','published','published_count',v_published,
    'claimed',0,'verified',0,'expected_total_public_ro',171);
END;
$fn$;

REVOKE ALL ON FUNCTION private.network_ro1g_publish_bulk40(boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.network_ro1g_publish_bulk40(boolean)
  TO service_role;
