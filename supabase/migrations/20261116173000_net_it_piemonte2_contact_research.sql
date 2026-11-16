-- NET-IT-PIEMONTE2 — self-service source-only contact-page research.
-- The service-role worker can CLAIM a bounded set of published AUTO3 companies
-- without a confirmed facility. It can only RECORD publicly displayed company
-- locality snippets; only the pre-existing maintenance geo-agent publishes a
-- facility after province+municipality ISTAT, first-party and ledger validation.
-- This does NOT approve identity, capability, products, contacts or rights.
CREATE TABLE IF NOT EXISTS private.net_it_piemonte2_contact_research (
  company_id uuid PRIMARY KEY REFERENCES public.network_companies(id),
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed','sourced','no_evidence','multiple_localities','blocked')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  page_count integer NOT NULL DEFAULT 0 CHECK (page_count BETWEEN 0 AND 4),
  source_url text,
  status_note text NOT NULL DEFAULT ''
);
ALTER TABLE private.net_it_piemonte2_contact_research ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_piemonte2_contact_research FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.net_it_piemonte2_contact_claim(p_max integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE
  v_r record;
  v_token uuid;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'service role only: no user or browser session'
      USING ERRCODE='42501';
  END IF;
  IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Only bounded 1..10 site claims are accepted' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.net_it_region_geo_auto_policy
    WHERE region='Piemonte' AND enabled
  ) THEN
    RETURN jsonb_build_object('contract','net-it-piemonte2-contact-claim-v1',
      'status','policy_disabled','items','[]'::jsonb);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(810021,20266);
  FOR v_r IN
    SELECT n.id company_id,n.legal_name,n.website_url,n.website_domain
    FROM public.network_companies n
    JOIN public.network_company_discovery_candidates c
      ON c.promoted_company_id=n.id
      AND c.canonical_domain=lower(btrim(n.website_domain))
      AND c.review_status='published' AND c.country_code='IT'
    JOIN private.network_web_research_seeds seed
      ON seed.canonical_domain=c.canonical_domain
      AND seed.batch_key LIKE 'NET-IT-PIEMONTE-%'
    JOIN private.net_it_auto3_publications a
      ON a.company_id=n.id AND a.candidate_id=c.id
    JOIN private.net_it_auto2_evidence proof
      ON proof.id=a.evidence_id AND proof.candidate_id=c.id
         AND proof.source_run_id=c.run_id
    LEFT JOIN private.net_it_piemonte2_contact_research old
      ON old.company_id=n.id
    WHERE n.country_code='IT' AND n.publication_status='published'
      AND n.archived_at IS NULL AND n.claimed_status='unclaimed'
      AND n.verification_status='unverified'
      AND n.website_url ~* '^https://'
      AND lower(regexp_replace(
        split_part(split_part(n.website_url,'/',3),':',1),
        '^www[.]',''))=lower(btrim(n.website_domain))
      AND a.actor_type='delegated_agent'
      AND a.policy='first_party_minimal_facts_only_v1'
      AND proof.reviewer_version='net-it-auto2-firstparty-v4'
      AND proof.verdict='identity_supported'
      AND proof.matched_company_name IS TRUE
      AND proof.identity_confidence>=0.94
      AND proof.observed_domain=lower(btrim(n.website_domain))
      AND proof.page_evidence_hash ~ '^[a-f0-9]{64}$'
      AND proof.source_rights_state='unknown'
      AND c.personal_data_detected IS NOT TRUE
      AND cardinality(coalesce(c.personal_data_fields,'{}'::text[]))=0
      AND c.match_company_id IS NULL
      AND NOT EXISTS(SELECT 1 FROM public.network_facilities f
                     WHERE f.company_id=n.id AND f.archived_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.network_it_geo_evidence_candidates g
                     WHERE g.company_id=n.id)
      AND NOT EXISTS(SELECT 1 FROM private.net_it_region_official_locality_observations o
                     WHERE o.company_id=n.id AND o.observed_at>=now()-interval '30 days')
      AND NOT EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains x
                     WHERE x.domain=lower(btrim(n.website_domain)))
      AND (old.company_id IS NULL
           OR (old.status<>'sourced' AND old.attempt_count<3
               AND old.claimed_at<now()-interval '2 days'))
    ORDER BY n.created_at,n.id
    LIMIT p_max
    FOR UPDATE OF n SKIP LOCKED
  LOOP
    v_token := gen_random_uuid();
    INSERT INTO private.net_it_piemonte2_contact_research(
      company_id,claim_token,attempt_count,status,claimed_at,completed_at,
      page_count,source_url,status_note
    ) VALUES (
      v_r.company_id,v_token,1,'claimed',now(),NULL,0,NULL,''
    ) ON CONFLICT(company_id) DO UPDATE
      SET claim_token=EXCLUDED.claim_token,
          attempt_count=private.net_it_piemonte2_contact_research.attempt_count+1,
          status='claimed',claimed_at=now(),completed_at=NULL,
          page_count=0,source_url=NULL,status_note='';
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'company_id',v_r.company_id,'claim_token',v_token,
      'domain',v_r.website_domain,'site',v_r.website_url,
      'company_name',v_r.legal_name));
  END LOOP;
  RETURN jsonb_build_object(
    'contract','net-it-piemonte2-contact-claim-v1',
    'status','claimed','items',v_items,
    'claimed',jsonb_array_length(v_items),'published',0);
