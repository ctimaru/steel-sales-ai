-- NET-IT-AUTO1: owner-issued, revocable delegation for ALREADY REVIEWED
-- Italian companies only. This migration installs the switch DEFAULT OFF.
-- An automated release is recorded as automated; never impersonates a human
-- reviewer, never changes source/candidate governance status, and never copies
-- contacts, marketing text or private/personal data to public profiles.
--
-- Owner authorization is one-time (30 days suggested) and revocable at any
-- time. The dedicated executor is accessible only from Postgres maintenance,
-- not browser clients, anon, authenticated, or service_role.

CREATE TABLE IF NOT EXISTS private.net_it_auto1_delegation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  expires_at timestamptz,
  daily_cap integer NOT NULL DEFAULT 150 CHECK (daily_cap BETWEEN 1 AND 500),
  scope text NOT NULL DEFAULT 'human_governed_minimal_it'
    CHECK (scope = 'human_governed_minimal_it'),
  policy_revision text NOT NULL DEFAULT 'net-it-auto1-v1',
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.net_it_auto1_delegation (singleton,enabled)
VALUES (true,false) ON CONFLICT (singleton) DO NOTHING;
ALTER TABLE private.net_it_auto1_delegation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.net_it_auto1_delegation FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS private.net_it_auto1_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_kind text NOT NULL CHECK(event_kind IN ('owner_granted','owner_revoked','agent_published')),
  actor_type text NOT NULL CHECK(actor_type IN ('platform_owner','delegated_agent')),
  actor_user_id uuid,
  delegated_by uuid,
  policy_revision text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_auto1_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.net_it_auto1_events FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS private.net_it_auto1_publications (
  candidate_id uuid PRIMARY KEY REFERENCES public.network_company_discovery_candidates(id),
  company_id uuid NOT NULL UNIQUE REFERENCES public.network_companies(id),
  source_run_id uuid NOT NULL REFERENCES public.network_company_discovery_runs(id),
  delegated_by uuid NOT NULL REFERENCES auth.users(id),
  policy_revision text NOT NULL,
  proof_source_url text NOT NULL,
  proof_candidate_reviewed_by uuid NOT NULL,
  proof_source_reviewed_by uuid NOT NULL,
  proof_role_assertion_id uuid NOT NULL REFERENCES public.network_data_assertions(id),
  executed_by_kind text NOT NULL DEFAULT 'delegated_agent'
    CHECK(executed_by_kind='delegated_agent'),
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS net_it_auto1_publications_time
  ON private.net_it_auto1_publications(published_at DESC);
ALTER TABLE private.net_it_auto1_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.net_it_auto1_publications FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.net_it_auto1_set_delegation_impl(
  p_enabled boolean,
  p_daily_cap integer DEFAULT 150,
  p_valid_days integer DEFAULT 30,
  p_attested boolean DEFAULT false,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $agent_grant$
DECLARE
  v_owner uuid := auth.uid();
  v_prev private.net_it_auto1_delegation%rowtype;
  v_new private.net_it_auto1_delegation%rowtype;
BEGIN
  IF v_owner IS NULL OR NOT private.is_platform_superadmin()
    OR NOT private.has_platform_permission('platform.settings.manage')
    OR NOT private.has_platform_permission('discovery.publish') THEN
    RAISE EXCEPTION 'A real authenticated Platform owner must authorize delegation'
      USING ERRCODE='42501';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Delegation choice required' USING ERRCODE='22023';
  END IF;
  IF p_enabled AND (
    p_attested IS DISTINCT FROM true
    OR p_daily_cap NOT BETWEEN 1 AND 500
    OR p_valid_days NOT BETWEEN 1 AND 90
    OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 80 AND 2000
  ) THEN
    RAISE EXCEPTION 'Explicit scoped delegation and an 80+ character policy note required'
      USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_prev FROM private.net_it_auto1_delegation
  WHERE singleton=true FOR UPDATE;

  UPDATE private.net_it_auto1_delegation
  SET enabled=p_enabled,
      approved_by=CASE WHEN p_enabled THEN v_owner ELSE approved_by END,
      approved_at=CASE WHEN p_enabled THEN now() ELSE approved_at END,
      expires_at=CASE WHEN p_enabled THEN now() + make_interval(days=>p_valid_days) ELSE now() END,
      daily_cap=CASE WHEN p_enabled THEN p_daily_cap ELSE daily_cap END,
      note=CASE WHEN p_enabled THEN btrim(p_note) ELSE note END,
      updated_at=now()
  WHERE singleton=true RETURNING * INTO v_new;

  INSERT INTO private.net_it_auto1_events(
    event_kind,actor_type,actor_user_id,delegated_by,policy_revision,details
  ) VALUES (
    CASE WHEN p_enabled THEN 'owner_granted' ELSE 'owner_revoked' END,
    'platform_owner',v_owner,v_owner,'net-it-auto1-v1',
    jsonb_build_object(
      'previous_enabled',coalesce(v_prev.enabled,false),
      'enabled',p_enabled,'scope','human_governed_minimal_it',
      'daily_cap',v_new.daily_cap,'expires_at',v_new.expires_at,
      'note',CASE WHEN p_enabled THEN btrim(p_note) ELSE 'delegation revoked' END
    )
  );
  RETURN jsonb_build_object(
    'contract','net-it-auto1-delegation-v1',
    'enabled',v_new.enabled,'scope',v_new.scope,
    'daily_cap',v_new.daily_cap,'expires_at',v_new.expires_at,
    'delegated_by',v_new.approved_by,
    'human_source_reviews_unchanged',true
  );
END
$agent_grant$;
REVOKE ALL ON FUNCTION private.net_it_auto1_set_delegation_impl(boolean,integer,integer,boolean,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_auto1_set_delegation_impl(boolean,integer,integer,boolean,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.net_it_auto1_set_delegation(
  p_enabled boolean,
  p_daily_cap integer DEFAULT 150,
  p_valid_days integer DEFAULT 30,
  p_attested boolean DEFAULT false,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $agent_public$
  SELECT private.net_it_auto1_set_delegation_impl(
    p_enabled,p_daily_cap,p_valid_days,p_attested,p_note
  );
$agent_public$;
REVOKE ALL ON FUNCTION public.net_it_auto1_set_delegation(boolean,integer,integer,boolean,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_auto1_set_delegation(boolean,integer,integer,boolean,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION private.net_it_auto1_status_impl()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $agent_status$
DECLARE
 v_state private.net_it_auto1_delegation%rowtype;
BEGIN
  PERFORM private.require_platform_permission('discovery.read');
  SELECT * INTO v_state FROM private.net_it_auto1_delegation WHERE singleton=true;
  RETURN jsonb_build_object(
    'contract','net-it-auto1-delegation-v1','enabled',coalesce(v_state.enabled,false),
    'active',coalesce(v_state.enabled,false) AND v_state.expires_at>now(),
    'expires_at',v_state.expires_at,'daily_cap',v_state.daily_cap,
    'scope','human_governed_minimal_it',
    'published_today',(
      SELECT count(*) FROM private.net_it_auto1_publications p
      WHERE (p.published_at AT TIME ZONE 'Europe/Rome')::date
            = (now() AT TIME ZONE 'Europe/Rome')::date
    ),
    'published_all',(
      SELECT count(*) FROM private.net_it_auto1_publications
    ),
    'human_review_required_for_unapproved',true
  );
END
$agent_status$;
REVOKE ALL ON FUNCTION private.net_it_auto1_status_impl() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_auto1_status_impl() TO authenticated;
CREATE OR REPLACE FUNCTION public.net_it_auto1_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $agent_public$
  SELECT private.net_it_auto1_status_impl();
$agent_public$;
REVOKE ALL ON FUNCTION public.net_it_auto1_status() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_auto1_status() TO authenticated;

-- Only the trusted scheduled database executor can invoke this method.
-- Service role cannot call it through PostgREST; owner web sessions cannot
-- invoke it. auth.uid must be absent. This is an independent kill switch,
-- not a temporary activation of the historical minimal publisher.
CREATE OR REPLACE FUNCTION private.net_it_auto1_release(
  p_max integer DEFAULT 50,
  p_dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $agent_release$
DECLARE
  v_policy private.net_it_auto1_delegation%rowtype;
  v_item record;
  v_src public.network_company_discovery_runs%rowtype;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_role_id uuid;
  v_role_key text;
  v_company_id uuid;
  v_assertion_id uuid;
  v_published integer := 0;
  v_attempted integer := 0;
  v_skipped integer := 0;
  v_daily integer;
  v_limit integer;
  v_existing boolean;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Maintenance database identity required; client sessions forbidden'
      USING ERRCODE='42501';
  END IF;
  IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 100
    OR p_dry_run IS NULL THEN
    RAISE EXCEPTION 'Invalid bounded agent batch' USING ERRCODE='22023';
  END IF;

  -- Independent grant and hard publication lock, serialized with manual path.
  PERFORM pg_catalog.pg_advisory_xact_lock(810021,20262);
  SELECT * INTO v_policy FROM private.net_it_auto1_delegation
    WHERE singleton=true FOR UPDATE;
  SELECT count(*) INTO v_daily FROM private.net_it_auto1_publications p
    WHERE (p.published_at AT TIME ZONE 'Europe/Rome')::date
      = (now() AT TIME ZONE 'Europe/Rome')::date;

  IF NOT coalesce(v_policy.enabled,false) OR v_policy.expires_at IS NULL
    OR v_policy.expires_at<=now() THEN
    RETURN jsonb_build_object(
      'contract','net-it-auto1-release-v1','status','delegation_disabled',
      'published',0,'daily_published',v_daily
    );
  END IF;
  v_limit := LEAST(p_max,100,GREATEST(0,v_policy.daily_cap-v_daily));
  IF v_limit=0 THEN
    RETURN jsonb_build_object(
      'contract','net-it-auto1-release-v1','status','daily_limit_reached',
      'published',0,'daily_published',v_daily
    );
  END IF;

  -- Select at most v_limit already governed candidates. NO approval of sources
  -- or companies is written by this executor. Never infer rights from visibility.
  FOR v_item IN
    SELECT c.id
    FROM public.network_company_discovery_candidates c
    JOIN public.network_company_discovery_runs r ON r.id=c.run_id
    WHERE c.country_code='IT' AND c.review_status='pending_review'
      AND c.governance_status='approved_company_data'
      AND c.governance_reviewed_by IS NOT NULL
      AND c.governance_reviewed_at IS NOT NULL
      AND r.governance_status='approved'
      AND r.governance_reviewed_by IS NOT NULL
      AND r.governance_reviewed_at IS NOT NULL
      AND r.terms_status IN ('allows_reuse','allows_limited_reuse')
      AND r.database_rights_status IN ('low_risk','licensed')
      AND r.personal_data_policy IN ('company_data_only','exclude_personal_data')
      AND NOT c.personal_data_detected AND cardinality(c.personal_data_fields)=0
      AND cardinality(c.quality_flags)=0
      AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL
      AND (private.net_pipeline1b2_eligibility(c.id)->>'eligible')::boolean IS TRUE
    ORDER BY c.created_at,c.id LIMIT v_limit
    FOR UPDATE OF c SKIP LOCKED
  LOOP
    v_attempted := v_attempted+1;
    SELECT * INTO v_candidate
      FROM public.network_company_discovery_candidates WHERE id=v_item.id;
    SELECT * INTO v_src FROM public.network_company_discovery_runs
      WHERE id=v_candidate.run_id FOR SHARE;

    -- Re-evaluate everything after locks and before any publication, including
    -- source status and existing company identity, not merely eligibility().
    SELECT EXISTS(
      SELECT 1 FROM public.network_companies n
      WHERE lower(btrim(n.website_domain))=lower(btrim(v_candidate.canonical_domain))
         OR (v_candidate.vat_id IS NOT NULL AND n.vat_id=v_candidate.vat_id)
         OR (n.country_code='IT' AND lower(btrim(n.legal_name))
           = lower(btrim(v_candidate.legal_name)))
    ) INTO v_existing;
    IF v_candidate.review_status<>'pending_review'
      OR v_candidate.governance_status<>'approved_company_data'
      OR v_candidate.governance_reviewed_by IS NULL
      OR v_candidate.governance_reviewed_at IS NULL
      OR v_src.governance_status<>'approved'
      OR v_src.governance_reviewed_by IS NULL
      OR v_src.governance_reviewed_at IS NULL
      OR v_src.terms_status NOT IN ('allows_reuse','allows_limited_reuse')
      OR v_src.database_rights_status NOT IN ('low_risk','licensed')
      OR v_src.personal_data_policy NOT IN ('company_data_only','exclude_personal_data')
      OR cardinality(v_candidate.quality_flags)>0
      OR v_candidate.personal_data_detected
      OR cardinality(v_candidate.personal_data_fields)>0
      OR v_candidate.match_company_id IS NOT NULL
      OR v_candidate.promoted_company_id IS NOT NULL
      OR v_existing
      OR EXISTS(SELECT 1 FROM private.net_pipeline1b2_publication_ledger l
                WHERE l.candidate_id=v_candidate.id)
      OR EXISTS(SELECT 1 FROM public.network_netfast3_suppressed_domains s
                WHERE s.domain=lower(btrim(v_candidate.canonical_domain)))
      OR (private.net_pipeline1b2_eligibility(v_candidate.id)->>'eligible')::boolean IS DISTINCT FROM true
    THEN
      v_skipped:=v_skipped+1;
      CONTINUE;
    END IF;

    SELECT role.id,role.canonical_key INTO v_role_id,v_role_key
    FROM public.network_company_roles role
    WHERE role.canonical_key=ANY(v_candidate.role_keys)
      AND role.status='active' AND role.searchable=true
    ORDER BY array_position(v_candidate.role_keys,role.canonical_key)
    LIMIT 1;
    IF v_role_id IS NULL THEN
      v_skipped:=v_skipped+1;
      CONTINUE;
    END IF;

    IF p_dry_run THEN
      v_results:=v_results||jsonb_build_array(
        jsonb_build_object('candidate_id',v_candidate.id,'status','eligible_dry_run'));
      CONTINUE;
    END IF;

    INSERT INTO public.network_companies(
      legal_name,country_code,website_url,website_domain,
      publication_status,claimed_status,verification_status
    ) VALUES (
      btrim(v_candidate.legal_name),'IT',v_candidate.website_url,
      lower(btrim(v_candidate.canonical_domain)),
      'published','unclaimed','unverified'
    ) RETURNING id INTO v_company_id;

    INSERT INTO private.net_pipeline1b2_publication_ledger(
      candidate_id,company_id,source_url,source_domain,classification,executed_by
    ) VALUES (
      v_candidate.id,v_company_id,v_candidate.source_url,
      lower(btrim(v_candidate.canonical_domain)),'minimal_unverified',NULL
    );

    INSERT INTO public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,
      source_type,source_reference,ownership_type,asserted_by,
      confidence,review_state
    ) VALUES (
      'company',v_company_id,'industrial_role_observed',
      jsonb_build_object(
        'role_key',v_role_key,'source_url',v_candidate.source_url,
        'origin','delegated_agent','policy','human_governed_minimal_it',
        'role_confirmed_by_company',false,'company_verified',false,
        'tube_procurement_confirmed',false
      ),
      'public_web',v_candidate.source_url,'platform_curated',NULL,0.50,'accepted'
    ) RETURNING id INTO v_assertion_id;

    INSERT INTO public.network_company_role_assignments(
      company_id,role_id,is_primary,source_assertion_id
    ) VALUES (v_company_id,v_role_id,true,v_assertion_id);

    UPDATE public.network_company_discovery_candidates
      SET review_status='published',promoted_company_id=v_company_id,
          reviewed_by=NULL,reviewed_at=now(),
          review_note='NET-IT-AUTO1: automated publication under revocable Platform owner delegation; source and identity previously approved by human reviewers.'
    WHERE id=v_candidate.id;

    INSERT INTO private.net_it_auto1_publications(
      candidate_id,company_id,source_run_id,delegated_by,policy_revision,
      proof_source_url,proof_candidate_reviewed_by,proof_source_reviewed_by,
      proof_role_assertion_id
    ) VALUES (
      v_candidate.id,v_company_id,v_candidate.run_id,v_policy.approved_by,
      'net-it-auto1-v1',v_candidate.source_url,
      v_candidate.governance_reviewed_by,v_src.governance_reviewed_by,
      v_assertion_id
    );
    v_published:=v_published+1;
    v_results:=v_results||jsonb_build_array(
      jsonb_build_object('company_id',v_company_id,'candidate_id',v_candidate.id)
    );
  END LOOP;

  IF NOT p_dry_run AND v_published>0 THEN
    INSERT INTO private.net_it_auto1_events(
      event_kind,actor_type,actor_user_id,delegated_by,policy_revision,details
    ) VALUES (
      'agent_published','delegated_agent',NULL,v_policy.approved_by,'net-it-auto1-v1',
      jsonb_build_object(
        'published_count',v_published,'daily_cap',v_policy.daily_cap,
        'candidate_company_ids',v_results
      )
    );
  END IF;
  RETURN jsonb_build_object(
    'contract','net-it-auto1-release-v1',
    'status',CASE WHEN p_dry_run THEN 'dry_run' ELSE 'published' END,
    'requested',p_max,'examined',v_attempted,'skipped',v_skipped,
    'published',v_published,'daily_published',v_daily+v_published,
    'daily_cap',v_policy.daily_cap,
    'results',v_results,
    'original_publisher_default_off',(
      SELECT enabled IS FALSE FROM private.net_pipeline1b2_settings WHERE singleton=true
    )
  );
END
$agent_release$;
REVOKE ALL ON FUNCTION private.net_it_auto1_release(integer,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
-- postgres, the trusted owner of the SQL maintenance endpoint, owns this
-- function and does not need a browser/session/credential impersonation.
