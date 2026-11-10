-- NET-IT-AUTO3: independently delegated, revocable publication of FACTUAL
-- minimal Italian corporate profiles after recent first-party machine evidence.
-- NOT a license grant or human source approval. Explicit owner choice required.
-- No marketing copy, images, contacts or descriptions are published.
-- Depends on NET-IT-AUTO1 publication_actor_type; NET-IT-AUTO2 evidence.

CREATE TABLE IF NOT EXISTS private.net_it_auto3_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 authorized_by uuid REFERENCES auth.users(id),
 authorized_at timestamptz,
 expires_at timestamptz,
 daily_cap integer NOT NULL DEFAULT 100 CHECK(daily_cap BETWEEN 1 AND 300),
 policy text NOT NULL DEFAULT 'first_party_minimal_facts_only_v1'
   CHECK(policy='first_party_minimal_facts_only_v1'),
 owner_note text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.net_it_auto3_policy(singleton,enabled)
VALUES(true,false) ON CONFLICT(singleton) DO NOTHING;
ALTER TABLE private.net_it_auto3_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_auto3_policy FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS private.net_it_auto3_publications (
 candidate_id uuid PRIMARY KEY REFERENCES public.network_company_discovery_candidates(id),
 company_id uuid NOT NULL UNIQUE REFERENCES public.network_companies(id),
 evidence_id uuid NOT NULL REFERENCES private.net_it_auto2_evidence(id),
 authorized_by uuid NOT NULL REFERENCES auth.users(id),
 actor_type text NOT NULL DEFAULT 'delegated_agent' CHECK(actor_type='delegated_agent'),
 policy text NOT NULL DEFAULT 'first_party_minimal_facts_only_v1',
 published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS net_it_auto3_publications_time
 ON private.net_it_auto3_publications(published_at DESC);
ALTER TABLE private.net_it_auto3_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_auto3_publications FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS private.net_it_auto3_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_kind text NOT NULL CHECK(event_kind IN ('owner_grant','owner_revoke','agent_release')),
 actor_type text NOT NULL CHECK(actor_type IN ('platform_owner','delegated_agent')),
 actor_user_id uuid,
 policy text NOT NULL DEFAULT 'first_party_minimal_facts_only_v1',
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.net_it_auto3_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.net_it_auto3_events FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.net_it_auto3_set_policy_impl(
 p_enabled boolean,
 p_daily_cap integer DEFAULT 100,
 p_valid_days integer DEFAULT 30,
 p_attested boolean DEFAULT false,
 p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $grant$
DECLARE
 v_actor uuid := auth.uid();
 v_policy private.net_it_auto3_policy%rowtype;
BEGIN
 IF v_actor IS NULL OR NOT private.is_platform_superadmin()
   OR NOT private.has_platform_permission('platform.settings.manage')
   OR NOT private.has_platform_permission('discovery.publish') THEN
  RAISE EXCEPTION 'Only a real Platform Owner can authorize agent-sourced factual publications'
    USING ERRCODE='42501';
 END IF;
 IF p_enabled IS NULL THEN
  RAISE EXCEPTION 'Explicit choice required' USING ERRCODE='22023';
 END IF;
 IF p_enabled AND (
  p_attested IS DISTINCT FROM true
  OR p_daily_cap NOT BETWEEN 1 AND 300
  OR p_valid_days NOT BETWEEN 1 AND 90
  OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 100 AND 2000
 ) THEN
  RAISE EXCEPTION 'Factual-only policy requires explicit authorization, quota and meaningful note'
    USING ERRCODE='42501';
 END IF;

 UPDATE private.net_it_auto3_policy
 SET enabled=p_enabled,
 authorized_by=CASE WHEN p_enabled THEN v_actor ELSE authorized_by END,
 authorized_at=CASE WHEN p_enabled THEN now() ELSE authorized_at END,
 expires_at=CASE WHEN p_enabled THEN now()+make_interval(days=>p_valid_days) ELSE now() END,
 daily_cap=CASE WHEN p_enabled THEN p_daily_cap ELSE daily_cap END,
 owner_note=CASE WHEN p_enabled THEN btrim(p_note) ELSE owner_note END,
 updated_at=now()
 WHERE singleton=true RETURNING * INTO v_policy;

 INSERT INTO private.net_it_auto3_events(event_kind,actor_type,actor_user_id,details)
 VALUES(
  CASE WHEN p_enabled THEN 'owner_grant' ELSE 'owner_revoke' END,
  'platform_owner',v_actor,
  jsonb_build_object('enabled',p_enabled,'daily_cap',v_policy.daily_cap,
   'expires_at',v_policy.expires_at,'factual_scope',v_policy.policy,
   'unknown_website_rights_are_not_claimed_approved',true,
   'no_personal_data_or_copied_content',true)
 );
 RETURN jsonb_build_object('contract','net-it-auto3-policy-v1',
  'enabled',v_policy.enabled,'scope',v_policy.policy,
  'expires_at',v_policy.expires_at,'daily_cap',v_policy.daily_cap,
  'owner',v_policy.authorized_by,
  'human_governance_unchanged',true);
END
$grant$;
REVOKE ALL ON FUNCTION private.net_it_auto3_set_policy_impl(boolean,integer,integer,boolean,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_auto3_set_policy_impl(boolean,integer,integer,boolean,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.net_it_auto3_set_policy(
 p_enabled boolean,p_daily_cap integer DEFAULT 100,p_valid_days integer DEFAULT 30,
 p_attested boolean DEFAULT false,p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $grant$
 SELECT private.net_it_auto3_set_policy_impl(p_enabled,p_daily_cap,p_valid_days,p_attested,p_note);
$grant$;
REVOKE ALL ON FUNCTION public.net_it_auto3_set_policy(boolean,integer,integer,boolean,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_auto3_set_policy(boolean,integer,integer,boolean,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION private.net_it_auto3_status_impl()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $status$
DECLARE v private.net_it_auto3_policy%rowtype;
BEGIN
 PERFORM private.require_platform_permission('discovery.read');
 SELECT * INTO v FROM private.net_it_auto3_policy WHERE singleton=true;
 RETURN jsonb_build_object(
  'contract','net-it-auto3-policy-v1','enabled',coalesce(v.enabled,false),
  'active',coalesce(v.enabled,false) AND v.expires_at>now(),
  'daily_cap',v.daily_cap,'expires_at',v.expires_at,
  'published_today',(SELECT count(*) FROM private.net_it_auto3_publications
    WHERE (published_at AT TIME ZONE 'Europe/Rome')::date
          = (now() AT TIME ZONE 'Europe/Rome')::date),
  'published_total',(SELECT count(*) FROM private.net_it_auto3_publications),
  'publisher_policy','first_party_minimal_facts_only_v1',
  'human_source_governance_modified',false
 );
END
$status$;
REVOKE ALL ON FUNCTION private.net_it_auto3_status_impl()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.net_it_auto3_status_impl() TO authenticated;
CREATE OR REPLACE FUNCTION public.net_it_auto3_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $status$ SELECT private.net_it_auto3_status_impl(); $status$;
REVOKE ALL ON FUNCTION public.net_it_auto3_status()
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.net_it_auto3_status() TO authenticated;

CREATE OR REPLACE FUNCTION private.net_it_auto3_release(
 p_max integer DEFAULT 50,p_dry_run boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $agent$
DECLARE
 v_policy private.net_it_auto3_policy%rowtype;
 v_daily integer;
 v_limit integer;
 v_item record;
 v_candidate public.network_company_discovery_candidates%rowtype;
 v_evidence private.net_it_auto2_evidence%rowtype;
 v_role uuid;
 v_role_key text;
 v_company uuid;
 v_assertion uuid;
 v_collision boolean;
 v_published integer := 0;
 v_reviewed integer := 0;
 v_results jsonb := '[]'::jsonb;
BEGIN
 IF session_user<>'postgres' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'Maintenance-only agent; no service JWT/browser impersonation'
    USING ERRCODE='42501';
 END IF;
 IF p_max IS NULL OR p_max NOT BETWEEN 1 AND 100 OR p_dry_run IS NULL THEN
  RAISE EXCEPTION 'Only bounded agent runs are accepted' USING ERRCODE='22023';
 END IF;

 -- Shared lock with human publisher and AUTO1 to prevent duplicate releases.
 PERFORM pg_catalog.pg_advisory_xact_lock(810021,20262);
 LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO v_policy FROM private.net_it_auto3_policy
  WHERE singleton=true FOR UPDATE;
 SELECT count(*) INTO v_daily FROM private.net_it_auto3_publications
 WHERE (published_at AT TIME ZONE 'Europe/Rome')::date
    = (now() AT TIME ZONE 'Europe/Rome')::date;

 IF NOT coalesce(v_policy.enabled,false) OR v_policy.expires_at IS NULL
    OR v_policy.expires_at<=now() THEN
  RETURN jsonb_build_object('contract','net-it-auto3-release-v1',
    'status','delegation_disabled','published',0,'daily_published',v_daily);
 END IF;
 v_limit:=LEAST(p_max,100,GREATEST(0,v_policy.daily_cap-v_daily));
 IF v_limit=0 THEN
  RETURN jsonb_build_object('contract','net-it-auto3-release-v1',
   'status','daily_limit_reached','published',0,'daily_published',v_daily);
 END IF;

 FOR v_item IN
  SELECT c.id,e.id AS evidence_id
  FROM public.network_company_discovery_candidates c
  JOIN public.network_company_discovery_runs r ON r.id=c.run_id
  JOIN LATERAL (
    SELECT * FROM private.net_it_auto2_evidence x
    WHERE x.candidate_id=c.id ORDER BY x.reviewed_at DESC,x.id DESC LIMIT 1
  ) e ON true
  WHERE c.country_code='IT' AND c.review_status='pending_review'
    AND c.governance_status='unreviewed'
    AND r.governance_status='unreviewed'
    AND r.terms_status IN ('not_checked','unknown')
    AND r.database_rights_status IN ('not_assessed','unknown')
    AND c.source_url ~* '^https://'
    AND c.website_url ~* '^https://'
    AND e.verdict='identity_supported'
    AND e.reviewed_at>=now()-interval '3 days'
    AND e.reviewer_version='net-it-auto2-firstparty-v1'
    AND e.observed_domain=lower(btrim(c.canonical_domain))
    AND e.matched_company_name AND e.identity_confidence>=0.94
    AND e.source_rights_state='unknown'
    AND e.page_evidence_hash ~ '^[a-f0-9]{64}$'
    AND lower(split_part(split_part(e.company_page_url,'/',3),':',1))
      IN (lower(btrim(c.canonical_domain)),'www.'||lower(btrim(c.canonical_domain)))
    AND c.quality_flags <@ ARRAY['product_scope_not_verified','province_area_to_verify']::text[]
    AND NOT c.personal_data_detected
    AND cardinality(c.personal_data_fields)=0
    AND c.match_company_id IS NULL AND c.promoted_company_id IS NULL
    AND c.match_signals='[]'::jsonb
    AND lower(c.legal_name) NOT LIKE '% di %'
    AND c.legal_name ~* '(s[.]?[[:space:]]*r[.]?[[:space:]]*l[.]?|s[.]?[[:space:]]*p[.]?[[:space:]]*a[.]?|s[.]?[[:space:]]*n[.]?[[:space:]]*c[.]?)'
    AND NOT EXISTS (
      SELECT 1 FROM public.network_companies n
      WHERE lower(btrim(n.website_domain))=lower(btrim(c.canonical_domain))
         OR (c.vat_id IS NOT NULL AND n.vat_id=c.vat_id)
         OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(c.legal_name)))
    )
    AND NOT EXISTS(
      SELECT 1 FROM public.network_netfast3_suppressed_domains s
      WHERE s.domain=lower(btrim(c.canonical_domain))
    )
    AND NOT EXISTS(
      SELECT 1 FROM private.net_pipeline1b2_publication_ledger l WHERE l.candidate_id=c.id
    )
  ORDER BY c.created_at,c.id
  LIMIT v_limit FOR UPDATE OF c SKIP LOCKED
 LOOP
  v_reviewed:=v_reviewed+1;
  SELECT * INTO v_candidate FROM public.network_company_discovery_candidates
  WHERE id=v_item.id;
  SELECT * INTO v_evidence FROM private.net_it_auto2_evidence
  WHERE id=v_item.evidence_id;
  -- Re-evaluate under the same lock. Source company website must be its own
  -- domain and a human hasn't denied rights or blocked the source/candidate.
  SELECT EXISTS(SELECT 1 FROM public.network_companies n
    WHERE lower(btrim(n.website_domain))=lower(btrim(v_candidate.canonical_domain))
       OR (v_candidate.vat_id IS NOT NULL AND n.vat_id=v_candidate.vat_id)
       OR (n.country_code='IT' AND lower(btrim(n.legal_name))=lower(btrim(v_candidate.legal_name))))
  INTO v_collision;
  IF v_collision OR
     lower(split_part(split_part(v_candidate.source_url,'/',3),':',1))
       NOT IN (lower(btrim(v_candidate.canonical_domain)),'www.'||lower(btrim(v_candidate.canonical_domain)))
     OR lower(split_part(split_part(v_candidate.website_url,'/',3),':',1))
       NOT IN (lower(btrim(v_candidate.canonical_domain)),'www.'||lower(btrim(v_candidate.canonical_domain)))
     OR lower(v_candidate.legal_name) LIKE '% di %'
     OR v_candidate.review_status<>'pending_review'
     OR v_candidate.governance_status<>'unreviewed'
     OR EXISTS(SELECT 1 FROM public.network_company_discovery_runs r
        WHERE r.id=v_candidate.run_id
        AND (r.governance_status<>'unreviewed'
          OR r.terms_status NOT IN ('not_checked','unknown')
          OR r.database_rights_status NOT IN ('not_assessed','unknown')) )
     OR v_candidate.quality_flags && ARRAY['legal_identity_not_verified','historical_sole_trader_vat_context']::text[]
     OR v_candidate.personal_data_detected
     OR cardinality(v_candidate.personal_data_fields)>0
     OR v_evidence.verdict<>'identity_supported'
     OR v_evidence.reviewed_at<now()-interval '3 days'
     OR v_evidence.source_rights_state<>'unknown'
  THEN CONTINUE; END IF;
  SELECT role.id,role.canonical_key INTO v_role,v_role_key
    FROM public.network_company_roles role
    WHERE role.canonical_key=ANY(v_candidate.role_keys)
      AND role.status='active' AND role.searchable=true
    ORDER BY array_position(v_candidate.role_keys,role.canonical_key)
    LIMIT 1;
  IF v_role IS NULL THEN CONTINUE; END IF;
  IF p_dry_run THEN
    v_results:=v_results||jsonb_build_array(
      jsonb_build_object('candidate_id',v_candidate.id,'status','ready_facts_only'));
    CONTINUE;
  END IF;
  -- Publish **only factual minimal fields**; no copied page content or contacts.
  -- No claim of a human approval or intellectual-property license is recorded.
  INSERT INTO public.network_companies(
    legal_name,country_code,website_url,website_domain,
    publication_status,claimed_status,verification_status
  ) VALUES (
    btrim(v_candidate.legal_name),'IT',v_candidate.website_url,
    lower(btrim(v_candidate.canonical_domain)),
    'published','unclaimed','unverified'
  ) RETURNING id INTO v_company;
  INSERT INTO private.net_pipeline1b2_publication_ledger(
    candidate_id,company_id,source_url,source_domain,classification,executed_by
  ) VALUES (
    v_candidate.id,v_company,v_candidate.source_url,
    lower(btrim(v_candidate.canonical_domain)),
    'minimal_unverified',NULL
  );
  INSERT INTO public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,asserted_by,
    confidence,review_state
  ) VALUES (
    'company',v_company,'industrial_role_observed',
    jsonb_build_object(
      'role_key',v_role_key,'source_url',v_candidate.source_url,
      'origin','delegated_agent','evidence_id',v_evidence.id,
      'policy','first_party_minimal_facts_only_v1',
      'role_confirmed_by_company',false,'company_verified',false,
      'tube_procurement_confirmed',false
    ),
    'public_web',v_candidate.source_url,'platform_curated',NULL,
    0.50,'accepted'
  ) RETURNING id INTO v_assertion;
  INSERT INTO public.network_company_role_assignments(
    company_id,role_id,is_primary,source_assertion_id
  ) VALUES(v_company,v_role,true,v_assertion);
  UPDATE public.network_company_discovery_candidates
  SET review_status='published',promoted_company_id=v_company,
      publication_actor_type='delegated_agent',
      reviewed_at=now(),reviewed_by=NULL,
      review_note='NET-IT-AUTO3: minimal factual profile published by agent under explicit Platform Owner policy; source rights remain not human-approved; evidence retained.'
  WHERE id=v_candidate.id;
  INSERT INTO private.net_it_auto3_publications(
    candidate_id,company_id,evidence_id,authorized_by
  ) VALUES(v_candidate.id,v_company,v_evidence.id,v_policy.authorized_by);
  v_published:=v_published+1;
  v_results:=v_results||jsonb_build_array(
   jsonb_build_object('candidate_id',v_candidate.id,'company_id',v_company));
 END LOOP;

 IF NOT p_dry_run AND v_published>0 THEN
  INSERT INTO private.net_it_auto3_events(
    event_kind,actor_type,actor_user_id,details
  ) VALUES (
    'agent_release','delegated_agent',NULL,
    jsonb_build_object('count',v_published,'published',v_results,
      'authorized_by',v_policy.authorized_by)
  );
 END IF;
 RETURN jsonb_build_object(
  'contract','net-it-auto3-release-v1',
  'status',CASE WHEN p_dry_run THEN 'dry_run' ELSE 'published' END,
  'considered',v_reviewed,'published',v_published,
  'ready',CASE WHEN p_dry_run THEN jsonb_array_length(v_results) ELSE v_published END,
  'daily_published',v_daily+v_published,'results',v_results,
  'original_publisher_default_off',(
    SELECT enabled IS FALSE FROM private.net_pipeline1b2_settings WHERE singleton=true
  )
 );
END
$agent$;
REVOKE ALL ON FUNCTION private.net_it_auto3_release(integer,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
