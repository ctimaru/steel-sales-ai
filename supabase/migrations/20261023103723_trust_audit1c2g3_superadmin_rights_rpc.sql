-- TRUST-AUDIT1C.2G.3 · owner-only RPCs; no service-role direct execute and no AI/public entitlement change.
-- Production ledger version 20261023103723, applied staging-first.
CREATE OR REPLACE FUNCTION public.trust_c2g3_rights_console(p_scope text DEFAULT 'paid_network'::text, p_filter text DEFAULT 'all'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_company_id uuid DEFAULT NULL::uuid, p_evidence_kind text DEFAULT NULL::text, p_evidence_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_payload jsonb; v_company uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT private.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Platform Owner required' USING ERRCODE='42501';
  END IF;
  IF p_scope NOT IN ('discovery','factual_profile','excerpt_republication','ai_retrieval','ai_training','bulk_redistribution','paid_network')
     OR p_filter NOT IN ('all','hold','unassessed','blocked','reviewed')
     OR p_limit NOT BETWEEN 1 AND 50 OR p_offset NOT BETWEEN 0 AND 50000
     OR (p_evidence_id IS NOT NULL AND p_evidence_kind IS NULL)
     OR (p_evidence_kind IS NOT NULL AND p_evidence_kind NOT IN ('discovery_candidate','source_assessment','data_assertion','canonical_evidence')) THEN
    RAISE EXCEPTION 'Invalid rights console request' USING ERRCODE='22023';
  END IF;

  SELECT coalesce(p_company_id, (
    SELECT m.company_id
    FROM private.trust_c2g2_company_allowed_use_matrix m
    JOIN public.network_companies c ON c.id=m.company_id
    WHERE m.use_scope=p_scope
      AND (p_filter='all'
       OR (p_filter='hold' AND m.hold_count>0)
       OR (p_filter='unassessed' AND m.company_use_state IN('not_assessed','needs_review','no_evidence'))
       OR (p_filter='blocked' AND m.company_use_state='blocked')
       OR (p_filter='reviewed' AND m.reviewed_links>0))
    ORDER BY CASE WHEN m.hold_count>0 THEN 0 ELSE 1 END,lower(c.legal_name),c.id
    LIMIT 1 OFFSET p_offset
  )) INTO v_company;

  SELECT jsonb_build_object(
    'contract','trust-c2g3-rights-console-v1',
    'scope',p_scope,'filter',p_filter,'limit',p_limit,'offset',p_offset,
    'total',(SELECT count(*) FROM private.trust_c2g2_company_allowed_use_matrix m
      WHERE m.use_scope=p_scope AND
        (p_filter='all' OR (p_filter='hold' AND m.hold_count>0)
         OR (p_filter='unassessed' AND m.company_use_state IN('not_assessed','needs_review','no_evidence'))
         OR (p_filter='blocked' AND m.company_use_state='blocked')
         OR (p_filter='reviewed' AND m.reviewed_links>0))),
    'items',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',d.company_id,'name',d.legal_name,'status',d.publication_status,
        'source_count',d.linked_evidence_count,'hold_count',d.hold_count,
        'use_state',d.company_use_state,'reviewed',d.reviewed_links,
        'allowed',d.allowed_links,'blocked',d.blocked_links
      ) ORDER BY d.hold_priority,lower(d.legal_name),d.company_id)
      FROM (
        SELECT m.*,c.legal_name,
          CASE WHEN m.hold_count>0 THEN 0 ELSE 1 END AS hold_priority
        FROM private.trust_c2g2_company_allowed_use_matrix m
        JOIN public.network_companies c ON c.id=m.company_id
        WHERE m.use_scope=p_scope AND
          (p_filter='all' OR (p_filter='hold' AND m.hold_count>0)
           OR (p_filter='unassessed' AND m.company_use_state IN('not_assessed','needs_review','no_evidence'))
           OR (p_filter='blocked' AND m.company_use_state='blocked')
           OR (p_filter='reviewed' AND m.reviewed_links>0))
        ORDER BY hold_priority,lower(c.legal_name),m.company_id
        LIMIT p_limit OFFSET p_offset
      ) d
    ),'[]'::jsonb),
    'selected',(
      SELECT jsonb_build_object(
        'id',c.id,'name',c.legal_name,'country',c.country_code,
        'publication_status',c.publication_status,
        'company_use_state',m.company_use_state,
        'source_count',m.linked_evidence_count,'hold_count',m.hold_count,
        'evidence',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'kind',e.evidence_kind,'id',e.evidence_id,
            'source_url',e.source_url,'source_date',e.recorded_at,
            'candidate_governance',e.candidate_governance,
            'run_governance',e.run_governance,
            'rights_evidence_url',e.rights_evidence_url,
            'state',um.effective_rights_state,'decision_id',um.decision_id,
            'reviewed_at',um.reviewed_at,'valid_until',um.valid_until
          ) ORDER BY e.recorded_at DESC NULLS LAST,e.evidence_id)
          FROM (
            SELECT * FROM private.trust_c2g1_source_evidence_links q
            WHERE q.company_id=c.id
            ORDER BY q.recorded_at DESC NULLS LAST,q.evidence_id
            LIMIT 40
          ) e
          JOIN private.trust_c2g2_evidence_use_matrix um
            ON um.company_id=e.company_id
           AND um.evidence_kind=e.evidence_kind
           AND um.evidence_id=e.evidence_id
           AND um.use_scope=p_scope
        ),'[]'::jsonb),
        'history',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'decision',d.decision,'scope',d.use_scope,'basis',d.rights_basis,
            'evidence_url',d.evidence_url,'terms_version',d.terms_version,
            'note',d.review_note,'reviewed_at',d.reviewed_at,
            'valid_until',d.valid_until,'recorded_at',d.recorded_at
          ) ORDER BY d.recorded_at DESC,d.decision_id DESC)
          FROM (
            SELECT * FROM private.trust_c2g2_rights_decisions h
            WHERE h.evidence_kind=p_evidence_kind AND h.evidence_id=p_evidence_id
            ORDER BY h.recorded_at DESC,h.decision_id DESC LIMIT 20
          ) d
        ),'[]'::jsonb)
      )
      FROM public.network_companies c
      JOIN private.trust_c2g2_company_allowed_use_matrix m
        ON m.company_id=c.id AND m.use_scope=p_scope
      WHERE c.id=v_company
    ),
    'decision_count',(SELECT count(*) FROM private.trust_c2g2_rights_decisions)
  ) INTO v_payload;
  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trust_c2g3_record_rights_decision(p_evidence_kind text, p_evidence_id uuid, p_use_scope text, p_decision text, p_rights_basis text DEFAULT NULL::text, p_evidence_url text DEFAULT NULL::text, p_terms_version text DEFAULT NULL::text, p_review_note text DEFAULT NULL::text, p_attribution_requirements text DEFAULT NULL::text, p_valid_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_expected_decision_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid := (select auth.uid());v_previous uuid;v_new uuid;v_holds integer;
BEGIN
  IF v_actor IS NULL OR NOT private.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Platform Owner required' USING ERRCODE='42501';
  END IF;
  IF p_evidence_kind NOT IN ('discovery_candidate','source_assessment','data_assertion','canonical_evidence')
    OR p_use_scope NOT IN ('discovery','factual_profile','excerpt_republication','ai_retrieval','ai_training','bulk_redistribution','paid_network')
    OR p_decision NOT IN ('needs_review','allowed','limited','blocked','revoked')
    OR p_review_note IS NULL OR length(btrim(p_review_note)) NOT BETWEEN 12 AND 1500
    OR (p_valid_until IS NOT NULL AND p_valid_until<=now()) THEN
    RAISE EXCEPTION 'Invalid rights decision' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM private.trust_c2g1_source_evidence_links e
                WHERE e.evidence_kind=p_evidence_kind AND e.evidence_id=p_evidence_id) THEN
    RAISE EXCEPTION 'Evidence is no longer linked' USING ERRCODE='23503';
  END IF;
  SELECT count(*) INTO v_holds
  FROM private.trust_c2g1_source_evidence_links e
  JOIN private.trust_c2g1_company_evidence_summary c ON c.company_id=e.company_id
  WHERE e.evidence_kind=p_evidence_kind AND e.evidence_id=p_evidence_id
    AND c.hold_count>0;
  IF p_decision IN('allowed','limited') AND v_holds>0 THEN
    RAISE EXCEPTION 'Source has an unresolved hold' USING ERRCODE='42501';
  END IF;
  IF p_decision IN('allowed','limited')
    AND (p_valid_until IS NULL OR p_rights_basis IS NULL
         OR p_evidence_url IS NULL OR p_evidence_url !~ '^https://[^ ]+$'
         OR p_terms_version IS NULL OR btrim(p_terms_version)='' ) THEN
    RAISE EXCEPTION 'Grant needs HTTPS proof, terms version, basis and expiry'
    USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
     p_evidence_kind||':'||p_evidence_id::text||':'||p_use_scope,0));
  SELECT d.decision_id INTO v_previous
  FROM private.trust_c2g2_rights_decisions d
  WHERE d.evidence_kind=p_evidence_kind AND d.evidence_id=p_evidence_id
    AND d.use_scope=p_use_scope
  ORDER BY d.recorded_at DESC,d.decision_id DESC LIMIT 1;
  IF v_previous IS DISTINCT FROM p_expected_decision_id THEN
    RAISE EXCEPTION 'Decision changed: reopen the source before saving'
      USING ERRCODE='40001';
  END IF;

  INSERT INTO private.trust_c2g2_rights_decisions(
    evidence_kind,evidence_id,use_scope,decision,rights_basis,evidence_url,
    terms_version,attribution_requirements,review_note,reviewed_by,reviewed_at,
    valid_until
  ) VALUES(
    p_evidence_kind,p_evidence_id,p_use_scope,p_decision,
    NULLIF(btrim(coalesce(p_rights_basis,'')),''),
    NULLIF(btrim(coalesce(p_evidence_url,'')),''),
    NULLIF(btrim(coalesce(p_terms_version,'')),''),
    NULLIF(btrim(coalesce(p_attribution_requirements,'')),''),
    btrim(p_review_note),v_actor,now(),p_valid_until
  ) RETURNING decision_id INTO v_new;
  RETURN jsonb_build_object('status','recorded','decision_id',v_new,'scope',p_use_scope,
   'effect','ledger_only_not_product_authorization');
END;
$function$;

REVOKE ALL ON FUNCTION public.trust_c2g3_rights_console(text,text,integer,integer,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.trust_c2g3_rights_console(text,text,integer,integer,uuid,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.trust_c2g3_record_rights_decision(text,uuid,text,text,text,text,text,text,text,timestamptz,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.trust_c2g3_record_rights_decision(text,uuid,text,text,text,text,text,text,text,timestamptz,uuid) TO authenticated;
