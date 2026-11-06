-- NET-RO1.4.D: next 20 independently paraphrased source-backed Romanian company profiles.
-- DEFINITION ONLY. Do not publish until live authenticated visual acceptance gate.
-- Depends on versioned NET-RO1.4.C crosswalk table & canonical claim ownership flow.
CREATE OR REPLACE FUNCTION private.network_ro14d_publish_wave20(
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_expected constant integer := 20;
  v_selected integer;
  v_existing integer;
  v_previous integer;
  v_suppressed integer;
  v_published integer := 0;
  v_role_id uuid;
  v_family_id uuid;
  v_company_id uuid;
  v_assertion_id uuid;
  v_relationship text;
  v_seed record;
BEGIN
  -- Not an exposed/public RPC. EXECUTE revoked from anon/authenticated below.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('NET-RO1.4.D-WEB20'));
  IF p_commit THEN
    LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  WITH curated(canonical_domain, public_description) AS
  (VALUES
    ('iasi.metinvestholding.com', 'Produzione di tubi in acciaio saldati longitudinalmente e profili strutturali destinati a impieghi industriali e nelle costruzioni.'),
    ('tevi-romania.ro', 'Distribuzione di tubi in acciaio saldati longitudinalmente, a spirale e senza saldatura per applicazioni industriali.'),
    ('metalcas.ro', 'Fornitura di tubolari in acciaio quadri, rettangolari e tondi, insieme ad altri prodotti siderurgici per carpenteria.'),
    ('qcb.ro', 'Distribuzione di tubi in acciaio quadri, rettangolari, tondi saldati e zincati per costruzioni e lavorazioni.'),
    ('ditaindustrial.ro', 'Distribuzione di tubi e profili in acciaio inossidabile, anche in sezioni tonde, quadre e rettangolari.'),
    ('intacteco.ro', 'Fornitura commerciale di profili tubolari in acciaio quadri e rettangolari destinati a costruzioni e applicazioni industriali.'),
    ('alconind.ro', 'Commercio di tubi in acciaio saldati e senza saldatura, inclusi tubolari strutturali quadri e rettangolari.'),
    ('meta-cos.ro', 'Catalogo commerciale di tubolari in acciaio quadri e rettangolari per costruzioni e carpenteria metallica.'),
    ('sci-distribution.ro', 'Vendita di tubolari rettangolari in acciaio e di altri materiali per opere e lavorazioni metalliche.'),
    ('retacom.ro', 'Distribuzione di profili tubolari rettangolari in acciaio per strutture e opere di carpenteria.'),
    ('rematbv.ro', 'Commercio di prodotti siderurgici comprendenti tubi in acciaio saldati e tubi tondi senza saldatura.'),
    ('utchimsteel.ro', 'Distribuzione di prodotti siderurgici per edilizia e industria, tra cui tubi in acciaio e profili cavi.'),
    ('metaltrading.ro', 'Fornitura di tubazioni in acciaio e materiali per progetti di infrastrutture e applicazioni industriali.'),
    ('primetal.ro', 'Vendita di tubi in acciaio tondi, quadri e rettangolari per costruzioni e carpenteria metallica.'),
    ('profilometal.ro', 'Distribuzione di tubi rettangolari in acciaio e materiali metallici destinati a cantieri e carpenteria.'),
    ('deccons.ro', 'Catalogo commerciale di tubi e profili in acciaio per costruzioni, compresi tubolari quadri e rettangolari.'),
    ('smp-srl.ro', 'Servizi di taglio laser di tubi metallici su commessa, con lavorazioni per carpenteria e applicazioni industriali.'),
    ('technicsteel.ro', 'Taglio laser su tubi tondi, quadri e rettangolari e lavorazione di profili metallici per commesse industriali.'),
    ('netvers.ro', 'Servizi di taglio laser e lavorazione di tubi metallici tondi, quadri e rettangolari su specifiche del cliente.'),
    ('habaresearch.eu', 'Taglio laser su tubi e profili metallici con fori, asole e tagli sagomati per assemblaggio industriale.')
  )
  SELECT count(*) INTO v_selected
  FROM curated k
  JOIN private.network_web_research_seeds s
    ON s.canonical_domain=k.canonical_domain AND s.country_code='RO'
  WHERE s.source_kind='first_party_web'
    AND s.review_lane='web_profile_review_pending'
    AND s.claim_status='unclaimed'
    AND s.verification_status='web_sourced_unverified'
    AND s.publication_status='not_published'
    AND s.source_url ~ '^https://'
    AND char_length(k.public_description) BETWEEN 40 AND 350
    AND s.proposed_role IN ('producer','trader_distributor','processor_service_provider');
  IF v_selected<>v_expected THEN
    RAISE EXCEPTION 'NET-RO1.4.D: % eligible sources, expected exactly %',v_selected,v_expected;
  END IF;

  WITH curated(canonical_domain, public_description) AS
  (VALUES
    ('iasi.metinvestholding.com', 'Produzione di tubi in acciaio saldati longitudinalmente e profili strutturali destinati a impieghi industriali e nelle costruzioni.'),
    ('tevi-romania.ro', 'Distribuzione di tubi in acciaio saldati longitudinalmente, a spirale e senza saldatura per applicazioni industriali.'),
    ('metalcas.ro', 'Fornitura di tubolari in acciaio quadri, rettangolari e tondi, insieme ad altri prodotti siderurgici per carpenteria.'),
    ('qcb.ro', 'Distribuzione di tubi in acciaio quadri, rettangolari, tondi saldati e zincati per costruzioni e lavorazioni.'),
    ('ditaindustrial.ro', 'Distribuzione di tubi e profili in acciaio inossidabile, anche in sezioni tonde, quadre e rettangolari.'),
    ('intacteco.ro', 'Fornitura commerciale di profili tubolari in acciaio quadri e rettangolari destinati a costruzioni e applicazioni industriali.'),
    ('alconind.ro', 'Commercio di tubi in acciaio saldati e senza saldatura, inclusi tubolari strutturali quadri e rettangolari.'),
    ('meta-cos.ro', 'Catalogo commerciale di tubolari in acciaio quadri e rettangolari per costruzioni e carpenteria metallica.'),
    ('sci-distribution.ro', 'Vendita di tubolari rettangolari in acciaio e di altri materiali per opere e lavorazioni metalliche.'),
    ('retacom.ro', 'Distribuzione di profili tubolari rettangolari in acciaio per strutture e opere di carpenteria.'),
    ('rematbv.ro', 'Commercio di prodotti siderurgici comprendenti tubi in acciaio saldati e tubi tondi senza saldatura.'),
    ('utchimsteel.ro', 'Distribuzione di prodotti siderurgici per edilizia e industria, tra cui tubi in acciaio e profili cavi.'),
    ('metaltrading.ro', 'Fornitura di tubazioni in acciaio e materiali per progetti di infrastrutture e applicazioni industriali.'),
    ('primetal.ro', 'Vendita di tubi in acciaio tondi, quadri e rettangolari per costruzioni e carpenteria metallica.'),
    ('profilometal.ro', 'Distribuzione di tubi rettangolari in acciaio e materiali metallici destinati a cantieri e carpenteria.'),
    ('deccons.ro', 'Catalogo commerciale di tubi e profili in acciaio per costruzioni, compresi tubolari quadri e rettangolari.'),
    ('smp-srl.ro', 'Servizi di taglio laser di tubi metallici su commessa, con lavorazioni per carpenteria e applicazioni industriali.'),
    ('technicsteel.ro', 'Taglio laser su tubi tondi, quadri e rettangolari e lavorazione di profili metallici per commesse industriali.'),
    ('netvers.ro', 'Servizi di taglio laser e lavorazione di tubi metallici tondi, quadri e rettangolari su specifiche del cliente.'),
    ('habaresearch.eu', 'Taglio laser su tubi e profili metallici con fori, asole e tagli sagomati per assemblaggio industriale.')
  )
  SELECT count(*) INTO v_suppressed
  FROM curated k
  JOIN public.network_netfast3_suppressed_domains d
    ON d.domain=k.canonical_domain;
  IF v_suppressed<>0 THEN
    RAISE EXCEPTION 'NET-RO1.4.D: source opt-out/suppressed domain hold (%)',v_suppressed;
  END IF;

  SELECT count(*) INTO v_previous FROM private.network_ro14c_publication_links
  WHERE publication_wave='NET-RO1.4.D-WEB20';
  WITH curated(canonical_domain, public_description) AS
  (VALUES
    ('iasi.metinvestholding.com', 'Produzione di tubi in acciaio saldati longitudinalmente e profili strutturali destinati a impieghi industriali e nelle costruzioni.'),
    ('tevi-romania.ro', 'Distribuzione di tubi in acciaio saldati longitudinalmente, a spirale e senza saldatura per applicazioni industriali.'),
    ('metalcas.ro', 'Fornitura di tubolari in acciaio quadri, rettangolari e tondi, insieme ad altri prodotti siderurgici per carpenteria.'),
    ('qcb.ro', 'Distribuzione di tubi in acciaio quadri, rettangolari, tondi saldati e zincati per costruzioni e lavorazioni.'),
    ('ditaindustrial.ro', 'Distribuzione di tubi e profili in acciaio inossidabile, anche in sezioni tonde, quadre e rettangolari.'),
    ('intacteco.ro', 'Fornitura commerciale di profili tubolari in acciaio quadri e rettangolari destinati a costruzioni e applicazioni industriali.'),
    ('alconind.ro', 'Commercio di tubi in acciaio saldati e senza saldatura, inclusi tubolari strutturali quadri e rettangolari.'),
    ('meta-cos.ro', 'Catalogo commerciale di tubolari in acciaio quadri e rettangolari per costruzioni e carpenteria metallica.'),
    ('sci-distribution.ro', 'Vendita di tubolari rettangolari in acciaio e di altri materiali per opere e lavorazioni metalliche.'),
    ('retacom.ro', 'Distribuzione di profili tubolari rettangolari in acciaio per strutture e opere di carpenteria.'),
    ('rematbv.ro', 'Commercio di prodotti siderurgici comprendenti tubi in acciaio saldati e tubi tondi senza saldatura.'),
    ('utchimsteel.ro', 'Distribuzione di prodotti siderurgici per edilizia e industria, tra cui tubi in acciaio e profili cavi.'),
    ('metaltrading.ro', 'Fornitura di tubazioni in acciaio e materiali per progetti di infrastrutture e applicazioni industriali.'),
    ('primetal.ro', 'Vendita di tubi in acciaio tondi, quadri e rettangolari per costruzioni e carpenteria metallica.'),
    ('profilometal.ro', 'Distribuzione di tubi rettangolari in acciaio e materiali metallici destinati a cantieri e carpenteria.'),
    ('deccons.ro', 'Catalogo commerciale di tubi e profili in acciaio per costruzioni, compresi tubolari quadri e rettangolari.'),
    ('smp-srl.ro', 'Servizi di taglio laser di tubi metallici su commessa, con lavorazioni per carpenteria e applicazioni industriali.'),
    ('technicsteel.ro', 'Taglio laser su tubi tondi, quadri e rettangolari e lavorazione di profili metallici per commesse industriali.'),
    ('netvers.ro', 'Servizi di taglio laser e lavorazione di tubi metallici tondi, quadri e rettangolari su specifiche del cliente.'),
    ('habaresearch.eu', 'Taglio laser su tubi e profili metallici con fori, asole e tagli sagomati per assemblaggio industriale.')
  )
  SELECT count(*) INTO v_existing
  FROM public.network_companies c
  JOIN curated k
    ON lower(c.website_domain)=k.canonical_domain
    OR (c.country_code='RO' AND
       pg_catalog.regexp_replace(lower(c.legal_name),'[^[:alnum:]]','','g') =
       pg_catalog.regexp_replace(lower((SELECT s.display_name
        FROM private.network_web_research_seeds s
        WHERE s.canonical_domain=k.canonical_domain AND s.country_code='RO')),'[^[:alnum:]]','','g'))
  WHERE c.publication_status<>'archived';

  IF v_previous=v_expected AND v_existing=v_expected THEN
    RETURN pg_catalog.jsonb_build_object('wave','NET-RO1.4.D-WEB20',
      'status','already_published','count',v_expected,'created_now',0);
  END IF;
  IF v_previous<>0 OR v_existing<>0 THEN
    RAISE EXCEPTION 'NET-RO1.4.D: duplicate/partial publication guard (ledger %, canonical %)',v_previous,v_existing;
  END IF;

  IF NOT coalesce(p_commit,false) THEN
    RETURN pg_catalog.jsonb_build_object(
      'wave','NET-RO1.4.D-WEB20','status','preview_only',
      'eligible',v_selected,'suppressed',v_suppressed,
      'duplicate_canonical',v_existing,'would_publish',v_expected,
      'requires_explicit_commit',true);
  END IF;

  SELECT id INTO v_family_id FROM public.network_product_families
    WHERE canonical_key='tubes_pipes' AND status='active';
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'NET-RO1.4.D: active tubes_pipes family missing';
  END IF;

  FOR v_seed IN
    WITH curated(canonical_domain, public_description) AS
  (VALUES
    ('iasi.metinvestholding.com', 'Produzione di tubi in acciaio saldati longitudinalmente e profili strutturali destinati a impieghi industriali e nelle costruzioni.'),
    ('tevi-romania.ro', 'Distribuzione di tubi in acciaio saldati longitudinalmente, a spirale e senza saldatura per applicazioni industriali.'),
    ('metalcas.ro', 'Fornitura di tubolari in acciaio quadri, rettangolari e tondi, insieme ad altri prodotti siderurgici per carpenteria.'),
    ('qcb.ro', 'Distribuzione di tubi in acciaio quadri, rettangolari, tondi saldati e zincati per costruzioni e lavorazioni.'),
    ('ditaindustrial.ro', 'Distribuzione di tubi e profili in acciaio inossidabile, anche in sezioni tonde, quadre e rettangolari.'),
    ('intacteco.ro', 'Fornitura commerciale di profili tubolari in acciaio quadri e rettangolari destinati a costruzioni e applicazioni industriali.'),
    ('alconind.ro', 'Commercio di tubi in acciaio saldati e senza saldatura, inclusi tubolari strutturali quadri e rettangolari.'),
    ('meta-cos.ro', 'Catalogo commerciale di tubolari in acciaio quadri e rettangolari per costruzioni e carpenteria metallica.'),
    ('sci-distribution.ro', 'Vendita di tubolari rettangolari in acciaio e di altri materiali per opere e lavorazioni metalliche.'),
    ('retacom.ro', 'Distribuzione di profili tubolari rettangolari in acciaio per strutture e opere di carpenteria.'),
    ('rematbv.ro', 'Commercio di prodotti siderurgici comprendenti tubi in acciaio saldati e tubi tondi senza saldatura.'),
    ('utchimsteel.ro', 'Distribuzione di prodotti siderurgici per edilizia e industria, tra cui tubi in acciaio e profili cavi.'),
    ('metaltrading.ro', 'Fornitura di tubazioni in acciaio e materiali per progetti di infrastrutture e applicazioni industriali.'),
    ('primetal.ro', 'Vendita di tubi in acciaio tondi, quadri e rettangolari per costruzioni e carpenteria metallica.'),
    ('profilometal.ro', 'Distribuzione di tubi rettangolari in acciaio e materiali metallici destinati a cantieri e carpenteria.'),
    ('deccons.ro', 'Catalogo commerciale di tubi e profili in acciaio per costruzioni, compresi tubolari quadri e rettangolari.'),
    ('smp-srl.ro', 'Servizi di taglio laser di tubi metallici su commessa, con lavorazioni per carpenteria e applicazioni industriali.'),
    ('technicsteel.ro', 'Taglio laser su tubi tondi, quadri e rettangolari e lavorazione di profili metallici per commesse industriali.'),
    ('netvers.ro', 'Servizi di taglio laser e lavorazione di tubi metallici tondi, quadri e rettangolari su specifiche del cliente.'),
    ('habaresearch.eu', 'Taglio laser su tubi e profili metallici con fori, asole e tagli sagomati per assemblaggio industriale.')
  )
    SELECT s.*,k.public_description
    FROM curated k JOIN private.network_web_research_seeds s
      ON s.canonical_domain=k.canonical_domain AND s.country_code='RO'
    ORDER BY s.research_id
  LOOP
    SELECT id INTO v_role_id FROM public.network_company_roles
      WHERE canonical_key=v_seed.proposed_role AND status='active';
    IF v_role_id IS NULL THEN
      RAISE EXCEPTION 'NET-RO1.4.D: role key unavailable: %',v_seed.proposed_role;
    END IF;
    v_relationship:=CASE v_seed.proposed_role
      WHEN 'producer' THEN 'produces'
      WHEN 'trader_distributor' THEN 'distributes'
      ELSE 'processes' END;

    INSERT INTO public.network_companies(
      legal_name,country_code,website_url,website_domain,description,
      publication_status,claimed_status,verification_status
    ) VALUES (
      v_seed.display_name,'RO','https://'||v_seed.canonical_domain,
      v_seed.canonical_domain,v_seed.public_description,
      'published','unclaimed','unverified'
    ) RETURNING id INTO v_company_id;

    INSERT INTO public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,
      source_reference,ownership_type,asserted_by,confidence,review_state
    ) VALUES (
      'company',v_company_id,'netro14c_public_web_profile',
      pg_catalog.jsonb_build_object(
        'research_id',v_seed.research_id,'source_kind','first_party_web',
        'source_url',v_seed.source_url,'published_name',v_seed.display_name,
        'public_activity',v_seed.public_description,
        'role_key',v_seed.proposed_role,'claimed_status','unclaimed',
        'verification_status','unverified','independent_company_verified',false,
        'web_source_evidence_only',true
      ),'public_web',v_seed.source_url,'platform_curated',NULL,0.65,'accepted'
    ) RETURNING id INTO v_assertion_id;

    INSERT INTO public.network_company_role_assignments(
      company_id,role_id,is_primary,source_assertion_id
    ) VALUES (v_company_id,v_role_id,true,v_assertion_id);

    INSERT INTO public.network_company_products(
      company_id,product_family_id,relationship_type,source_assertion_id
    ) VALUES (v_company_id,v_family_id,v_relationship,v_assertion_id);

    INSERT INTO private.network_ro14c_publication_links(
      research_id,seed_id,company_id,published_source_url,publication_wave
    ) VALUES (v_seed.research_id,v_seed.id,v_company_id,v_seed.source_url,'NET-RO1.4.D-WEB20');

    v_published:=v_published+1;
  END LOOP;

  IF v_published<>v_expected THEN
    RAISE EXCEPTION 'NET-RO1.4.D: atomic pilot count mismatch %',v_published;
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'wave','NET-RO1.4.D-WEB20','status','published',
    'published_count',v_published,'claimed',0,'verified',0);
END;
$fn$;

REVOKE ALL ON FUNCTION private.network_ro14d_publish_wave20(boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.network_ro14d_publish_wave20(boolean)
  TO service_role;
