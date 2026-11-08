-- NET-RO1.GROWTH8.A — first-party new industrial research, no public promotion.
-- Add 25 Romanian industrial prospects under private source research only.
-- Direct company sources, unclaimed and unverified; some group/brand/product
-- cases intentionally retain specific HOLD lanes, never auto-published.
DO $growth8$
DECLARE
  v_manifest constant jsonb := '[{"country_code":"RO","canonical_domain":"agrojet-sa.ro","display_name":"AGROJET SA","proposed_role":"end_user","source_url":"https://agrojet-sa.ro/?lang=en","source_summary":"Fabbricazione e lavorazione di macchine agricole, strutture di chassis, piattaforme e attrezzature di trasporto. Uso specifico di tubi EN 10219 e acquisti da verificare con l''azienda.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-001","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"chiulan.ro","display_name":"CHIULAN SRL","proposed_role":"processor_service_provider","source_url":"https://chiulan.ro/en/about-us/","source_summary":"Produzione di carpenterie e strutture in acciaio saldato per progetti industriali. Tipi e quantità di tubi lavorati non confermati dal proprietario.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-002","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"ereste-star.ro","display_name":"Ereste Star","proposed_role":"end_user","source_url":"https://ereste-star.ro/about.html","source_summary":"Fabbricazione di telai e chassis per rimorchi e allestimenti di veicoli industriali in Romania. Specifiche dei profili utilizzati e acquisti non verificati.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-003","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"groupdual.ro","display_name":"Dual Man","proposed_role":"processor_service_provider","source_url":"https://www.groupdual.ro/en/","source_summary":"Azienda rumena di carpenteria industriale: strutture in acciaio, lavorazioni e assemblaggi saldati. Famiglie tubolari e norme utilizzate da verificare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-004","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"interpipe.biz","display_name":"INTERPIPE ROMAN S.A.","proposed_role":"producer","source_url":"https://interpipe.biz/en/about-company/","source_summary":"Il sito ufficiale del gruppo Interpipe identifica una fabbrica di tubi senza saldatura a Roman, Romania. Dominio del gruppo internazionale: identità legale della sede da collegare senza creare duplicati.","source_kind":"first_party_web","review_lane":"multinational_group_local_facility_review","research_id":"NET-RO1-G8-005","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"jpx.ro","display_name":"REPO / JPX","proposed_role":"end_user","source_url":"https://jpx.ro/repo/","source_summary":"Il sito REPO presenta produzione diretta di rimorchi in Romania. Prima di promuovere il profilo occorre attribuire correttamente il marchio alla persona giuridica proprietaria.","source_kind":"first_party_web","review_lane":"brand_legal_identity_review","research_id":"NET-RO1-G8-006","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"nimbconsmetal.ro","display_name":"NIMB CONSMETAL SRL","proposed_role":"processor_service_provider","source_url":"https://www.nimbconsmetal.ro/","source_summary":"Progettazione, fabbricazione e montaggio di strutture metalliche e impianti industriali; lavorazioni tubolari effettive e norme di prodotto da precisare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-007","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"oehlermecanica.ro","display_name":"OEHLER MECANICA SRL","proposed_role":"end_user","source_url":"https://www.oehlermecanica.ro/despre-noi/","source_summary":"Produttore rumeno di rimorchi e attrezzature agricole, con stabilimento di produzione a Mârșa. Tipologie di acciaio e tubi acquistati non confermate.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-008","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"renico.ro","display_name":"ReNiCo Ind SRL","proposed_role":"processor_service_provider","source_url":"https://renico.ro/en/company.html","source_summary":"Carpenteria meccanica saldata e lavorazioni per macchine forestali, gru e OEM industriali. Specifiche di consumo tubi ancora da confermare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-009","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"ssabag.ro","display_name":"SSAB-AG","proposed_role":"processor_service_provider","source_url":"https://www.ssabag.ro/en/despre-noi/fabrica-confectii-metalice/","source_summary":"Fabbrica rumena di strutture in acciaio e carpenterie metalliche con taglio, foratura, saldatura e verniciatura. Tipologie tubolari non ancora qualificate.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-010","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"umem.ro","display_name":"UZINA MECANICĂ MÂRȘA SA (UMEM)","proposed_role":"end_user","source_url":"https://umem.ro/en/company/","source_summary":"Fabbrica rumena di macchinari industriali e grandi strutture saldate secondo disegno. Possibile utilizzatore di acciaio strutturale; consumo di tubi da verificare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-011","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"variant-profile.com","display_name":"Variant Profile SRL","proposed_role":"producer","source_url":"https://www.variant-profile.com/","source_summary":"Produttore di profili aperti zincati, pannelli e lamiere profilate per edilizia con impianto in Romania. Non attribuire produzione di tubi strutturali chiusi senza fonti.","source_kind":"first_party_web","review_lane":"non_tubular_profile_product_review","research_id":"NET-RO1-G8-012","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"astra-passengers.ro","display_name":"ASTRA VAGOANE CĂLĂTORI","proposed_role":"end_user","source_url":"https://astra-passengers.ro/en/home/","source_summary":"Costruzione e modernizzazione di vagoni passeggeri, tram e carrozzerie ferroviarie in Romania; acquisti tubolari e acciai specifici non documentati.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-013","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"comerpan.ro","display_name":"Comerpan","proposed_role":"end_user","source_url":"https://www.comerpan.ro/en/pagina/feronerie-58","source_summary":"Produzione di parti e telai metallici per mobili, tavoli e sedute, con lavorazioni per clienti industriali. Tipi di profili acquistati da verificare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-014","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"dacia.ro","display_name":"Automobile Dacia","proposed_role":"end_user","source_url":"https://www.dacia.ro/brandul-dacia/platforma-mioveni.html","source_summary":"Stabilimento produttivo automobilistico rumeno con aree di presse, carrozzeria, chassis e montaggio. Identità societaria e pertinenza tubi alla supply chain da verificare.","source_kind":"first_party_web","review_lane":"group_brand_legal_identity_review","research_id":"NET-RO1-G8-015","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"didicom.ro","display_name":"Didicom","proposed_role":"end_user","source_url":"https://didicom.ro/","source_summary":"Produttore rumeno di mobili metallici, recinzioni, cancelli e strutture su misura con officina propria. Acquisti e norme dei tubolari non confermati.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-016","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"greenbrier-europe.com","display_name":"Greenbrier Europe — Romania","proposed_role":"end_user","source_url":"https://www.greenbrier-europe.com/production-facilities/","source_summary":"Gruppo con stabilimenti di vagoni merci a Caracal e Drobeta-Turnu Severin. Sito e dominio condivisi fra più Paesi: identificare le società rumene prima di pubblicare.","source_kind":"first_party_web","review_lane":"multinational_group_local_facility_review","research_id":"NET-RO1-G8-017","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"isaf.ro","display_name":"ISAF","proposed_role":"end_user","source_url":"https://isaf.ro/en/","source_summary":"Produzione rumena di componenti ferroviari per segnalamento ed elettrificazione, tra cui pali, traverse e supporti metallici. Acquisti tubolari non confermati.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-018","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"mar-ina.ro","display_name":"MAR-INA PRODPREST SRL","proposed_role":"processor_service_provider","source_url":"https://mar-ina.ro/en/","source_summary":"Fabbricazione industriale di armadi metallici, strutture e componenti in lamiera con taglio e saldatura. Specializzazione in tubi ancora da verificare.","source_kind":"first_party_web","review_lane":"industrial_fit_review","research_id":"NET-RO1-G8-019","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"mettim.ro","display_name":"MET Timișoara","proposed_role":"end_user","source_url":"https://mettim.ro/","source_summary":"Fabbricazione rumena di mobili metallici, carrelli, banchi, strutture e contenitori. Lavorazioni o acquisti di tubolari non confermati.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-020","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"revasimeria.ro","display_name":"REVA SA Simeria","proposed_role":"end_user","source_url":"https://www.revasimeria.ro/services","source_summary":"Costruzione, modernizzazione e riparazione di vagoni ferroviari, strutture metalliche e componenti. Tipi di profili impiegati da confermare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-021","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"ruloteaxer.ro","display_name":"AXER RULOTE SRL","proposed_role":"end_user","source_url":"https://ruloteaxer.ro/index.php?information_id=4&route=information/information","source_summary":"Fabbricazione propria di rimorchi commerciali e allestimenti mobili in Romania. Strutture portanti e specifiche tubi da qualificare con il produttore.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-022","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"ruris.ro","display_name":"RURIS","proposed_role":"end_user","source_url":"https://www.ruris.ro/","source_summary":"Azienda rumena specializzata in macchine e attrezzi agricoli; progetti di nuovi trattori e rimorchi annunciati nel 2026. Produzione effettiva e acquisti tubi da confermare.","source_kind":"first_party_web","review_lane":"industrial_end_user_fit_review","research_id":"NET-RO1-G8-023","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"temocraft.ro","display_name":"Temo Craft","proposed_role":"processor_service_provider","source_url":"https://temocraft.ro/","source_summary":"Officina rumena per fabbricazione componenti e assemblaggi metallici, taglio CNC e saldatura. Lavorazioni specifiche dei tubi da qualificare.","source_kind":"first_party_web","review_lane":"industrial_fit_review","research_id":"NET-RO1-G8-024","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"},{"country_code":"RO","canonical_domain":"uvaiud.ro","display_name":"UZINA DE VAGOANE AIUD SA","proposed_role":"end_user","source_url":"https://www.uvaiud.ro/en/","source_summary":"Costruzione, manutenzione e riparazione di vagoni, carrelli e strutture metalliche, con lavorazioni saldate. Consumo profili strutturali da confermare.","source_kind":"first_party_web","review_lane":"web_profile_review_pending","research_id":"NET-RO1-G8-025","batch_key":"NET-RO1-G8-NEW25","claim_status":"unclaimed","verification_status":"web_sourced_unverified","publication_status":"not_published"}]'::jsonb;
  v_expected constant integer := 25;
  v_eligible integer;
  v_inserted integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('NET-RO1.GROWTH8-NEW25')
  );

  SELECT count(*) INTO v_eligible
  FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
     country_code text, canonical_domain text, display_name text,
     proposed_role text, source_url text, source_summary text,
     source_kind text, review_lane text, research_id text,
     batch_key text, claim_status text, verification_status text,
     publication_status text
  )
  JOIN public.network_company_roles r ON r.canonical_key=m.proposed_role
                                    AND r.status='active'
  WHERE m.country_code='RO'
    AND m.source_kind='first_party_web'
    AND m.review_lane<>''
    AND m.claim_status='unclaimed'
    AND m.verification_status='web_sourced_unverified'
    AND m.publication_status='not_published'
    AND m.source_url ~ '^https://'
    AND m.canonical_domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    AND length(trim(m.display_name)) BETWEEN 3 AND 255
    AND length(trim(m.source_summary)) BETWEEN 25 AND 1000
    AND m.batch_key='NET-RO1-G8-NEW25'
    AND m.research_id ~ '^NET-RO1-G8-[0-9]{3}$'
    AND NOT EXISTS (
      SELECT 1 FROM private.network_web_research_seeds s
      WHERE s.country_code='RO'
        AND (s.canonical_domain=m.canonical_domain OR s.research_id=m.research_id
          OR pg_catalog.regexp_replace(lower(s.display_name),
            '[^[:alnum:]]','','g') =
             pg_catalog.regexp_replace(lower(m.display_name),
            '[^[:alnum:]]','','g'))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.network_companies p
      WHERE lower(p.website_domain)=m.canonical_domain
         OR (p.country_code='RO' AND
           pg_catalog.regexp_replace(lower(p.legal_name),'[^[:alnum:]]','','g') =
           pg_catalog.regexp_replace(lower(m.display_name),'[^[:alnum:]]','','g'))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.network_netfast3_suppressed_domains d
      WHERE d.domain=m.canonical_domain
    );
  IF v_eligible<>v_expected THEN
    RAISE EXCEPTION
      'NET-RO1.GROWTH8: only %/% fresh company records cleared; no partial research import',
      v_eligible,v_expected;
  END IF;
  -- Guard against internal manifest aliases (public/private checks above do not
  -- catch two new rows representing the same normalized business name).
  IF (SELECT count(DISTINCT x.canonical_domain)
      FROM pg_catalog.jsonb_to_recordset(v_manifest)
       AS x(canonical_domain text))<>v_expected
     OR (SELECT count(DISTINCT pg_catalog.regexp_replace(
             lower(x.display_name),'[^[:alnum:]]','','g'))
         FROM pg_catalog.jsonb_to_recordset(v_manifest)
           AS x(display_name text))<>v_expected
     OR (SELECT count(DISTINCT x.research_id)
         FROM pg_catalog.jsonb_to_recordset(v_manifest)
           AS x(research_id text))<>v_expected
  THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH8: duplicate within pinned new cohort';
  END IF;

  INSERT INTO private.network_web_research_seeds(
    country_code,canonical_domain,display_name,proposed_role,
    source_url,source_summary,source_kind,review_lane,research_id,batch_key
  )
  SELECT m.country_code,m.canonical_domain,m.display_name,m.proposed_role,
         m.source_url,m.source_summary,m.source_kind,m.review_lane,
         m.research_id,m.batch_key
  FROM pg_catalog.jsonb_to_recordset(v_manifest) AS m(
    country_code text,canonical_domain text,display_name text,
    proposed_role text,source_url text,source_summary text,
    source_kind text,review_lane text,research_id text,batch_key text
  );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted<>v_expected THEN
    RAISE EXCEPTION 'NET-RO1.GROWTH8: atomic import mismatch %/%',
      v_inserted,v_expected;
  END IF;
END;
$growth8$;
