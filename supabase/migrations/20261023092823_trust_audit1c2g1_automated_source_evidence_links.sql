-- TRUST-AUDIT1C.2G.1 — canonical production ledger 20261023092823.
-- Dynamic evidence linking, read-only; observation NEVER equals legal reuse clearance.
-- URLs remain in private schema and must not be logged by CI.
CREATE OR REPLACE VIEW private.trust_c2g1_source_evidence_links WITH (security_barrier=true) AS
SELECT COALESCE(d.promoted_company_id, d.match_company_id) AS company_id,
    'discovery_candidate'::text AS evidence_kind,
    d.id AS evidence_id,
    d.source_url,
    d.created_at AS recorded_at,
    d.governance_status AS candidate_governance,
    r.governance_status AS run_governance,
    r.terms_status AS run_terms,
    r.database_rights_status AS run_database_rights,
    sr.rights_evidence_url,
    'not_cleared'::text AS reuse_clearance
   FROM network_company_discovery_candidates d
     JOIN network_company_discovery_runs r ON r.id = d.run_id
     LEFT JOIN network_discovery_source_registry sr ON r.source_reference = sr.id::text OR r.source_reference = sr.source_url
  WHERE COALESCE(d.promoted_company_id, d.match_company_id) IS NOT NULL
UNION ALL
 SELECT
        CASE
            WHEN a.entity_kind = 'canonical'::text THEN a.entity_id
            ELSE COALESCE(d.promoted_company_id, d.match_company_id)
        END AS company_id,
    'source_assessment'::text AS evidence_kind,
    a.id AS evidence_id,
    a.source_url,
    a.observed_at AS recorded_at,
        CASE
            WHEN a.entity_kind = 'discovered'::text THEN d.governance_status
            ELSE NULL::text
        END AS candidate_governance,
    NULL::text AS run_governance,
    NULL::text AS run_terms,
    a.source_reuse_rights AS run_database_rights,
    NULL::text AS rights_evidence_url,
    'not_cleared'::text AS reuse_clearance
   FROM private.netdata1b5_source_assessments a
     LEFT JOIN network_company_discovery_candidates d ON a.entity_kind = 'discovered'::text AND a.entity_id = d.id
  WHERE a.entity_kind = 'canonical'::text OR a.entity_kind = 'discovered'::text AND COALESCE(d.promoted_company_id, d.match_company_id) IS NOT NULL
UNION ALL
 SELECT a.entity_id AS company_id,
    'data_assertion'::text AS evidence_kind,
    a.id AS evidence_id,
        CASE
            WHEN a.source_reference ~ '^https?://'::text THEN a.source_reference
            ELSE NULL::text
        END AS source_url,
    a.captured_at AS recorded_at,
    NULL::text AS candidate_governance,
    NULL::text AS run_governance,
    NULL::text AS run_terms,
    NULL::text AS run_database_rights,
    NULL::text AS rights_evidence_url,
    'not_cleared'::text AS reuse_clearance
   FROM network_data_assertions a
  WHERE a.entity_type = 'company'::text AND (EXISTS ( SELECT 1
           FROM network_companies c
          WHERE c.id = a.entity_id))
UNION ALL
 SELECT e.canonical_company_id AS company_id,
    'canonical_evidence'::text AS evidence_kind,
    e.source_id AS evidence_id,
    NULL::text AS source_url,
    e.recorded_at,
    NULL::text AS candidate_governance,
    NULL::text AS run_governance,
    NULL::text AS run_terms,
    NULL::text AS run_database_rights,
    NULL::text AS rights_evidence_url,
    'not_cleared'::text AS reuse_clearance
   FROM private.netconnect2b_canonical_evidence e;
REVOKE ALL ON private.trust_c2g1_source_evidence_links FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.trust_c2g1_source_evidence_links TO service_role;

CREATE OR REPLACE VIEW private.trust_c2g1_company_evidence_summary WITH (security_barrier=true) AS
SELECT c.id AS company_id,
    c.publication_status,
    count(e.evidence_id)::integer AS linked_evidence_count,
    count(e.evidence_id) FILTER (WHERE e.evidence_kind = 'source_assessment'::text)::integer AS assessment_evidence_count,
    count(e.evidence_id) FILTER (WHERE e.evidence_kind = 'discovery_candidate'::text)::integer AS discovery_evidence_count,
    count(e.evidence_id) FILTER (WHERE e.evidence_kind = 'data_assertion'::text)::integer AS assertion_evidence_count,
    count(e.evidence_id) FILTER (WHERE e.evidence_kind = 'canonical_evidence'::text)::integer AS canonical_evidence_count,
    count(e.evidence_id) FILTER (WHERE e.evidence_kind = 'discovery_candidate'::text AND e.candidate_governance = 'unreviewed'::text)::integer AS discovery_candidate_governance_gaps,
    count(e.evidence_id) FILTER (WHERE e.evidence_kind = 'discovery_candidate'::text AND (e.run_governance IS DISTINCT FROM 'approved'::text OR (e.run_terms <> ALL (ARRAY['allows_reuse'::text, 'allows_limited_reuse'::text])) OR (e.run_database_rights <> ALL (ARRAY['low_risk'::text, 'licensed'::text]))))::integer AS discovery_run_governance_gaps,
    count(e.evidence_id) FILTER (WHERE e.source_url IS NOT NULL AND btrim(e.source_url) <> ''::text)::integer AS links_with_source_url,
    max(e.recorded_at) AS last_linked_evidence_at,
    COALESCE(h.hold_count, 0::bigint)::integer AS hold_count,
    false AS reuse_rights_cleared,
        CASE
            WHEN COALESCE(h.hold_count, 0::bigint) > 0 THEN 'hold_review'::text
            WHEN count(e.evidence_id) = 0 THEN 'source_link_missing'::text
            WHEN count(e.evidence_id) FILTER (WHERE e.evidence_kind = 'discovery_candidate'::text AND e.candidate_governance = 'unreviewed'::text) > 0 THEN 'candidate_governance_review'::text
            WHEN count(e.evidence_id) FILTER (WHERE e.evidence_kind = 'discovery_candidate'::text AND e.run_governance IS DISTINCT FROM 'approved'::text) > 0 THEN 'run_governance_review'::text
            ELSE 'reuse_rights_review'::text
        END AS next_action
   FROM network_companies c
     LEFT JOIN private.trust_c2g1_source_evidence_links e ON e.company_id = c.id
     LEFT JOIN LATERAL ( SELECT count(*) AS hold_count
           FROM private.netdata1b5_source_holds h_1
          WHERE h_1.entity_kind = 'canonical'::text AND h_1.entity_id = c.id OR h_1.entity_kind = 'discovered'::text AND (EXISTS ( SELECT 1
                   FROM network_company_discovery_candidates d
                  WHERE d.id = h_1.entity_id AND (d.promoted_company_id = c.id OR d.match_company_id = c.id)))) h ON true
  GROUP BY c.id, c.publication_status, h.hold_count;
REVOKE ALL ON private.trust_c2g1_company_evidence_summary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.trust_c2g1_company_evidence_summary TO service_role;
COMMENT ON VIEW private.trust_c2g1_source_evidence_links IS 'Internal provenance links only. No verified licence for redistribution, AI retrieval or paid Network.';
COMMENT ON VIEW private.trust_c2g1_company_evidence_summary IS 'Internal evidence coverage. Every reuse_rights_cleared is FALSE until separate rights evidence review.';
