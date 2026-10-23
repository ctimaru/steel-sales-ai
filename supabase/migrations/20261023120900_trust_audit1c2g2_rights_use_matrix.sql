-- TRUST-AUDIT1C.2G.2: purpose-specific rights decision ledger & advisory matrix.
-- Empty initially: no rights are inferred from public URLs or approved crawler runs.
-- Permissions are NOT wired to a public endpoint or the product's AI/Network authorization.

CREATE TABLE IF NOT EXISTS private.trust_c2g2_rights_decisions (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_kind text NOT NULL CHECK(evidence_kind IN('discovery_candidate','source_assessment','data_assertion','canonical_evidence')),
  evidence_id uuid NOT NULL,
  use_scope text NOT NULL CHECK(use_scope IN('discovery','factual_profile','excerpt_republication','ai_retrieval','ai_training','bulk_redistribution','paid_network')),
  decision text NOT NULL CHECK(decision IN('needs_review','allowed','limited','blocked','revoked')),
  rights_basis text CHECK(rights_basis IN('explicit_permission','open_license','first_party_submission','counsel_approved')),
  evidence_url text CHECK(evidence_url IS NULL OR evidence_url ~ '^https://[^ ]+$'),
  terms_version text,
  attribution_requirements text,
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  effective_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trust_c2g2_valid_window CHECK (valid_until IS NULL OR valid_until>effective_from),
  CONSTRAINT trust_c2g2_explicit_grant CHECK(
    decision NOT IN ('allowed','limited') OR
    (rights_basis IS NOT NULL AND evidence_url IS NOT NULL
     AND length(btrim(evidence_url))>12
     AND nullif(btrim(coalesce(terms_version,'')),'') IS NOT NULL
     AND nullif(btrim(coalesce(review_note,'')),'') IS NOT NULL
     AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS trust_c2g2_rights_latest_idx
 ON private.trust_c2g2_rights_decisions(evidence_kind,evidence_id,use_scope,recorded_at DESC,decision_id DESC);
ALTER TABLE private.trust_c2g2_rights_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.trust_c2g2_rights_decisions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON private.trust_c2g2_rights_decisions TO service_role;

CREATE OR REPLACE FUNCTION private.trust_c2g2_decision_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP<>'INSERT' THEN
    RAISE EXCEPTION 'Rights decision ledger is append-only' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM private.trust_c2g1_source_evidence_links l
    WHERE l.evidence_kind=NEW.evidence_kind AND l.evidence_id=NEW.evidence_id
  ) THEN
    RAISE EXCEPTION 'Rights decision lacks a linked source evidence record'
      USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.trust_c2g2_decision_integrity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trust_c2g2_decision_guard ON private.trust_c2g2_rights_decisions;
CREATE TRIGGER trust_c2g2_decision_guard BEFORE INSERT OR UPDATE OR DELETE ON private.trust_c2g2_rights_decisions FOR EACH ROW EXECUTE FUNCTION private.trust_c2g2_decision_integrity();
CREATE OR REPLACE VIEW private.trust_c2g2_evidence_use_matrix WITH (security_barrier=true) AS
SELECT l.company_id,
    l.evidence_kind,
    l.evidence_id,
    s.use_scope,
        CASE
            WHEN (d.decision = ANY (ARRAY['allowed'::text, 'limited'::text])) AND d.valid_until <= now() THEN 'expired'::text
            WHEN (d.decision = ANY (ARRAY['allowed'::text, 'limited'::text])) AND d.effective_from > now() THEN 'not_yet_effective'::text
            ELSE COALESCE(d.decision, 'not_assessed'::text)
        END AS effective_rights_state,
    d.rights_basis,
    d.decision_id,
    d.reviewed_at,
    d.valid_until,
    d.decision_id IS NOT NULL AS has_recorded_decision
   FROM private.trust_c2g1_source_evidence_links l
     CROSS JOIN ( VALUES ('discovery'::text), ('factual_profile'::text), ('excerpt_republication'::text), ('ai_retrieval'::text), ('ai_training'::text), ('bulk_redistribution'::text), ('paid_network'::text)) s(use_scope)
     LEFT JOIN LATERAL ( SELECT a.decision_id,
            a.decision,
            a.rights_basis,
            a.reviewed_at,
            a.effective_from,
            a.valid_until
           FROM private.trust_c2g2_rights_decisions a
          WHERE a.evidence_kind = l.evidence_kind AND a.evidence_id = l.evidence_id AND a.use_scope = s.use_scope
          ORDER BY a.recorded_at DESC, a.decision_id DESC
         LIMIT 1) d ON true;
REVOKE ALL ON private.trust_c2g2_evidence_use_matrix FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON private.trust_c2g2_evidence_use_matrix TO service_role;

CREATE OR REPLACE VIEW private.trust_c2g2_company_allowed_use_matrix WITH (security_barrier=true) AS
SELECT c.company_id,
    c.publication_status,
    s.use_scope,
    c.linked_evidence_count,
    c.hold_count,
    COALESCE(agg.reviewed, 0::bigint)::integer AS reviewed_links,
    COALESCE(agg.allowed, 0::bigint)::integer AS allowed_links,
    COALESCE(agg.limited, 0::bigint)::integer AS limited_links,
    COALESCE(agg.blocked, 0::bigint)::integer AS blocked_links,
        CASE
            WHEN c.hold_count > 0 THEN 'hold_review'::text
            WHEN c.linked_evidence_count = 0 THEN 'no_evidence'::text
            WHEN COALESCE(agg.blocked, 0::bigint) > 0 THEN 'blocked'::text
            WHEN COALESCE(agg.reviewed, 0::bigint) < c.linked_evidence_count THEN 'not_assessed'::text
            WHEN COALESCE(agg.unresolved, 0::bigint) > 0 THEN 'needs_review'::text
            WHEN COALESCE(agg.limited, 0::bigint) > 0 THEN 'limited'::text
            WHEN COALESCE(agg.allowed, 0::bigint) = c.linked_evidence_count THEN 'allowed'::text
            ELSE 'needs_review'::text
        END AS company_use_state
   FROM private.trust_c2g1_company_evidence_summary c
     CROSS JOIN ( VALUES ('discovery'::text), ('factual_profile'::text), ('excerpt_republication'::text), ('ai_retrieval'::text), ('ai_training'::text), ('bulk_redistribution'::text), ('paid_network'::text)) s(use_scope)
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE m.has_recorded_decision) AS reviewed,
            count(*) FILTER (WHERE m.effective_rights_state = 'allowed'::text) AS allowed,
            count(*) FILTER (WHERE m.effective_rights_state = 'limited'::text) AS limited,
            count(*) FILTER (WHERE m.effective_rights_state = 'blocked'::text) AS blocked,
            count(*) FILTER (WHERE m.effective_rights_state <> ALL (ARRAY['allowed'::text, 'limited'::text, 'blocked'::text])) AS unresolved
           FROM private.trust_c2g2_evidence_use_matrix m
          WHERE m.company_id = c.company_id AND m.use_scope = s.use_scope) agg ON true;
REVOKE ALL ON private.trust_c2g2_company_allowed_use_matrix FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON private.trust_c2g2_company_allowed_use_matrix TO service_role;
COMMENT ON TABLE private.trust_c2g2_rights_decisions IS 'Append-only, purpose-scoped and evidence-reviewed rights decisions; no automatic permission.';
COMMENT ON VIEW private.trust_c2g2_company_allowed_use_matrix IS 'Advisory rights coverage. NOT enforced by public/AI endpoints without separate integration and acceptance.';
