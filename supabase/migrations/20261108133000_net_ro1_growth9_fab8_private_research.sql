-- NET-RO1.GROWTH9.A / eight first-party metal-fabrication source records.
-- PRIVATE RESEARCH ONLY: a separate guarded publisher creates public profiles.
DO $growth9_stage$
DECLARE
  v_manifest constant jsonb := '[{"country_code":"RO","canonical_domain":"terasteel.ro","display_name":"TERASTEEL S.A.","proposed_role":"producer","source_url":"https://terasteel.ro/termeni-si-condiii","source_summary":"Azienda CAEN 2511, produttore di pannelli termoisolanti e profili zincati, con sede e produzione rumena nel distretto Bistrița-Năsăud. Non attribuire automaticamente produzione o consumo di tubi strutturali.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G9-001","batch_key":"NET-RO1-G9-FAB8","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published","region":"Nord-Vest","province":"Bistrița-Năsăud","city":"Sărațel","nuts":"RO11"},{"country_code":"RO","canonical_domain":"gormet.eu","display_name":"GORMET SRL","proposed_role":"processor_service_provider","source_url":"https://gormet.eu/wp/ro/a-lua-legatura/","source_summary":"Carpenteria industriale a Cluj-Napoca con saldatura, taglio, lavorazioni meccaniche CNC e fabbricazione di componenti metallici complessi; impiego di tubi strutturali non attestato.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G9-002","batch_key":"NET-RO1-G9-FAB8","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published","region":"Nord-Vest","province":"Cluj","city":"Cluj-Napoca","nuts":"RO11"},{"country_code":"RO","canonical_domain":"assasteel.ro","display_name":"ASSA STEEL STRUCTURES SRL","proposed_role":"processor_service_provider","source_url":"https://assasteel.ro/contact/","source_summary":"Produzione di strutture e componenti d''acciaio con attività di lavorazione e saldatura a Luna de Sus, provincia di Cluj. La lavorazione di tubi EN 10219 non è verificata.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G9-003","batch_key":"NET-RO1-G9-FAB8","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published","region":"Nord-Vest","province":"Cluj","city":"Luna de Sus","nuts":"RO11"},{"country_code":"RO","canonical_domain":"norstal.ro","display_name":"NORSTAL STEEL STRUCTURES SRL","proposed_role":"processor_service_provider","source_url":"https://norstal.ro/contact-us/","source_summary":"Produttore e terzista di strutture in acciaio con stabilimento ad Apahida, Cluj e produzione di carpenterie metalliche per progetti scandinavi. Acquisti specifici di tubi non confermati.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G9-004","batch_key":"NET-RO1-G9-FAB8","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published","region":"Nord-Vest","province":"Cluj","city":"Apahida","nuts":"RO11"},{"country_code":"RO","canonical_domain":"comef.ro","display_name":"CO.ME.F. UTILAJE INDUSTRIALE","proposed_role":"end_user","source_url":"https://www.comef.ro/","source_summary":"Produttore industriale rumeno di impianti per selezione e frantumazione di aggregati, nastri trasportatori e strutture saldate nello stabilimento di Buhuși. Uso di tubi da confermare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G9-005","batch_key":"NET-RO1-G9-FAB8","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published","region":"Nord-Est","province":"Bacău","city":"Buhuși","nuts":"RO21"},{"country_code":"RO","canonical_domain":"setrometalgroup.com","display_name":"SETRO METAL GROUP SA","proposed_role":"processor_service_provider","source_url":"https://setrometalgroup.com/","source_summary":"Carpenteria industriale strutturale con taglio CNC, piegatura, foratura e saldatura di strutture, supporti e componenti a Câmpulung. Gamma di tubolari lavorati da confermare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G9-006","batch_key":"NET-RO1-G9-FAB8","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published","region":"Sud-Muntenia","province":"Argeș","city":"Câmpulung","nuts":"RO31"},{"country_code":"RO","canonical_domain":"containere-fdc.ro","display_name":"CONTAINERE FDC SRL","proposed_role":"end_user","source_url":"https://www.containere-fdc.ro/contact/","source_summary":"Azienda rumena specializzata nella fabbricazione di container e strutture modulari con stabilimento produttivo a Bacău. Il consumo di tubi strutturali EN 10219 non è stato verificato.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G9-007","batch_key":"NET-RO1-G9-FAB8","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published","region":"Nord-Est","province":"Bacău","city":"Bacău","nuts":"RO21"},{"country_code":"RO","canonical_domain":"topanel.ro","display_name":"TOPANEL PRODUCTION PANELS SA","proposed_role":"producer","source_url":"https://www.topanel.ro/contact/","source_summary":"Produttore rumeno di pannelli termoisolanti e profili zincati, con sede produttiva a Râmnicu Vâlcea. Identificato nel ranking CAEN 2511; non è classificato come produttore di tubi.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G9-008","batch_key":"NET-RO1-G9-FAB8","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published","region":"Sud-Vest Oltenia","province":"Vâlcea","city":"Râmnicu Vâlcea","nuts":"RO41"}]'::jsonb;
  v_count integer;
  v_inserted integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('NET-RO1.GROWTH9-FAB8'));
  LOCK TABLE private.network_web_research_seeds IN SHARE ROW EXCLUSIVE MODE;
  SELECT count(*) INTO v_count
  FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
    country_code text,canonical_domain text,display_name text,proposed_role text,
    source_url text,source_summary text,source_kind text,review_lane text,
    research_id text,batch_key text,claim_status text,verification_status text,
    publication_status text,region text,province text,city text,nuts text
  )
  JOIN public.network_company_roles r ON r.canonical_key=m.proposed_role AND r.status='active'
  JOIN public.network_eu_nuts2024_regions geo ON geo.code=m.nuts AND geo.country_code='RO' AND geo.nuts_level=2
  WHERE m.country_code='RO' AND m.batch_key='NET-RO1-G9-FAB8'
    AND m.source_kind='first_party_web'
    AND m.review_lane='web_profile_review_pending'
    AND m.claim_status='unclaimed'
    AND m.verification_status='web_sourced_unverified'
    AND m.publication_status='not_published'
    AND m.canonical_domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    AND m.source_url LIKE 'https://%'
    AND pg_catalog.regexp_replace(lower(split_part(split_part(m.source_url,'/',3),':',1)),'^www[.]','')
         =m.canonical_domain
    AND length(trim(m.display_name)) BETWEEN 3 AND 255
    AND length(trim(m.source_summary)) BETWEEN 30 AND 950
    AND m.region<>'' AND m.province<>'' AND m.city<>''
    AND NOT EXISTS (SELECT 1 FROM private.network_web_research_seeds s
      WHERE s.country_code='RO' AND (s.canonical_domain=m.canonical_domain OR s.research_id=m.research_id
        OR pg_catalog.regexp_replace(lower(s.display_name),'[^[:alnum:]]','','g')=
           pg_catalog.regexp_replace(lower(m.display_name),'[^[:alnum:]]','','g')))
    AND NOT EXISTS (SELECT 1 FROM public.network_companies c WHERE lower(c.website_domain)=m.canonical_domain
        OR (c.country_code='RO' AND pg_catalog.regexp_replace(lower(c.legal_name),'[^[:alnum:]]','','g')=
           pg_catalog.regexp_replace(lower(m.display_name),'[^[:alnum:]]','','g')))
    AND NOT EXISTS (SELECT 1 FROM public.network_netfast3_suppressed_domains d WHERE d.domain=m.canonical_domain);
  IF v_count<>8 OR
     (SELECT count(DISTINCT x.canonical_domain) FROM pg_catalog.jsonb_to_recordset(v_manifest) AS x(canonical_domain text))<>8 OR
     (SELECT count(DISTINCT x.research_id) FROM pg_catalog.jsonb_to_recordset(v_manifest) AS x(research_id text))<>8
  THEN RAISE EXCEPTION 'NET-RO1.GROWTH9: research cohort must be 8 unique, found %',v_count; END IF;
  INSERT INTO private.network_web_research_seeds(
    country_code,canonical_domain,display_name,proposed_role,source_url,source_summary,
    source_kind,review_lane,research_id,batch_key)
  SELECT m.country_code,m.canonical_domain,m.display_name,m.proposed_role,m.source_url,m.source_summary,
    m.source_kind,m.review_lane,m.research_id,m.batch_key
  FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
    country_code text,canonical_domain text,display_name text,proposed_role text,source_url text,
    source_summary text,source_kind text,review_lane text,research_id text,batch_key text);
  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  IF v_inserted<>8 THEN RAISE EXCEPTION 'NET-RO1.GROWTH9: atomic stage mismatch %',v_inserted; END IF;
END;
$growth9_stage$;
