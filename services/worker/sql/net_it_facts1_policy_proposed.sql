-- NET-IT-CARP1.E.2 / FACTS1 — PROPOSAL ONLY; never execute directly on production.
-- Legal opinion and authenticated Platform signoff are MISSING, so the default is OFF.
-- This is an audit-gated factual-metadata policy, NOT a claim of copyright licence.
-- Keep this alongside net_it_releasebulk1_proposed.sql until protected release.
CREATE TABLE IF NOT EXISTS private.netit_facts1_policy (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    enabled boolean NOT NULL DEFAULT false,
    legal_review_url text,
    legal_review_note text,
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamptz,
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT netit_facts1_valid_approval CHECK (
      NOT enabled OR (
        approved_by IS NOT NULL AND approved_at IS NOT NULL
        AND legal_review_url ~ '^https://[^[:space:]]+$'
        AND length(btrim(legal_review_note)) BETWEEN 80 AND 2000
      )
    )
);
ALTER TABLE private.netit_facts1_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.netit_facts1_policy FROM PUBLIC, anon, authenticated;
INSERT INTO private.netit_facts1_policy(singleton,enabled)
VALUES (true,false) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS private.netit_facts1_signoff_ledger (
    revision bigint PRIMARY KEY CHECK (revision > 0),
    actor uuid NOT NULL REFERENCES auth.users(id),
    enabled boolean NOT NULL,
    legal_review_url text,
    review_note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.netit_facts1_signoff_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.netit_facts1_signoff_ledger FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.netit_facts1_signoff_impl(
    p_approve boolean, p_legal_review_url text, p_review_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $facts1$
DECLARE
    v_actor uuid := auth.uid();
    v_revision bigint;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authenticated Platform reviewer required' USING ERRCODE='42501';
    END IF;
    PERFORM private.require_platform_permission('network.privacy_governance_review');
    PERFORM private.require_platform_permission('discovery.governance_review');
    PERFORM private.require_platform_permission('discovery.publish');
    IF p_approve IS NULL THEN
        RAISE EXCEPTION 'Explicit legal decision required' USING ERRCODE='22023';
    END IF;
    IF p_approve THEN
        IF p_legal_review_url IS NULL OR p_legal_review_url !~ '^https://[^[:space:]]+$'
           OR length(btrim(coalesce(p_review_note,''))) NOT BETWEEN 80 AND 2000 THEN
            RAISE EXCEPTION 'Dated legal review evidence and detailed scope required' USING ERRCODE='22023';
        END IF;
    ELSIF length(btrim(coalesce(p_review_note,''))) NOT BETWEEN 40 AND 2000 THEN
        RAISE EXCEPTION 'Documented revocation rationale required' USING ERRCODE='22023';
    END IF;
    -- Same advisory lock as RELEASEBULK1: a revocation cannot race a commit.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext('NET-IT-RELEASEBULK1')
    );
    UPDATE private.netit_facts1_policy
       SET enabled=p_approve,
           legal_review_url=CASE WHEN p_approve THEN p_legal_review_url ELSE NULL END,
           legal_review_note=p_review_note,
           approved_by=CASE WHEN p_approve THEN v_actor ELSE NULL END,
           approved_at=CASE WHEN p_approve THEN now() ELSE NULL END,
           revision=revision+1,
           updated_at=now()
     WHERE singleton=true
     RETURNING revision INTO v_revision;
    IF v_revision IS NULL THEN
        RAISE EXCEPTION 'FACTS1 policy is not initialized';
    END IF;
    INSERT INTO private.netit_facts1_signoff_ledger(
       revision,actor,enabled,legal_review_url,review_note
    ) VALUES (v_revision,v_actor,p_approve,p_legal_review_url,p_review_note);
    RETURN pg_catalog.jsonb_build_object(
       'policy','factual_metadata_only_reviewed',
       'enabled',p_approve,'revision',v_revision,
       'reviewed_by',v_actor
    );
END;
$facts1$;

REVOKE ALL ON FUNCTION private.netit_facts1_signoff_impl(boolean,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.netit_facts1_signoff_impl(boolean,text,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.netit_facts1_signoff(
    p_approve boolean, p_legal_review_url text, p_review_note text
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER
SET search_path TO ''
AS $facts1_wrapper$
  SELECT private.netit_facts1_signoff_impl(
      p_approve,p_legal_review_url,p_review_note
  );
$facts1_wrapper$;

REVOKE ALL ON FUNCTION public.netit_facts1_signoff(boolean,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.netit_facts1_signoff(boolean,text,text)
  TO authenticated;
