-- NET-RO1.4.C — publish a SMALL, source-backed pilot of Romanian company profiles.
-- Only factual business name, domain, role, and an independently paraphrased
-- industrial activity summary. NO owner verification or claimed certificates.
-- Defer government registry lookups and paid visure for web-based discovery.
-- This migration defines a private service-only, PREVIEW-FIRST publishing
-- function. It DOES NOT automatically publish any Network companies.
CREATE TABLE IF NOT EXISTS private.network_ro14c_publication_links (
  research_id text PRIMARY KEY,
  seed_id uuid NOT NULL UNIQUE REFERENCES private.network_web_research_seeds(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL UNIQUE REFERENCES public.network_companies(id) ON DELETE RESTRICT,
  published_source_url text NOT NULL,
  publication_wave text NOT NULL DEFAULT 'NET-RO1.4.C-PILOT9',
  published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.network_ro14c_publication_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.network_ro14c_publication_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON private.network_ro14c_publication_links TO service_role;

CREATE OR REPLACE FUNCTION private.network_ro14c_publish_pilot(
  p_commit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_expected constant integer := 9;
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
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('NET-RO1.4.C-PILOT9'));
  IF p_commit THEN
    LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  WITH curated(canonical_domain, public_description) AS
  (VALUES
    ('artrom.com', 'Tubi in acciaio senza saldatura destinati ad applicazioni meccaniche, energetiche e industriali.'),
    ('steel-tubes.ro', 'Distribuzione di tubi in acciaio al carbonio e bassolegato, anche senza saldatura.'),
    ('baurom.ro', 'Catalogo di tubi saldati longitudinalmente per costruzioni, in sezioni tonde, quadre e rettangolari.'),
    ('laser-rmc.ro', 'Servizi di taglio laser di tubi e profili metallici, compresi quelli quadri e rettangolari.'),
    ('zsofia.ro', 'Servizi industriali di taglio laser tridimensionale per profili, tubi e componenti metallici.'),
    ('metaldistribution.ro', 'Distribuzione di tubi in acciaio saldati elicoidali, longitudinali e senza saldatura.'),
    ('baduc.ro', 'Catalogo di tubi e profili in acciaio per edilizia, inclusi profili cavi quadri e rettangolari.'),
    ('conbuz.ro', 'Catalogo di profili tubolari rettangolari in acciaio destinati alle costruzioni.'),
    ('plasmarapid.ro', 'Taglio su commessa di tubi e profili metallici mediante laser, sega a nastro e plasma.')
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
    RAISE EXCEPTION 'NET-RO1.4.C: % eligible sources, expected exactly %',v_selected,v_expected;
  END IF;

  WITH curated(canonical_domain, public_description) AS
  (VALUES
    ('artrom.com', 'Tubi in acciaio senza saldatura destinati ad applicazioni meccaniche, energetiche e industriali.'),
    ('steel-tubes.ro', 'Distribuzione di tubi in acciaio al carbonio e bassolegato, anche senza saldatura.'),
    ('baurom.ro', 'Catalogo di tubi saldati longitudinalmente per costruzioni, in sezioni tonde, quadre e rettangolari.'),
    ('laser-rmc.ro', 'Servizi di taglio laser di tubi e profili metallici, compresi quelli quadri e rettangolari.'),
    ('zsofia.ro', 'Servizi industriali di taglio laser tridimensionale per profili, tubi e componenti metallici.'),
    ('metaldistribution.ro', 'Distribuzione di tubi in acciaio saldati elicoidali, longitudinali e senza saldatura.'),
    ('baduc.ro', 'Catalogo di tubi e profili in acciaio per edilizia, inclusi profili cavi quadri e rettangolari.'),
    ('conbuz.ro', 'Catalogo di profili tubolari rettangolari in acciaio destinati alle costruzioni.'),
    ('plasmarapid.ro', 'Taglio su commessa di tubi e profili metallici mediante laser, sega a nastro e plasma.')
  )
  SELECT count(*) INTO v_suppressed
  FROM curated k
  JOIN public.network_netfast3_suppressed_domains d
    ON d.domain=k.canonical_domain;
  IF v_suppressed<>0 THEN
    RAISE EXCEPTION 'NET-RO1.4.C: source opt-out/suppressed domain hold (%)',v_suppressed;
  END IF;

  SELECT count(*) INTO v_previous FROM private.network_ro14c_publication_links
  WHERE publication_wave='NET-RO1.4.C-PILOT9';
  WITH curated(canonical_domain, public_description) AS
  (VALUES
    ('artrom.com', 'Tubi in acciaio senza saldatura destinati ad applicazioni meccaniche, energetiche e industriali.'),
    ('steel-tubes.ro', 'Distribuzione di tubi in acciaio al carbonio e bassolegato, anche senza saldatura.'),
    ('baurom.ro', 'Catalogo di tubi saldati longitudinalmente per costruzioni, in sezioni tonde, quadre e rettangolari.'),
    ('laser-rmc.ro', 'Servizi di taglio laser di tubi e profili metallici, compresi quelli quadri e rettangolari.'),
    ('zsofia.ro', 'Servizi industriali di taglio laser tridimensionale per profili, tubi e componenti metallici.'),
    ('metaldistribution.ro', 'Distribuzione di tubi in acciaio saldati elicoidali, longitudinali e senza saldatura.'),
    ('baduc.ro', 'Catalogo di tubi e profili in acciaio per edilizia, inclusi profili cavi quadri e rettangolari.'),
    ('conbuz.ro', 'Catalogo di profili tubolari rettangolari in acciaio destinati alle costruzioni.'),
    ('plasmarapid.ro', 'Taglio su commessa di tubi e profili metallici mediante laser, sega a nastro e plasma.')
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
    RETURN pg_catalog.jsonb_build_object('wave','NET-RO1.4.C-PILOT9',
      'status','already_published','count',v_expected,'created_now',0);
  END IF;
  IF v_previous<>0 OR v_existing<>0 THEN
    RAISE EXCEPTION 'NET-RO1.4.C: duplicate/partial publication guard (ledger %, canonical %)',v_previous,v_existing;
  END IF;

  IF NOT coalesce(p_commit,false) THEN
    RETURN pg_catalog.jsonb_build_object(
      'wave','NET-RO1.4.C-PILOT9','status','preview_only',
      'eligible',v_selected,'suppressed',v_suppressed,
      'duplicate_canonical',v_existing,'would_publish',v_expected,
      'requires_explicit_commit',true);
  END IF;

  SELECT id INTO v_family_id FROM public.network_product_families
    WHERE canonical_key='tubes_pipes' AND status='active';
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'NET-RO1.4.C: active tubes_pipes family missing';
  END IF;

  FOR v_seed IN
    WITH curated(canonical_domain, public_description) AS
    (VALUES
    ('artrom.com', 'Tubi in acciaio senza saldatura destinati ad applicazioni meccaniche, energetiche e industriali.'),
    ('steel-tubes.ro', 'Distribuzione di tubi in acciaio al carbonio e bassolegato, anche senza saldatura.'),
    ('baurom.ro', 'Catalogo di tubi saldati longitudinalmente per costruzioni, in sezioni tonde, quadre e rettangolari.'),
    ('laser-rmc.ro', 'Servizi di taglio laser di tubi e profili metallici, compresi quelli quadri e rettangolari.'),
    ('zsofia.ro', 'Servizi industriali di taglio laser tridimensionale per profili, tubi e componenti metallici.'),
    ('metaldistribution.ro', 'Distribuzione di tubi in acciaio saldati elicoidali, longitudinali e senza saldatura.'),
    ('baduc.ro', 'Catalogo di tubi e profili in acciaio per edilizia, inclusi profili cavi quadri e rettangolari.'),
    ('conbuz.ro', 'Catalogo di profili tubolari rettangolari in acciaio destinati alle costruzioni.'),
    ('plasmarapid.ro', 'Taglio su commessa di tubi e profili metallici mediante laser, sega a nastro e plasma.')
  )
    SELECT s.*,k.public_description
    FROM curated k JOIN private.network_web_research_seeds s
      ON s.canonical_domain=k.canonical_domain AND s.country_code='RO'
    ORDER BY s.research_id
  LOOP
    SELECT id INTO v_role_id FROM public.network_company_roles
      WHERE canonical_key=v_seed.proposed_role AND status='active';
    IF v_role_id IS NULL THEN
      RAISE EXCEPTION 'NET-RO1.4.C: role key unavailable: %',v_seed.proposed_role;
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
      research_id,seed_id,company_id,published_source_url
    ) VALUES (v_seed.research_id,v_seed.id,v_company_id,v_seed.source_url);

    v_published:=v_published+1;
  END LOOP;

  IF v_published<>v_expected THEN
    RAISE EXCEPTION 'NET-RO1.4.C: atomic pilot count mismatch %',v_published;
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'wave','NET-RO1.4.C-PILOT9','status','published',
    'published_count',v_published,'claimed',0,'verified',0);
END;
$fn$;

REVOKE ALL ON FUNCTION private.network_ro14c_publish_pilot(boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.network_ro14c_publish_pilot(boolean)
  TO service_role;
