-- NET-RO1.GROWTH9.E: definition-only, 14-source fabricator publisher.
-- Country-region sourced from company sites; no contact, ownership, tube-grade
-- or EN 10219 capability is asserted. Contact publication requires NET-CONTACT1
-- privacy governance and is NOT performed by this migration.
CREATE OR REPLACE FUNCTION private.netro_growth9e_publish_fab14(p_commit boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 v_manifest constant jsonb := '[{"domain":"metalisteel.com","role":"processor_service_provider","research_id":"NET-RO1-G9E-001","province":"Bihor","city":"Păușa","nuts":"RO11","source_url":"https://metalisteel.com/"},{"domain":"mekonf.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-002","province":"Iași","city":"Iași","nuts":"RO21","source_url":"https://mekonf.ro/"},{"domain":"edmario.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-003","province":"Iași","city":"Iași","nuts":"RO21","source_url":"https://edmario.ro/"},{"domain":"edilmet.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-004","province":"Brașov","city":"Râșnov","nuts":"RO12","source_url":"https://edilmet.ro/"},{"domain":"asdrconstructii.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-005","province":"Dolj","city":"Craiova","nuts":"RO41","source_url":"https://www.asdrconstructii.ro/service/confectionare-structuri-metalice/"},{"domain":"cona.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-006","province":"Sibiu","city":"Mârșa","nuts":"RO12","source_url":"https://cona.ro/"},{"domain":"profilegalvanizate.ro","role":"producer","research_id":"NET-RO1-G9E-007","province":"Arad","city":"Arad","nuts":"RO42","source_url":"https://profilegalvanizate.ro/"},{"domain":"proelcons.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-008","province":"Mureș","city":"Târgu Mureș","nuts":"RO12","source_url":"https://www.proelcons.ro/"},{"domain":"primexmures.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-009","province":"Mureș","city":"Târgu Mureș","nuts":"RO12","source_url":"https://www.primexmures.ro/ro"},{"domain":"sudometal.com","role":"processor_service_provider","research_id":"NET-RO1-G9E-010","province":"Bacău","city":"Bacău","nuts":"RO21","source_url":"https://www.sudometal.com/despre-noi/"},{"domain":"srd-severin.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-011","province":"Mehedinți","city":"Drobeta-Turnu Severin","nuts":"RO41","source_url":"https://srd-severin.ro/"},{"domain":"misan.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-012","province":"Bacău","city":"Onești","nuts":"RO21","source_url":"https://www.misan.ro/servicii"},{"domain":"imgp-sb.ro","role":"processor_service_provider","research_id":"NET-RO1-G9E-013","province":"Mureș","city":"Livezeni","nuts":"RO12","source_url":"https://www.imgp-sb.ro/"},{"domain":"profin.ro","role":"producer","research_id":"NET-RO1-G9E-014","province":"Cluj","city":"Cluj-Napoca","nuts":"RO11","source_url":"https://www.profin.ro/"}]'::jsonb;
 v_wave constant text := 'NET-RO1.GROWTH9.E-FAB14';
 v_expected constant integer := 14;
 v_existing integer;
 v_research integer;
 v_prev integer;
 v_eligible integer;
 v_published integer:=0;
 v_company_id uuid;
 v_role_id uuid;
 v_assertion_id uuid;
 r record;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_wave));
 IF coalesce(p_commit,false) THEN
   LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
   LOCK TABLE private.network_web_research_seeds IN SHARE ROW EXCLUSIVE MODE;
 END IF;
 IF (SELECT count(*) FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(domain text))<>v_expected
 OR (SELECT count(DISTINCT m.domain) FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(domain text))<>v_expected
 OR (SELECT count(DISTINCT m.research_id) FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(research_id text))<>v_expected
 THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.E: manifest identity collision'; END IF;
 SELECT count(*) INTO v_prev FROM private.network_ro14c_publication_links l WHERE l.publication_wave=v_wave;
 IF v_prev=v_expected AND (
  SELECT count(*) FROM private.network_ro14c_publication_links l
  JOIN public.network_companies c ON c.id=l.company_id
  JOIN pg_catalog.jsonb_to_recordset(v_manifest) AS m(
    domain text,role text,research_id text,province text,city text,nuts text,source_url text)
    ON m.domain=c.website_domain AND m.research_id=l.research_id
  JOIN private.network_web_research_seeds s ON s.id=l.seed_id AND s.canonical_domain=m.domain
    AND s.research_id=m.research_id AND s.proposed_role=m.role AND s.source_url=m.source_url
  WHERE l.publication_wave=v_wave AND c.country_code='RO' AND c.publication_status='published'
    AND c.archived_at IS NULL AND c.claimed_status='unclaimed' AND c.verification_status='unverified'
 )=v_expected THEN
   RETURN pg_catalog.jsonb_build_object('wave',v_wave,'status','already_published','created_now',0,'count',v_expected);
 END IF;
 IF v_prev<>0 THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.E: partial wave %',v_prev; END IF;
 SELECT count(*) INTO v_existing FROM public.network_companies
 WHERE country_code='RO' AND publication_status='published' AND archived_at IS NULL;
 IF v_existing<>220 THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.E: public baseline % != 220',v_existing; END IF;
 SELECT count(*) INTO v_research FROM private.network_web_research_seeds WHERE country_code='RO';
 IF v_research<>327 THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.E: research baseline % != 327',v_research; END IF;
 SELECT count(*) INTO v_eligible
 FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
  domain text,role text,research_id text,province text,city text,nuts text,source_url text)
 JOIN private.network_web_research_seeds s
  ON s.country_code='RO' AND s.canonical_domain=m.domain AND s.proposed_role=m.role
     AND s.research_id=m.research_id AND s.source_url=m.source_url
 JOIN public.network_company_roles roles ON roles.canonical_key=m.role AND roles.status='active'
 JOIN public.network_eu_nuts2024_regions geo
   ON geo.code=m.nuts AND geo.country_code='RO' AND geo.nuts_level=2
 WHERE s.batch_key='NET-RO1-G9E-FAB9' AND s.source_kind='first_party_web'
   AND s.review_lane='web_profile_review_pending'
   AND s.publication_status='not_published' AND s.claim_status='unclaimed'
   AND s.verification_status='web_sourced_unverified'
   AND s.source_url LIKE 'https://%' AND length(trim(s.source_summary))>=30
   AND length(trim(s.display_name)) BETWEEN 3 AND 255
   AND m.province<>'' AND m.city<>''
   AND NOT EXISTS(SELECT 1 FROM public.network_companies c
     WHERE lower(c.website_domain)=m.domain OR
     (c.country_code='RO' AND
      pg_catalog.regexp_replace(lower(c.legal_name),'[^[:alnum:]]','','g')=
      pg_catalog.regexp_replace(lower(s.display_name),'[^[:alnum:]]','','g')))
   AND NOT EXISTS(SELECT 1 FROM private.network_web_research_seeds other
      WHERE other.country_code='RO' AND other.id<>s.id AND
        pg_catalog.regexp_replace(lower(other.display_name),'[^[:alnum:]]','','g')=
        pg_catalog.regexp_replace(lower(s.display_name),'[^[:alnum:]]','','g'))
   AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains opt
     WHERE opt.domain=m.domain)
   AND NOT EXISTS(SELECT 1 FROM private.network_ro14c_publication_links l
     WHERE l.seed_id=s.id OR l.research_id=s.research_id);
 IF v_eligible<>v_expected THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.E: only %/14 eligible',v_eligible; END IF;
 IF NOT coalesce(p_commit,false) THEN
   RETURN pg_catalog.jsonb_build_object('wave',v_wave,'status','preview_only',
    'eligible',14,'created_now',0,'would_publish',14,'suppressed',0,
    'already_public_ro_expected',220,'expected_total_public_ro',234,
    'requires_explicit_commit',true);
 END IF;
 FOR r IN
  SELECT s.*,m.province,m.city,m.nuts FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
     domain text,role text,research_id text,province text,city text,nuts text,source_url text)
  JOIN private.network_web_research_seeds s ON s.country_code='RO' AND s.canonical_domain=m.domain
    AND s.proposed_role=m.role AND s.research_id=m.research_id
  ORDER BY s.research_id
 LOOP
  SELECT id INTO STRICT v_role_id FROM public.network_company_roles
  WHERE canonical_key=r.proposed_role AND status='active';
  INSERT INTO public.network_companies(legal_name,country_code,website_url,website_domain,description,
    publication_status,claimed_status,verification_status)
  VALUES(r.display_name,'RO','https://'||r.canonical_domain,r.canonical_domain,
    CASE r.proposed_role
    WHEN 'producer' THEN 'Produttore di componenti per costruzioni metalliche identificato da fonte aziendale. Non è attestata produzione di tubi EN 10219.'
    WHEN 'end_user' THEN 'Costruttore di macchine, container o prodotti industriali individuato da fonte aziendale. Consumi e acquisti di tubolari da confermare.'
    ELSE 'Carpenteria industriale e lavorazioni metalliche individuate da fonte web aziendale. Servizi e qualifiche da confermare.' END,
    'published','unclaimed','unverified')
  RETURNING id INTO v_company_id;

  INSERT INTO public.network_data_assertions(
   entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
   ownership_type,asserted_by,confidence,review_state)
  VALUES('company',v_company_id,'netro_growth9e_fabricator_web',
    pg_catalog.jsonb_build_object(
    'research_id',r.research_id,'role_key_proposed',r.proposed_role,
    'source_url',r.source_url,'province',r.province,'city',r.city,'nuts',r.nuts,
    'role_confirmed_by_company',false,'tube_purchases_verified',false,
    'certified',false,'owner_verified',false),
    'public_web',r.source_url,'platform_curated',NULL,0.50,'accepted')
  RETURNING id INTO v_assertion_id;

  INSERT INTO public.network_company_role_assignments(company_id,role_id,is_primary,source_assertion_id)
  VALUES(v_company_id,v_role_id,true,v_assertion_id);
  INSERT INTO public.network_facilities(company_id,name,facility_type,city,region,country_code,
    website_url,publication_status,verification_status,eu_nuts2024_code)
  VALUES(v_company_id,'Sede o stabilimento (fonte aziendale)','industrial_site',r.city,r.province,'RO',
    r.source_url,'published','unverified',r.nuts);
  INSERT INTO private.network_ro14c_publication_links(research_id,seed_id,company_id,published_source_url,publication_wave)
  VALUES(r.research_id,r.id,v_company_id,r.source_url,v_wave);
  v_published:=v_published+1;
 END LOOP;
 IF v_published<>v_expected THEN RAISE EXCEPTION 'NET-RO1.GROWTH9.E: atomic published % != 14',v_published; END IF;
 RETURN pg_catalog.jsonb_build_object('wave',v_wave,'status','published',
  'published_count',v_published,'expected_total_public_ro',234,'claimed',0,'verified',0);
END;
$fn$;
REVOKE ALL ON FUNCTION private.netro_growth9e_publish_fab14(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.netro_growth9e_publish_fab14(boolean) TO service_role;
