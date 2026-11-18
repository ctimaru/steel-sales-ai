-- Portable baseline for the RO first-party evidence register installed on
-- production 2026-11-18. Keep this migration in Git for clean environments;
-- never reset or re-import the production register.
CREATE TABLE IF NOT EXISTS private.net_ro1_domain_verification_evidence (
  seed_id uuid PRIMARY KEY
    REFERENCES private.network_web_research_seeds(id) ON DELETE RESTRICT,
  canonical_domain text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  official_url text,
  source_kind text NOT NULL,
  identity_evidence text,
  role_evidence text,
  romania_evidence text,
  verdict text NOT NULL CHECK (verdict IN (
    'evidence_supported_pending_gates',
    'insufficient_evidence','scope_mismatch',
    'source_unreachable','duplicate_possible'
  )),
  reason text NOT NULL,
  provenance_checked boolean NOT NULL DEFAULT false,
  rights_checked boolean NOT NULL DEFAULT false,
  permissions_checked boolean NOT NULL DEFAULT false,
  publisher_dry_run_passed boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  CONSTRAINT net_ro1_base_publish_guard CHECK (
    NOT published OR
    (provenance_checked AND rights_checked
     AND permissions_checked AND publisher_dry_run_passed)
  )
);
ALTER TABLE private.net_ro1_domain_verification_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_ro1_domain_verification_evidence
  FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.net_ro1_domain_verification_evidence
  TO service_role;
COMMENT ON TABLE private.net_ro1_domain_verification_evidence IS
  'Private RO first-party research evidence; a favorable verdict alone is not a publication authorization.';
