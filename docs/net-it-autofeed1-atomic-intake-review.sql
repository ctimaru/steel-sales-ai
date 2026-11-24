-- REVIEW DRAFT ONLY. Not a migration; do not execute against production.
-- Existing private function retains its existing owner and ACL; no source or policy is created.
BEGIN;
CREATE OR REPLACE FUNCTION private.net_it_seed1_stage_impl(p_source_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_source private.net_it_seed1_index_sources%rowtype;
 v_received integer;
 v_valid integer;
 v_known integer;
 v_inserted integer;
 v_proofs integer;
 v_auto boolean;
 v_queue integer;
 v_today integer;
BEGIN
 IF NOT private.net_it_seed1_policy_active() THEN
  RAISE EXCEPTION 'Site discovery is not authorized' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_source FROM private.net_it_seed1_index_sources
  WHERE id=p_source_id AND enabled FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Unknown or disabled index page' USING ERRCODE='22023';
 END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array'
    OR jsonb_array_length(p_items)>1000 THEN
  RAISE EXCEPTION 'At most 1000 domains per index page' USING ERRCODE='22023';
 END IF;
 v_received := jsonb_array_length(p_items);
 v_auto := v_source.source_url = 'https://docs.overturemaps.org/guides/places/#sss-autofeed-v1';
 IF v_auto THEN
  IF v_source.added_by IS NULL OR v_source.source_kind <> 'other'
    OR v_received NOT BETWEEN 1 AND least(250,v_source.max_links) THEN
   RAISE EXCEPTION 'Invalid authorized autofeed source or bounded lot' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_items) i
   WHERE NOT coalesce(
     (i->>'domain') ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.][a-z]{2,24}$'
     AND (i->>'domain') !~ '(legno|infissi|serrament|falegnam|ferrament|autoofficina|porte-corazzate)'
     AND (i->>'domain') NOT IN ('facebook.com','linkedin.com','instagram.com','youtube.com','google.com','google.it','paginegialle.it','europages.com','kompass.com','wordpress.com','wixsite.com','blogspot.com')
     AND (i->>'url') = 'https://' || (i->>'domain') || '/'
     AND (i->>'source_license') = 'CDLA-Permissive-2.0'
     AND (i->>'release') ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}[.][0-9]+$'
     AND (i->>'gers_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND (i->>'evidence') ~ '^https://github[.]com/ctimaru/steel-sales-ai/blob/[0-9a-f]{40}/services/worker/audits/[A-Za-z0-9_.-]+[.]csv$'
     AND (i->>'region_bucket') IN ('nord_ovest','lombardia','nord_est','emilia_romagna','toscana_umbria_marche','lazio_abruzzo_molise','campania_puglia','basilicata_calabria','sicilia','sardegna')
     AND (i->>'taxonomy') IN ('metal_fabricator','iron_fabricator','steel_fabricator','welder','laser_cutting_service','sheet_metal_contractor','sheet_metal_fabricator'),false)
   ) OR (SELECT count(DISTINCT i->>'domain') FROM jsonb_array_elements(p_items) i) <> v_received THEN
   RAISE EXCEPTION 'Invalid or duplicate autofeed provenance' USING ERRCODE='22023';
  END IF;
  SELECT count(*) INTO v_queue FROM private.net_it_seed1_domains WHERE status IN ('staged','claimed');
  SELECT count(*) INTO v_today FROM private.net_it_seed1_domains
    WHERE source_id=p_source_id AND staged_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  IF v_queue>=100 OR v_today+v_received>1000 OR v_queue+v_received>500 THEN
   RETURN jsonb_build_object('contract','net-it-autofeed-stage-v1','status','capacity_hold',
    'received',0,'staged',0,'already_known',0,'published',0);
  END IF;
 END IF;

 WITH incoming AS (
  SELECT DISTINCT ON (d) d AS domain,u AS proposed_url,e AS evidence_url
  FROM (
   SELECT lower(btrim(i->>'domain')) d,btrim(i->>'url') u,
          left(btrim(coalesce(i->>'evidence',v_source.source_url)),2000) e
   FROM jsonb_array_elements(p_items) i
  ) x
  WHERE d ~ '^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?[.][a-z]{2,24}$'
    AND u ~* '^https://' AND char_length(u)<=2000
    AND lower(split_part(split_part(u,'/',3),':',1)) IN (d,'www.'||d)
  ORDER BY d
 ), fresh AS (
  SELECT n.* FROM incoming n
  WHERE NOT EXISTS(SELECT 1 FROM public.network_companies c
                   WHERE lower(btrim(c.website_domain))=n.domain)
    AND NOT EXISTS(SELECT 1 FROM public.network_company_discovery_candidates c
                   WHERE lower(btrim(c.canonical_domain))=n.domain)
    AND NOT EXISTS(SELECT 1 FROM private.network_web_research_seeds s
                   WHERE lower(btrim(s.canonical_domain))=n.domain)
    AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains s
                   WHERE s.domain=n.domain)
    AND NOT EXISTS(SELECT 1 FROM private.net_it_seed1_domains q
                   WHERE q.domain=n.domain)
 ), ins AS (
  INSERT INTO private.net_it_seed1_domains(domain,proposed_url,source_id,evidence_url)
  SELECT domain,proposed_url,p_source_id,evidence_url FROM fresh
  ON CONFLICT(domain) DO NOTHING RETURNING domain
 ), proofs AS (
  INSERT INTO private.net_it_overture_provenance(
    source_id,domain,overture_gers_id,dataset_release,source_license,regional_bucket,place_taxonomy,source_audit_url)
  SELECT p_source_id,ins.domain,(i->>'gers_id')::uuid,i->>'release',i->>'source_license',
         i->>'region_bucket',i->>'taxonomy',i->>'evidence'
  FROM ins JOIN jsonb_array_elements(p_items) i ON i->>'domain'=ins.domain
  WHERE v_auto
  RETURNING 1
 )
 SELECT (SELECT count(*) FROM incoming),(SELECT count(*) FROM ins),(SELECT count(*) FROM proofs)
 INTO v_valid,v_inserted,v_proofs;
 IF v_auto AND v_proofs<>v_inserted THEN
  RAISE EXCEPTION 'Autofeed provenance mismatch';
 END IF;
 v_known := v_valid-v_inserted;

 UPDATE private.net_it_seed1_index_sources
 SET last_result=jsonb_build_object('at',now(),'received',v_received,
   'valid',v_valid,'already_known',v_known,'staged',v_inserted)
 WHERE id=p_source_id;
 IF v_auto THEN
  RETURN jsonb_build_object('contract','net-it-autofeed-stage-v1','status','ok',
    'received',v_received,'valid',v_valid,'already_known',v_known,'staged',v_inserted,'published',0);
 END IF;
 RETURN jsonb_build_object('contract','net-it-seed1-stage-v1',
  'received',v_received,'valid',v_valid,'already_known',v_known,
  'staged',v_inserted,'published',0);
END
$function$;

CREATE OR REPLACE FUNCTION public.net_it_autofeed_stage(p_source_id uuid,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE v_result jsonb;
BEGIN
 IF current_user <> 'service_role' THEN
  RAISE EXCEPTION 'Backend service role required' USING ERRCODE='42501';
 END IF;
 v_result := private.net_it_seed1_stage_impl(p_source_id,p_items);
 IF v_result->>'contract' IS DISTINCT FROM 'net-it-autofeed-stage-v1' THEN
  RAISE EXCEPTION 'Authorized autofeed source required' USING ERRCODE='42501';
 END IF;
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.net_it_autofeed_stage(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_autofeed_stage(uuid,jsonb) TO service_role;
COMMIT;
