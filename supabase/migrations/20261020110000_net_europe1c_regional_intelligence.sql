-- NET-UX EUROPE1C — governed European region browse.
-- NUTS 2024 reference data is official geography, NOT company verification.
-- Country matching requires a published facility located in that country.
-- A region is matched only by explicit NUTS code (future reviewed enrichment)
-- or exact published facility.region == official NUTS name. No fuzzy guesses.
BEGIN;
CREATE TABLE IF NOT EXISTS public.network_eu_nuts2024_regions (
 code text primary key,
 country_code text not null check (country_code ~ '^[A-Z]{2}$'),
 nuts_level smallint not null check (nuts_level between 1 and 3),
 name_latn text not null check (length(name_latn) between 1 and 140),
 reference_year integer not null default 2024 check (reference_year=2024),
 constraint network_eu_nuts2024_code_format check (code ~ '^[A-Z0-9]{3,6}$')
);
CREATE INDEX IF NOT EXISTS network_eu_nuts2024_regions_country_idx
 ON public.network_eu_nuts2024_regions (country_code, name_latn);
ALTER TABLE public.network_eu_nuts2024_regions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.network_eu_nuts2024_regions FROM public, anon, authenticated;
INSERT INTO public.network_eu_nuts2024_regions (code,country_code,nuts_level,name_latn)
VALUES
  ('AT11','AT',2,'Burgenland'),
  ('AT21','AT',2,'Kärnten'),
  ('AT12','AT',2,'Niederösterreich'),
  ('AT31','AT',2,'Oberösterreich'),
  ('AT32','AT',2,'Salzburg'),
  ('AT22','AT',2,'Steiermark'),
  ('AT33','AT',2,'Tirol'),
  ('AT34','AT',2,'Vorarlberg'),
  ('AT13','AT',2,'Wien'),
  ('BE1','BE',1,'Région de Bruxelles-Capitale/Brussels Hoofdstedelijk Gewest'),
  ('BE3','BE',1,'Région wallonne'),
  ('BE2','BE',1,'Vlaams Gewest'),
  ('BG32','BG',2,'Severen tsentralen'),
  ('BG33','BG',2,'Severoiztochen'),
  ('BG31','BG',2,'Severozapaden'),
  ('BG34','BG',2,'Yugoiztochen'),
  ('BG41','BG',2,'Yugozapaden'),
  ('BG42','BG',2,'Yuzhen tsentralen'),
  ('CY00','CY',2,'Kýpros'),
  ('CZ06','CZ',2,'Jihovýchod'),
  ('CZ03','CZ',2,'Jihozápad'),
  ('CZ08','CZ',2,'Moravskoslezsko'),
  ('CZ01','CZ',2,'Praha'),
  ('CZ05','CZ',2,'Severovýchod'),
  ('CZ04','CZ',2,'Severozápad'),
  ('CZ02','CZ',2,'Střední Čechy'),
  ('CZ07','CZ',2,'Střední Morava'),
  ('DE1','DE',1,'Baden-Württemberg'),
  ('DE2','DE',1,'Bayern'),
  ('DE3','DE',1,'Berlin'),
  ('DE4','DE',1,'Brandenburg'),
  ('DE5','DE',1,'Bremen'),
  ('DE6','DE',1,'Hamburg'),
  ('DE7','DE',1,'Hessen'),
  ('DE8','DE',1,'Mecklenburg-Vorpommern'),
  ('DE9','DE',1,'Niedersachsen'),
  ('DEA','DE',1,'Nordrhein-Westfalen'),
  ('DEB','DE',1,'Rheinland-Pfalz'),
  ('DEC','DE',1,'Saarland'),
  ('DED','DE',1,'Sachsen'),
  ('DEE','DE',1,'Sachsen-Anhalt'),
  ('DEF','DE',1,'Schleswig-Holstein'),
  ('DEG','DE',1,'Thüringen'),
  ('DK01','DK',2,'Hovedstaden'),
  ('DK04','DK',2,'Midtjylland'),
  ('DK05','DK',2,'Nordjylland'),
  ('DK02','DK',2,'Sjælland'),
  ('DK03','DK',2,'Syddanmark'),
  ('EE00','EE',2,'Eesti'),
  ('ES61','ES',2,'Andalucía'),
  ('ES24','ES',2,'Aragón'),
  ('ES13','ES',2,'Cantabria'),
  ('ES41','ES',2,'Castilla y León'),
  ('ES42','ES',2,'Castilla-La Mancha'),
  ('ES51','ES',2,'Cataluña'),
  ('ES63','ES',2,'Ciudad de Ceuta'),
  ('ES64','ES',2,'Ciudad de Melilla'),
  ('ES30','ES',2,'Comunidad de Madrid'),
  ('ES22','ES',2,'Comunidad Foral de Navarra'),
  ('ES52','ES',2,'Comunitat Valenciana '),
  ('ES43','ES',2,'Extremadura'),
  ('ES11','ES',2,'Galicia'),
  ('ES53','ES',2,'Illes Balears'),
  ('ES23','ES',2,'La Rioja'),
  ('ES21','ES',2,'País Vasco'),
  ('ES12','ES',2,'Principado de Asturias'),
  ('ES62','ES',2,'Región de Murcia'),
  ('FI20','FI',2,'Åland'),
  ('FI1C','FI',2,'Etelä-Suomi'),
  ('FI1B','FI',2,'Helsinki-Uusimaa'),
  ('FI19','FI',2,'Länsi-Suomi'),
  ('FI1D','FI',2,'Pohjois- ja Itä-Suomi'),
  ('FRF1','FR',2,'Alsace'),
  ('FRI1','FR',2,'Aquitaine'),
  ('FRK1','FR',2,'Auvergne'),
  ('FRD1','FR',2,'Basse-Normandie '),
  ('FRC1','FR',2,'Bourgogne'),
  ('FRH0','FR',2,'Bretagne'),
  ('FRB0','FR',2,'Centre — Val de Loire'),
  ('FRF2','FR',2,'Champagne-Ardenne'),
  ('FRM0','FR',2,'Corse'),
  ('FRC2','FR',2,'Franche-Comté'),
  ('FRD2','FR',2,'Haute-Normandie '),
  ('FR10','FR',2,'Ile-de-France'),
  ('FRJ1','FR',2,'Languedoc-Roussillon'),
  ('FRI2','FR',2,'Limousin'),
  ('FRF3','FR',2,'Lorraine'),
  ('FRJ2','FR',2,'Midi-Pyrénées'),
  ('FRE1','FR',2,'Nord-Pas de Calais'),
  ('FRG0','FR',2,'Pays de la Loire'),
  ('FRE2','FR',2,'Picardie'),
  ('FRI3','FR',2,'Poitou-Charentes'),
  ('FRL0','FR',2,'Provence-Alpes-Côte d’Azur'),
  ('FRK2','FR',2,'Rhône-Alpes'),
  ('EL51','GR',2,'Anatoliki Makedonia, Thraki'),
  ('EL30','GR',2,'Attiki'),
  ('EL63','GR',2,'Dytiki Elláda'),
  ('EL53','GR',2,'Dytiki Makedonia'),
  ('EL62','GR',2,'Ionia Nisia'),
  ('EL54','GR',2,'Ipeiros'),
  ('EL52','GR',2,'Kentriki Makedonia'),
  ('EL43','GR',2,'Kriti'),
  ('EL42','GR',2,'Notio Aigaio'),
  ('EL65','GR',2,'Peloponnisos'),
  ('EL64','GR',2,'Sterea Elláda'),
  ('EL61','GR',2,'Thessalia'),
  ('EL41','GR',2,'Voreio Aigaio'),
  ('HR05','HR',2,'Grad Zagreb'),
  ('HR03','HR',2,'Jadranska Hrvatska'),
  ('HR02','HR',2,'Panonska Hrvatska'),
  ('HR06','HR',2,'Sjeverna Hrvatska'),
  ('HU11','HU',2,'Budapest'),
  ('HU33','HU',2,'Dél-Alföld'),
  ('HU23','HU',2,'Dél-Dunántúl'),
  ('HU32','HU',2,'Észak-Alföld'),
  ('HU31','HU',2,'Észak-Magyarország'),
  ('HU21','HU',2,'Közép-Dunántúl'),
  ('HU22','HU',2,'Nyugat-Dunántúl'),
  ('HU12','HU',2,'Pest'),
  ('IE06','IE',2,'Eastern and Midland'),
  ('IE04','IE',2,'Northern and Western'),
  ('IE05','IE',2,'Southern'),
  ('ITF1','IT',2,'Abruzzo'),
  ('ITF5','IT',2,'Basilicata'),
  ('ITF6','IT',2,'Calabria'),
  ('ITF3','IT',2,'Campania'),
  ('ITH5','IT',2,'Emilia-Romagna'),
  ('ITH4','IT',2,'Friuli-Venezia Giulia'),
  ('ITI4','IT',2,'Lazio'),
  ('ITC3','IT',2,'Liguria'),
  ('ITC4','IT',2,'Lombardia'),
  ('ITI3','IT',2,'Marche'),
  ('ITF2','IT',2,'Molise'),
  ('ITC1','IT',2,'Piemonte'),
  ('ITH1','IT',2,'Provincia Autonoma di Bolzano/Bozen'),
  ('ITH2','IT',2,'Provincia Autonoma di Trento'),
  ('ITF4','IT',2,'Puglia'),
  ('ITG2','IT',2,'Sardegna'),
  ('ITG1','IT',2,'Sicilia'),
  ('ITI1','IT',2,'Toscana'),
  ('ITI2','IT',2,'Umbria'),
  ('ITC2','IT',2,'Valle d’Aosta/Vallée d’Aoste'),
  ('ITH3','IT',2,'Veneto'),
  ('LT01','LT',2,'Sostinės regionas'),
  ('LT02','LT',2,'Vidurio ir vakarų Lietuvos regionas '),
  ('LU00','LU',2,'Luxembourg'),
  ('LV00','LV',2,'Latvija'),
  ('MT00','MT',2,'Malta'),
  ('NL13','NL',2,'Drenthe'),
  ('NL23','NL',2,'Flevoland'),
  ('NL12','NL',2,'Friesland (NL)'),
  ('NL22','NL',2,'Gelderland'),
  ('NL11','NL',2,'Groningen'),
  ('NL42','NL',2,'Limburg (NL)'),
  ('NL41','NL',2,'Noord-Brabant'),
  ('NL32','NL',2,'Noord-Holland'),
  ('NL21','NL',2,'Overijssel'),
  ('NL35','NL',2,'Utrecht'),
  ('NL34','NL',2,'Zeeland'),
  ('NL36','NL',2,'Zuid-Holland'),
  ('PL51','PL',2,'Dolnośląskie'),
  ('PL61','PL',2,'Kujawsko-pomorskie'),
  ('PL71','PL',2,'Łódzkie'),
  ('PL81','PL',2,'Lubelskie'),
  ('PL43','PL',2,'Lubuskie'),
  ('PL21','PL',2,'Małopolskie'),
  ('PL92','PL',2,'Mazowiecki regionalny'),
  ('PL52','PL',2,'Opolskie'),
  ('PL82','PL',2,'Podkarpackie'),
  ('PL84','PL',2,'Podlaskie'),
  ('PL63','PL',2,'Pomorskie'),
  ('PL22','PL',2,'Śląskie'),
  ('PL72','PL',2,'Świętokrzyskie'),
  ('PL62','PL',2,'Warmińsko-mazurskie'),
  ('PL91','PL',2,'Warszawski stołeczny'),
  ('PL41','PL',2,'Wielkopolskie'),
  ('PL42','PL',2,'Zachodniopomorskie'),
  ('PT1C','PT',2,'Alentejo'),
  ('PT15','PT',2,'Algarve'),
  ('PT19','PT',2,'Centro (PT)'),
  ('PT1A','PT',2,'Grande Lisboa'),
  ('PT11','PT',2,'Norte'),
  ('PT1D','PT',2,'Oeste e Vale do Tejo'),
  ('PT1B','PT',2,'Península de Setúbal'),
  ('PT30','PT',2,'Região Autónoma da Madeira'),
  ('PT20','PT',2,'Região Autónoma dos Açores'),
  ('RO32','RO',2,'Bucureşti-Ilfov'),
  ('RO12','RO',2,'Centru'),
  ('RO21','RO',2,'Nord-Est'),
  ('RO11','RO',2,'Nord-Vest'),
  ('RO22','RO',2,'Sud-Est'),
  ('RO31','RO',2,'Sud-Muntenia'),
  ('RO41','RO',2,'Sud-Vest Oltenia'),
  ('RO42','RO',2,'Vest'),
  ('SE32','SE',2,'Mellersta Norrland'),
  ('SE31','SE',2,'Norra Mellansverige'),
  ('SE12','SE',2,'Östra Mellansverige'),
  ('SE33','SE',2,'Övre Norrland'),
  ('SE21','SE',2,'Småland med öarna'),
  ('SE11','SE',2,'Stockholm'),
  ('SE22','SE',2,'Sydsverige'),
  ('SE23','SE',2,'Västsverige'),
  ('SI03','SI',2,'Vzhodna Slovenija'),
  ('SI04','SI',2,'Zahodna Slovenija'),
  ('SK01','SK',2,'Bratislavský kraj'),
  ('SK03','SK',2,'Stredné Slovensko'),
  ('SK04','SK',2,'Východné Slovensko'),
  ('SK02','SK',2,'Západné Slovensko')
