-- NET-IT-AUTO3-CAP1000: up to 1000/day only after NEW signed-in Owner grant.
-- Existing quota, actor, delegation expiry, publishing rules and ledger unchanged.
-- Never increase current policy behind the Owner: no manual UPDATE to grants.
-- Each maintenance release remains limited to 100 and still validates AUTO2.
ALTER TABLE private.net_it_auto3_policy
  DROP CONSTRAINT IF EXISTS net_it_auto3_policy_daily_cap_check;
ALTER TABLE private.net_it_auto3_policy
  ADD CONSTRAINT net_it_auto3_policy_daily_cap_check
  CHECK (daily_cap BETWEEN 1 AND 1000);

CREATE OR REPLACE FUNCTION private.net_it_auto3_set_policy_impl(p_enabled boolean, p_daily_cap integer DEFAULT 100, p_valid_days integer DEFAULT 30, p_attested boolean DEFAULT false, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  OR p_daily_cap NOT BETWEEN 1 AND 1000
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
$function$
;
