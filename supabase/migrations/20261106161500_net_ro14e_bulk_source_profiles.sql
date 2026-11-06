-- NET-RO1.4.E — One protected publish wave for ALL 122 source-backed,
-- nonduplicate Romanian candidates. The other 125 private seeds remain held.
-- DEFINITION ONLY: do not call with TRUE until PR merge, live account visual
-- acceptance, approved deploy window, and a successful FALSE preview.
-- Supersedes execution of the older WEB20 function (same 20 are included here).
CREATE OR REPLACE FUNCTION private.network_ro14e_publish_bulk122(
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_cohort constant jsonb := '[{"domain":"alconind.ro","role":"trader_distributor"},{"domain":"alexroinvest.com","role":"processor_service_provider"},{"domain":"alvi-technik.com","role":"processor_service_provider"},{"domain":"alytim.ro","role":"processor_service_provider"},{"domain":"arcgrup.ro","role":"processor_service_provider"},{"domain":"arcotrust.ro","role":"trader_distributor"},{"domain":"armetal-tech.ro","role":"processor_service_provider"},{"domain":"atelier49.ro","role":"processor_service_provider"},{"domain":"avirob.eu","role":"processor_service_provider"},{"domain":"binavis.ro","role":"processor_service_provider"},{"domain":"blackseasuppliers.ro","role":"trader_distributor"},{"domain":"caroltech.ro","role":"processor_service_provider"},{"domain":"centrudebitarelaser.ro","role":"processor_service_provider"},{"domain":"cncadvertising.ro","role":"processor_service_provider"},{"domain":"comtechco.ro","role":"producer"},{"domain":"constal.ro","role":"trader_distributor"},{"domain":"dacotransdb.ro","role":"trader_distributor"},{"domain":"debitare-carotare-laser.ro","role":"processor_service_provider"},{"domain":"deccons.ro","role":"trader_distributor"},{"domain":"directline.ro","role":"trader_distributor"},{"domain":"ditaindustrial.ro","role":"trader_distributor"},{"domain":"eastman.ro","role":"processor_service_provider"},{"domain":"edmarom.ro","role":"processor_service_provider"},{"domain":"eisen-metal.ro","role":"trader_distributor"},{"domain":"eurobusines.ro","role":"processor_service_provider"},{"domain":"euroteh.ro","role":"processor_service_provider"},{"domain":"eurozonemetal.ro","role":"trader_distributor"},{"domain":"evinox.ro","role":"processor_service_provider"},{"domain":"globalnavalproduction.ro","role":"processor_service_provider"},{"domain":"globex.ro","role":"processor_service_provider"},{"domain":"grantmetal.ro","role":"trader_distributor"},{"domain":"greenstal.ro","role":"trader_distributor"},{"domain":"grossner.ro","role":"trader_distributor"},{"domain":"groupmetal.ro","role":"trader_distributor"},{"domain":"habaresearch.eu","role":"processor_service_provider"},{"domain":"hatboru.ro","role":"producer"},{"domain":"iasi.metinvestholding.com","role":"producer"},{"domain":"inoxcom.ro","role":"trader_distributor"},{"domain":"inoxmetalssr.ro","role":"trader_distributor"},{"domain":"intacteco.ro","role":"trader_distributor"},{"domain":"intermetal.ro","role":"processor_service_provider"},{"domain":"irum.ro","role":"processor_service_provider"},{"domain":"italinox.ro","role":"trader_distributor"},{"domain":"konigfrankstahl.ro","role":"trader_distributor"},{"domain":"kueryosteel.ro","role":"trader_distributor"},{"domain":"laserstarke.ro","role":"processor_service_provider"},{"domain":"lavitexmetalic.ro","role":"processor_service_provider"},{"domain":"lio-metal.ro","role":"producer"},{"domain":"marex-distribution.ro","role":"trader_distributor"},{"domain":"marola.ro","role":"trader_distributor"},{"domain":"materialeconstructiiploiesti.ro","role":"trader_distributor"},{"domain":"mawi-innovations.ro","role":"processor_service_provider"},{"domain":"maxmetal.ro","role":"processor_service_provider"},{"domain":"megaspan.ro","role":"processor_service_provider"},{"domain":"megatitan.ro","role":"processor_service_provider"},{"domain":"melindasteel.ro","role":"trader_distributor"},{"domain":"meta-cos.ro","role":"trader_distributor"},{"domain":"metal-green.ro","role":"trader_distributor"},{"domain":"metalcas.ro","role":"trader_distributor"},{"domain":"metaldistrib.ro","role":"trader_distributor"},{"domain":"metaleinternational.ro","role":"trader_distributor"},{"domain":"metalerw.eu","role":"processor_service_provider"},{"domain":"metalman.ro","role":"processor_service_provider"},{"domain":"metaltrading.ro","role":"trader_distributor"},{"domain":"mitliv.ro","role":"trader_distributor"},{"domain":"mos.ro","role":"processor_service_provider"},{"domain":"mpxmetal.ro","role":"trader_distributor"},{"domain":"mrg-group.ro","role":"trader_distributor"},{"domain":"navmaro.ro","role":"processor_service_provider"},{"domain":"nedtrix.ro","role":"processor_service_provider"},{"domain":"net-invest.ro","role":"trader_distributor"},{"domain":"netvers.ro","role":"processor_service_provider"},{"domain":"nicmardanci.ro","role":"processor_service_provider"},{"domain":"olimpimpex.ro","role":"trader_distributor"},{"domain":"omgsteel.ro","role":"trader_distributor"},{"domain":"orioninvest.ro","role":"processor_service_provider"},{"domain":"otelstructuri.ro","role":"trader_distributor"},{"domain":"piese-metalice.ro","role":"processor_service_provider"},{"domain":"pipes-distribution-romania.ro","role":"trader_distributor"},{"domain":"primetal.ro","role":"trader_distributor"},{"domain":"prodima.ro","role":"processor_service_provider"},{"domain":"prodis.ro","role":"processor_service_provider"},{"domain":"produse-metalurgice.ro","role":"trader_distributor"},{"domain":"profilometal.ro","role":"trader_distributor"},{"domain":"proinvestgroup.ro","role":"producer"},{"domain":"propipingproducts.com","role":"producer"},{"domain":"qcb.ro","role":"trader_distributor"},{"domain":"rematbv.ro","role":"trader_distributor"},{"domain":"retacom.ro","role":"trader_distributor"},{"domain":"rielacomimpex.ro","role":"processor_service_provider"},{"domain":"rlhconstruct.com","role":"trader_distributor"},{"domain":"roma2s.com","role":"processor_service_provider"},{"domain":"sci-distribution.ro","role":"trader_distributor"},{"domain":"serviciilaser.ro","role":"processor_service_provider"},{"domain":"smp-srl.ro","role":"processor_service_provider"},{"domain":"soymex.ro","role":"processor_service_provider"},{"domain":"steeltube.ro","role":"trader_distributor"},{"domain":"stelcoro.ro","role":"processor_service_provider"},{"domain":"stepproiect.ro","role":"processor_service_provider"},{"domain":"stift.ro","role":"trader_distributor"},{"domain":"suntec.ro","role":"processor_service_provider"},{"domain":"technicsteel.ro","role":"processor_service_provider"},{"domain":"tevi-laminate.ro","role":"trader_distributor"},{"domain":"tevi-romania.ro","role":"trader_distributor"},{"domain":"thebacons.ro","role":"trader_distributor"},{"domain":"thm.ro","role":"trader_distributor"},{"domain":"thyssenkrupp-materials.ro","role":"trader_distributor"},{"domain":"titansteelco.ro","role":"trader_distributor"},{"domain":"tomarimpex.ro","role":"trader_distributor"},{"domain":"totalstainlesssteel.com","role":"producer"},{"domain":"trotusgrup.ro","role":"trader_distributor"},{"domain":"trutzi.ro","role":"trader_distributor"},{"domain":"unionserv.ro","role":"processor_service_provider"},{"domain":"uprucctr.com","role":"producer"},{"domain":"utchimsteel.ro","role":"trader_distributor"},{"domain":"vangaltech.ro","role":"processor_service_provider"},{"domain":"vanzarimateriale.ro","role":"trader_distributor"},{"domain":"vastrum.ro","role":"trader_distributor"},{"domain":"viacon-steel.ro","role":"trader_distributor"},{"domain":"wsteel.ro","role":"trader_distributor"},{"domain":"xpozit.ro","role":"processor_service_provider"},{"domain":"zeuscorporation.eu","role":"trader_distributor"}]'::jsonb;
  v_expected constant integer := 122;
  v_wave constant text := 'NET-RO1.4.E-BULK122';
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
    pg_catalog.hashtext('NET-RO1.4.E-BULK122')
  );
  IF coalesce(p_commit,false) THEN
    LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  SELECT count(*),count(DISTINCT c.domain)
  INTO v_manifest_count,v_manifest_unique
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS c(domain text, role text);
  IF v_manifest_count<>v_expected OR v_manifest_unique<>v_expected THEN
    RAISE EXCEPTION 'NET-RO1.4.E: corrupted or duplicated pinned cohort';
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
    RAISE EXCEPTION 'NET-RO1.4.E: unexpected partial wave %/%',
      v_previous,v_expected;
  END IF;

  SELECT count(*) INTO v_existing_public
  FROM public.network_companies
  WHERE country_code='RO' AND publication_status='published';
  IF v_existing_public<>9 THEN
    RAISE EXCEPTION 'NET-RO1.4.E: live RO public baseline drifted (% vs 9)',
      v_existing_public;
  END IF;

  SELECT count(*) INTO v_suppressed
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS x(domain text, role text)
  JOIN public.network_netfast3_suppressed_domains d ON d.domain=x.domain;
  IF v_suppressed<>0 THEN
    RAISE EXCEPTION 'NET-RO1.4.E: suppressed or opted-out domains (%)',
      v_suppressed;
  END IF;

  -- Fail closed if any of the 122 pinned names, domains, roles or source
  -- quality markers changed, including duplicates introduced after this PR.
  SELECT count(*) INTO v_eligible
  FROM pg_catalog.jsonb_to_recordset(v_cohort) AS m(domain text, role text)
  JOIN private.network_web_research_seeds s
    ON s.country_code='RO' AND s.canonical_domain=m.domain
   AND s.proposed_role=m.role
  JOIN public.network_company_roles r
    ON r.canonical_key=m.role AND r.status='active'
  WHERE s.source_kind='first_party_web'
    AND s.review_lane='web_profile_review_pending'
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
      SELECT 1 FROM private.network_ro14c_publication_links l
      WHERE l.seed_id=s.id OR l.research_id=s.research_id
    );
  IF v_eligible<>v_expected THEN
    RAISE EXCEPTION
      'NET-RO1.4.E: eligible % vs pinned %, abort; reconcile without partial inserts',
      v_eligible,v_expected;
  END IF;

  IF NOT coalesce(p_commit,false) THEN
    RETURN pg_catalog.jsonb_build_object(
      'wave',v_wave,'status','preview_only','eligible',v_eligible,
      'already_public_ro_expected',9,'would_publish',v_expected,
      'expected_total_public_ro',131,'held_private_candidates',125,
      'suppressed',v_suppressed,'created_now',0,'requires_explicit_commit',true);
  END IF;

  SELECT id INTO v_family_id
  FROM public.network_product_families
  WHERE canonical_key='tubes_pipes' AND status='active';
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'NET-RO1.4.E: active tubes_pipes family not found';
  END IF;

  FOR v_seed IN
    SELECT s.*
    FROM pg_catalog.jsonb_to_recordset(v_cohort) AS m(domain text, role text)
    JOIN private.network_web_research_seeds s
      ON s.canonical_domain=m.domain AND s.country_code='RO'
     AND s.proposed_role=m.role
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
    THEN RAISE EXCEPTION 'NET-RO1.4.E: collision on %',v_seed.canonical_domain;
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
      'company',v_company_id,'netro14e_public_web_profile',
      pg_catalog.jsonb_build_object(
        'research_id',v_seed.research_id,
        'source_kind',v_seed.source_kind,
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
    IF v_seed.source_summary ~* '(tub|teav|țeav|pipe|piping|profil|hss)' THEN
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
    RAISE EXCEPTION 'NET-RO1.4.E: atomic count mismatch % vs %',
      v_published,v_expected;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'wave',v_wave,'status','published','published_count',v_published,
    'claimed',0,'verified',0,'expected_total_public_ro',131);
END;
$fn$;

REVOKE ALL ON FUNCTION private.network_ro14e_publish_bulk122(boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.network_ro14e_publish_bulk122(boolean)
  TO service_role;