ON CONFLICT (code) DO UPDATE SET country_code=excluded.country_code,
 nuts_level=excluded.nuts_level, name_latn=excluded.name_latn;
-- Nullable and unpopulated by this migration: only reviewed source matching
-- may assign a canonical region code in later controlled enrichment.
ALTER TABLE public.network_facilities ADD COLUMN IF NOT EXISTS eu_nuts2024_code text;
ALTER TABLE public.network_facilities
 ADD CONSTRAINT network_facilities_eu_nuts2024_fk
 FOREIGN KEY (eu_nuts2024_code) REFERENCES public.network_eu_nuts2024_regions(code);
CREATE INDEX IF NOT EXISTS network_facilities_eu_nuts2024_idx
 ON public.network_facilities (eu_nuts2024_code)
 WHERE eu_nuts2024_code IS NOT NULL AND publication_status='published';

CREATE OR REPLACE FUNCTION public.net_europe1c_region_search(
 p_organization_id uuid, p_access text, p_country text, p_region_code text,
 p_query text DEFAULT NULL, p_role text DEFAULT NULL, p_product text DEFAULT NULL,
 p_capability text DEFAULT NULL, p_market text DEFAULT NULL,
 p_page integer DEFAULT 1, p_limit integer DEFAULT 6
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_country text:=upper(btrim(coalesce(p_country,'')));
 v_code text:=upper(btrim(coalesce(p_region_code,'')));
 v_count integer:=0; v_items jsonb:='[]'::jsonb;
 v_page integer:=coalesce(p_page,1); v_limit integer:=coalesce(p_limit,6);
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING errcode='42501';
 END IF;
 IF p_access='free' THEN
  PERFORM private.netux11_require_active_company(p_organization_id);
 ELSIF p_access='pro' THEN
  PERFORM private.pa1_3_require_network_access(p_organization_id);
 ELSE
  RAISE EXCEPTION 'Invalid access' USING errcode='22023';
 END IF;
 IF v_page<1 OR v_page>100000 OR v_limit<1 OR v_limit>18 OR
    length(coalesce(p_query,''))>120 OR
    length(coalesce(p_role,''))>90 OR length(coalesce(p_product,''))>100 OR
    length(coalesce(p_capability,''))>100 OR length(coalesce(p_market,''))>100 OR
    NOT EXISTS (SELECT 1 FROM public.network_eu_nuts2024_regions r
      WHERE r.code=v_code AND r.country_code=v_country) THEN
  RAISE EXCEPTION 'Unsupported European region' USING errcode='22023';
 END IF;

 WITH matched_facilities AS (
  SELECT DISTINCT ON (f.company_id) f.company_id, f.id facility_id,
   f.city, f.region, f.eu_nuts2024_code
  FROM public.network_facilities f
  JOIN public.network_eu_nuts2024_regions r ON r.code=v_code AND r.country_code=v_country
  WHERE f.country_code=v_country AND f.publication_status='published'
   AND f.archived_at IS NULL
   AND (f.eu_nuts2024_code=r.code
      OR (f.eu_nuts2024_code IS NULL AND nullif(btrim(f.region),'') IS NOT NULL
         AND lower(btrim(f.region))=lower(btrim(r.name_latn))))
  ORDER BY f.company_id, f.created_at, f.id
 ), eligible AS (
  SELECT c.id, c.legal_name,c.trading_name,c.country_code,c.website_url,
   c.verification_status,c.claimed_status, mf.facility_id, mf.city, mf.region,
   mf.eu_nuts2024_code
  FROM public.network_companies c
  JOIN matched_facilities mf ON mf.company_id=c.id
  WHERE c.publication_status='published' AND c.archived_at IS NULL
   AND (nullif(btrim(coalesce(p_query,'')),'') IS NULL
     OR strpos(lower(c.legal_name),lower(btrim(p_query)))>0
     OR strpos(lower(coalesce(c.trading_name,'')),lower(btrim(p_query)))>0
     OR strpos(lower(coalesce(c.website_domain,'')),lower(btrim(p_query)))>0)
   AND (nullif(p_role,'') IS NULL OR EXISTS (
     SELECT 1 FROM public.network_company_role_assignments a
     JOIN public.network_company_roles cr ON cr.id=a.role_id
     WHERE a.company_id=c.id AND cr.canonical_key=p_role))
   AND (nullif(p_product,'') IS NULL OR EXISTS (
     SELECT 1 FROM public.network_company_products cp
     JOIN public.network_product_families pf ON pf.id=cp.product_family_id
     WHERE cp.company_id=c.id AND pf.canonical_key=p_product))
   AND (nullif(p_market,'') IS NULL OR EXISTS (
     SELECT 1 FROM public.network_company_markets cm
     JOIN public.network_markets m ON m.id=cm.market_id
     WHERE cm.company_id=c.id AND m.canonical_key=p_market))
   AND (nullif(p_capability,'') IS NULL OR EXISTS (
     SELECT 1 FROM public.network_facility_capabilities fc
     JOIN public.network_capabilities cap ON cap.id=fc.capability_id
     WHERE fc.facility_id=mf.facility_id AND cap.canonical_key=p_capability))
 ), picked AS (
  SELECT * FROM eligible ORDER BY lower(legal_name), id
  LIMIT v_limit OFFSET (v_page-1)*v_limit
 )
 SELECT (SELECT count(*)::integer FROM eligible),
  coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',x.id,'legal_name',x.legal_name,'trading_name',x.trading_name,
   'country_code',v_country,'website_url',x.website_url,
   'claimed_status',x.claimed_status,'verification_status',x.verification_status,
   'location',jsonb_build_object('region',x.region,'city',x.city),
   'geography_status','published',
   'roles',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'key',cr.canonical_key,'name',cr.display_name,'is_primary',a.is_primary)
     ORDER BY a.is_primary DESC,cr.display_name)
     FROM public.network_company_role_assignments a
     JOIN public.network_company_roles cr ON cr.id=a.role_id
     WHERE a.company_id=x.id AND cr.status='active'),'[]'::jsonb),
   'products',coalesce((SELECT jsonb_agg(DISTINCT pf.display_name)
     FROM public.network_company_products cp
     JOIN public.network_product_families pf ON pf.id=cp.product_family_id
     WHERE cp.company_id=x.id AND pf.status='active'),'[]'::jsonb),
   'capabilities',coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object(
      'key',cap.canonical_key,'name',cap.display_name))
     FROM public.network_facility_capabilities fc
     JOIN public.network_capabilities cap ON cap.id=fc.capability_id
     WHERE fc.facility_id=x.facility_id AND cap.status='active'),'[]'::jsonb)
  ) ORDER BY lower(x.legal_name),x.id) FROM picked x),'[]'::jsonb)
 INTO v_count,v_items;
 RETURN jsonb_build_object('contract','net-europe1c-region-v1',
  'country',v_country,'region_code',v_code,'scope','published_facilities_only',
  'total',v_count,'page',v_page,'page_size',v_limit,'items',v_items);