END
$func$;
REVOKE ALL ON FUNCTION public.net_it_piemonte2_contact_claim(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_piemonte2_contact_claim(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.net_it_piemonte2_contact_record(
  p_company_id uuid,
  p_claim_token uuid,
  p_status text,
  p_pages integer DEFAULT 0,
  p_source_url text DEFAULT NULL,
  p_excerpt text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_province_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE
  v_company public.network_companies%rowtype;
  v_record private.net_it_piemonte2_contact_research%rowtype;
  v_municipality text;
  v_saved integer := 0;
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'service-role-only first-party geographic record'
      USING ERRCODE='42501';
  END IF;
  IF p_status NOT IN ('sourced','no_evidence','multiple_localities','blocked')
    OR p_pages IS NULL OR p_pages NOT BETWEEN 0 AND 4 THEN
    RAISE EXCEPTION 'Invalid bounded source result' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_record FROM private.net_it_piemonte2_contact_research
    WHERE company_id=p_company_id AND claim_token=p_claim_token
      AND status='claimed'
      AND claimed_at>=now()-interval '2 hours'
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No fresh matching bounded company claim' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_company FROM public.network_companies
    WHERE id=p_company_id AND publication_status='published'
      AND country_code='IT' AND claimed_status='unclaimed'
      AND verification_status='unverified' AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Company no longer eligible' USING ERRCODE='42501'; END IF;

  IF p_status='sourced' THEN
    IF p_source_url IS NULL OR p_source_url !~* '^https://'
      OR length(p_source_url)>2000
      OR lower(regexp_replace(
        split_part(split_part(p_source_url,'/',3),':',1),
        '^www[.]',''))<>lower(btrim(v_company.website_domain))
      OR p_postal_code !~ '^[0-9]{5}$'
      OR p_province_code !~ '^[A-Z]{2}$'
      OR char_length(btrim(coalesce(p_city,''))) NOT BETWEEN 2 AND 120
      OR char_length(coalesce(p_excerpt,'')) NOT BETWEEN 18 AND 500
      OR position(p_postal_code in p_excerpt)=0
      OR position(lower(btrim(p_city)) in lower(p_excerpt))=0
      OR position('('||p_province_code||')' in p_excerpt)=0
      OR p_excerpt ~* '[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}'
    THEN
      RAISE EXCEPTION 'Untrusted or incomplete first-party street source'
        USING ERRCODE='22023';
    END IF;
    SELECT municipality_name INTO v_municipality
      FROM public.network_it_municipalities
      WHERE is_current AND region_name='Piemonte'
        AND province_code=p_province_code
        AND lower(btrim(municipality_name))=lower(btrim(p_city));
    IF v_municipality IS NULL THEN
      RAISE EXCEPTION 'Province and municipality not confirmed by ISTAT'
        USING ERRCODE='22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.network_facilities
       WHERE company_id=p_company_id AND archived_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.network_it_geo_evidence_candidates
       WHERE company_id=p_company_id) THEN
      RAISE EXCEPTION 'Existing facility or separate geo review prevents staging'
        USING ERRCODE='42501';
    END IF;
    INSERT INTO private.net_it_region_official_locality_observations(
      company_id,domain,source_url,source_excerpt,country_code,
      region,province_code,city,postal_code
    ) VALUES (
      p_company_id,lower(btrim(v_company.website_domain)),p_source_url,
      p_excerpt,'IT','Piemonte',p_province_code,v_municipality,p_postal_code
    ) ON CONFLICT(company_id,source_url,postal_code,city) DO NOTHING;
    GET DIAGNOSTICS v_saved = ROW_COUNT;
  END IF;
  UPDATE private.net_it_piemonte2_contact_research
    SET status=p_status,completed_at=now(),page_count=p_pages,
        source_url=CASE WHEN p_status='sourced' THEN p_source_url ELSE NULL END,
        status_note=CASE WHEN p_status='sourced' THEN 'first_party_istat_match'
          ELSE 'no_auto_approval' END
    WHERE company_id=p_company_id AND claim_token=p_claim_token;
  RETURN jsonb_build_object('contract','net-it-piemonte2-contact-record-v1',
    'status',p_status,'observations_recorded',v_saved,'published',0);
END
$func$;
REVOKE ALL ON FUNCTION public.net_it_piemonte2_contact_record(
  uuid,uuid,text,integer,text,text,text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.net_it_piemonte2_contact_record(
  uuid,uuid,text,integer,text,text,text,text,text)
  TO service_role;
