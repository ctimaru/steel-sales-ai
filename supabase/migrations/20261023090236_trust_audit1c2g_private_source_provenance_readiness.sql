-- TRUST-AUDIT1C.2G, production ledger 20261023090236. Internal evidence, NOT a license.
CREATE OR REPLACE VIEW private.trust_c2g_source_assessment_queue WITH (security_barrier=true) AS
SELECT a.id AS assessment_id,
    a.entity_kind,
    a.entity_id,
    a.audit_outcome,
    a.source_reuse_rights,
    NULLIF(btrim(COALESCE(a.source_url, ''::text)), ''::text) IS NOT NULL AS has_source_url,
    h.entity_id IS NOT NULL AS has_hold,
    h.hold_reason,
        CASE
            WHEN h.hold_reason = 'rights_review'::text THEN 'rights_hold'::text
            WHEN h.hold_reason IS NOT NULL THEN 'identity_or_other_hold'::text
            WHEN NULLIF(btrim(COALESCE(a.source_url, ''::text)), ''::text) IS NULL THEN 'source_missing'::text
            ELSE 'rights_unverified'::text
        END AS review_lane
   FROM private.netdata1b5_source_assessments a
     LEFT JOIN private.netdata1b5_source_holds h ON h.entity_kind = a.entity_kind AND h.entity_id = a.entity_id;;
REVOKE ALL ON private.trust_c2g_source_assessment_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.trust_c2g_source_assessment_queue TO service_role;

CREATE OR REPLACE VIEW private.trust_c2g_company_provenance_readiness WITH (security_barrier=true) AS
SELECT c.id AS company_id,
    c.publication_status,
    c.verification_status,
    COALESCE(a.assessment_count, 0::bigint)::integer AS assessment_count,
    COALESCE(a.assessments_with_url, 0::bigint)::integer AS assessments_with_url,
    COALESCE(a.rights_not_assessed, 0::bigint)::integer AS rights_not_assessed,
    COALESCE(d.candidate_count, 0::bigint)::integer AS linked_discovery_candidates,
    COALESCE(e.source_evidence_count, 0::bigint)::integer AS canonical_source_evidence_count,
    COALESCE(h.hold_count, 0::bigint)::integer AS hold_count,
        CASE
            WHEN COALESCE(h.hold_count, 0::bigint) > 0 THEN 'hold_review'::text
            WHEN COALESCE(a.assessment_count, 0::bigint) = 0 AND COALESCE(d.candidate_count, 0::bigint) = 0 AND COALESCE(e.source_evidence_count, 0::bigint) = 0 THEN 'source_evidence_missing'::text
            WHEN COALESCE(a.assessment_count, 0::bigint) = 0 THEN 'assessment_missing'::text
            ELSE 'reuse_rights_not_verified'::text
        END AS provenance_gate,
    false AS reuse_rights_cleared
   FROM network_companies c
     LEFT JOIN LATERAL ( SELECT count(*) AS assessment_count,
            count(*) FILTER (WHERE src.source_url IS NOT NULL AND btrim(src.source_url) <> ''::text) AS assessments_with_url,
            count(*) FILTER (WHERE src.source_reuse_rights = 'not_assessed'::text) AS rights_not_assessed
           FROM ( SELECT a_1.id,
                    a_1.source_url,
                    a_1.source_reuse_rights
                   FROM private.netdata1b5_source_assessments a_1
                  WHERE a_1.entity_kind = 'canonical'::text AND a_1.entity_id = c.id
                UNION ALL
                 SELECT a_1.id,
                    a_1.source_url,
                    a_1.source_reuse_rights
                   FROM private.netdata1b5_source_assessments a_1
                     JOIN network_company_discovery_candidates d_1 ON d_1.id = a_1.entity_id AND a_1.entity_kind = 'discovered'::text
                  WHERE d_1.promoted_company_id = c.id OR d_1.match_company_id = c.id) src) a ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS candidate_count
           FROM network_company_discovery_candidates d_1
          WHERE d_1.promoted_company_id = c.id OR d_1.match_company_id = c.id) d ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS source_evidence_count
           FROM private.netconnect2b_canonical_evidence e_1
          WHERE e_1.canonical_company_id = c.id) e ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS hold_count
           FROM private.netdata1b5_source_holds h_1
          WHERE h_1.entity_kind = 'canonical'::text AND h_1.entity_id = c.id OR h_1.entity_kind = 'discovered'::text AND (EXISTS ( SELECT 1
                   FROM network_company_discovery_candidates d_1
                  WHERE d_1.id = h_1.entity_id AND (d_1.promoted_company_id = c.id OR d_1.match_company_id = c.id)))) h ON true;;
REVOKE ALL ON private.trust_c2g_company_provenance_readiness FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.trust_c2g_company_provenance_readiness TO service_role;