END
$fn$;
REVOKE ALL ON FUNCTION public.net_europe1c_region_search(uuid,text,text,text,text,text,text,text,text,integer,integer)
 FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_europe1c_region_search(uuid,text,text,text,text,text,text,text,text,integer,integer)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.net_europe1c_region_coverage(
 p_organization_id uuid, p_access text, p_country text
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_country text:=upper(btrim(coalesce(p_country,'')));
 v_rows jsonb:='[]'::jsonb; v_mapped integer:=0; v_total integer:=0;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING errcode='42501';
 END IF;
 IF p_access='free' THEN
  PERFORM private.netux11_require_active_company(p_organization_id);
 ELSIF p_access='pro' THEN
  PERFORM private.pa1_3_require_network_access(p_organization_id);
 ELSE RAISE EXCEPTION 'Invalid access' USING errcode='22023'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.network_eu_nuts2024_regions r
    WHERE r.country_code=v_country) THEN
  RAISE EXCEPTION 'Unsupported country' USING errcode='22023';
 END IF;
 WITH eligible AS (
  SELECT f.id,f.company_id,f.eu_nuts2024_code,f.region
  FROM public.network_facilities f
  JOIN public.network_companies c ON c.id=f.company_id
  WHERE f.country_code=v_country AND f.publication_status='published'
   AND f.archived_at IS NULL AND c.publication_status='published'
   AND c.archived_at IS NULL
 ), mapped AS (
  SELECT DISTINCT e.id,e.company_id,r.code
  FROM eligible e
  JOIN public.network_eu_nuts2024_regions r ON r.country_code=v_country
   AND (e.eu_nuts2024_code=r.code
     OR (e.eu_nuts2024_code IS NULL AND nullif(btrim(e.region),'') IS NOT NULL
        AND lower(btrim(e.region))=lower(btrim(r.name_latn))))
 ), per_region AS (
  SELECT r.code,r.name_latn,
   count(DISTINCT m.company_id)::integer AS company_count
  FROM public.network_eu_nuts2024_regions r
  LEFT JOIN mapped m ON m.code=r.code
  WHERE r.country_code=v_country
  GROUP BY r.code,r.name_latn
 )
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object(
  'code',code,'name',name_latn,'count',company_count)
  ORDER BY name_latn,code) FROM per_region),'[]'::jsonb),
  (SELECT count(DISTINCT company_id)::integer FROM mapped),
  (SELECT count(DISTINCT company_id)::integer FROM eligible)
 INTO v_rows,v_mapped,v_total;
 RETURN jsonb_build_object('contract','net-europe1c-coverage-v1',
  'country',v_country,'regions',v_rows,'mapped_companies',v_mapped,
  'facility_companies',v_total,'coverage_complete',false,
  'scope','published_facilities_only');
END
$fn$;
REVOKE ALL ON FUNCTION public.net_europe1c_region_coverage(uuid,text,text)
 FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_europe1c_region_coverage(uuid,text,text)
 TO authenticated;
COMMENT ON FUNCTION public.net_europe1c_region_search(uuid,text,text,text,text,text,text,text,text,integer,integer)
 IS 'EUROPE1C strict approved geography: only published facility matching exact NUTS 2024 code or official region name. Company products are company-scoped, capabilities on matched facility.';
COMMENT ON FUNCTION public.net_europe1c_region_coverage(uuid,text,text)
 IS 'EUROPE1C published facilities only, region counts per tenant entitlement. Zero mapped counts do not mean no industrial activity.';
COMMIT;
