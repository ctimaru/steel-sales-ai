-- NET-RO1.GROWTH8.B — source-backed clearance of ONE held tube manufacturer.
-- The Mairon Group's own catalogue explicitly names MAIRON TUBES separately
-- and identifies the Gaesti tube mill producing round/square/rectangular welded
-- steel hollow sections. This is corporate-source clearance, NOT owner claim,
-- certified product verification, or an automatic public profile.
-- Reference: https://www.mairon.ro/wp-content/uploads/2024/09/CatalogMaironeng2024.pdf
DO $mairon_clear$
DECLARE v_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('NET-RO1.GROWTH8-MAIRON-CLEARANCE')
  );
  IF EXISTS(
    SELECT 1 FROM public.network_companies c
    WHERE lower(c.website_domain)='mairon-tubes.ro'
       OR (c.country_code='RO' AND
           pg_catalog.regexp_replace(lower(c.legal_name),'[^[:alnum:]]','','g')
           ='mairontubessrl')
  ) THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH8: Mairon identity already public; no clearance';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.network_netfast3_suppressed_domains
    WHERE domain='mairon-tubes.ro'
  ) THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH8: Mairon domain suppressed; no clearance';
  END IF;

  UPDATE private.network_web_research_seeds
  SET review_lane='web_profile_review_pending',
      source_url='https://www.mairon.ro/wp-content/uploads/2024/09/CatalogMaironeng2024.pdf',
      source_summary='Catalogo ufficiale MAIRON: MAIRON TUBES è una società produttiva distinta del gruppo, con stabilimento a Găești e linee per tubi di acciaio saldati longitudinalmente tondi, quadri e rettangolari. Dati non verificati dal proprietario; non presumere certificazioni o disponibilità.',
      updated_at=now()
  WHERE country_code='RO'
    AND canonical_domain='mairon-tubes.ro'
    AND display_name='MAIRON TUBES S.R.L.'
    AND proposed_role='producer'
    AND source_kind='first_party_web'
    AND review_lane='group_facility_review'
    AND publication_status='not_published'
    AND claim_status='unclaimed'
    AND verification_status='web_sourced_unverified'
    AND research_id='NET-RO1-026';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH8: source clearance expected 1 Mairon candidate, got %',v_count;
  END IF;
END;
$mairon_clear$;
