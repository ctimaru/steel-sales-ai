-- TRUST-AUDIT1C.2G, production ledger 20261023090328. Preserve every rights/identity hold.
CREATE OR REPLACE VIEW private.trust_c2g_source_hold_queue WITH (security_barrier=true) AS
SELECT entity_kind,
    entity_id,
    hold_reason,
    (EXISTS ( SELECT 1
           FROM private.netdata1b5_source_assessments a
          WHERE a.entity_kind = h.entity_kind AND a.entity_id = h.entity_id)) AS has_assessment,
    (EXISTS ( SELECT 1
           FROM network_company_discovery_candidates d
          WHERE h.entity_kind = 'discovered'::text AND d.id = h.entity_id)) AS has_discovery_candidate,
    ( SELECT count(*) AS count
           FROM network_company_discovery_candidates d
          WHERE h.entity_kind = 'discovered'::text AND d.id = h.entity_id AND (d.promoted_company_id IS NOT NULL OR d.match_company_id IS NOT NULL)) AS linked_company_paths
   FROM private.netdata1b5_source_holds h;;
REVOKE ALL ON private.trust_c2g_source_hold_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.trust_c2g_source_hold_queue TO service_role;
