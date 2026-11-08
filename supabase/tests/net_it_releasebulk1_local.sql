-- NET-IT-RELEASEBULK1 CI-ONLY integration acceptance. NEVER use on production.
-- This file is run solely against disposable local Supabase in GitHub Actions.
-- Fake names, invalid domains and fake rights pages are synthetic test fixtures.
\set ON_ERROR_STOP on
\ir ../../services/worker/sql/net_it_releasebulk1_proposed.sql

BEGIN;

-- Verify RLS/grants after installing the candidate schema on isolated Postgres.
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.netit_releasebulk1(text,text,jsonb,text,boolean,boolean)','EXECUTE') THEN
   RAISE EXCEPTION 'anon must not be able to invoke publish RPC';
 END IF;
 IF NOT has_function_privilege('authenticated','public.netit_releasebulk1(text,text,jsonb,text,boolean,boolean)','EXECUTE') THEN
   RAISE EXCEPTION 'authenticated facade should be callable with Platform permission gate';
 END IF;
 IF has_table_privilege('authenticated','private.netit_releasebulk1_links','SELECT')
    OR has_table_privilege('anon','private.netit_releasebulk1_links','SELECT')
    OR has_table_privilege('authenticated','private.netit_releasebulk1_links','INSERT') THEN
   RAISE EXCEPTION 'publication ledger must remain isolated from API clients';
 END IF;
 IF EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='netit_releasebulk1' AND p.prosecdef
 ) THEN
   RAISE EXCEPTION 'public wrapper must stay security invoker';
 END IF;
END $acl$;

-- Synthetic local user; never send email, never use real credentials.
INSERT INTO auth.users (
 id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at
) VALUES (
 '5e5dfabe-f01d-4bca-89dc-61d031f80a01',
 '00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','netit-releasebulk1-ci@example.invalid',
 'not-a-real-credential',now(),now(),now()
);
INSERT INTO public.platform_user_roles(user_id,role,status,reason)
VALUES ('5e5dfabe-f01d-4bca-89dc-61d031f80a01','platform_superadmin','active','Synthetic local SQL acceptance only');

INSERT INTO private.network_web_research_seeds (
 country_code,canonical_domain,display_name,proposed_role,source_url,
 source_summary,source_kind,review_lane,claim_status,verification_status,
 publication_status,research_id,batch_key
) VALUES (
 'IT','netit-ci-synthetic.invalid','NETIT CI SYNTHETIC INDUSTRIAL COMPANY','end_user',
 'https://netit-ci-synthetic.invalid/company',
 'Synthetic local-only source description for testing an industrial steel tube user; no actual company or rights exist.',
 'first_party_web','web_profile_review_pending','unclaimed','web_sourced_unverified',
 'not_published','NETIT-CI-0001','NET-IT-CI-BATCH01'
);

-- Anonymous user cannot invoke this endpoint.
SET LOCAL ROLE anon;
DO $anon$
DECLARE v_denied boolean := false;
BEGIN
 BEGIN
  PERFORM public.netit_releasebulk1('NET-IT-CI-BATCH01','NET-IT-CI-WAVE01','[]'::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
 END;
 IF NOT v_denied THEN
   RAISE EXCEPTION 'anonymous caller reached publisher';
 END IF;
END $anon$;
RESET ROLE;

-- Authenticated but not Platform user also fails closed; no spoofed auth.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $notplatform$
DECLARE v_denied boolean := false;
BEGIN
 BEGIN
  PERFORM public.netit_releasebulk1('NET-IT-CI-BATCH01','NET-IT-CI-WAVE01','[]'::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
 END;
 IF NOT v_denied THEN
   RAISE EXCEPTION 'non-Platform user passed governance gate';
 END IF;
END $notplatform$;
RESET ROLE;

-- The synthetic identity has a real local Platform role, but its "rights"
-- reference is a fake .invalid URL *solely* for testing workflow mechanics.
-- No publishing consent or license is represented for any real company.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','5e5dfabe-f01d-4bca-89dc-61d031f80a01',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $accept$
DECLARE
 v_seed uuid;
 v_items jsonb;
 v_bad_items jsonb;
 v_preview jsonb;
 v_commit jsonb;
 v_repeat jsonb;
 v_blocked boolean;
 v_fingerprint text;
 v_company uuid;
BEGIN
 SELECT id INTO STRICT v_seed FROM private.network_web_research_seeds
 WHERE research_id='NETIT-CI-0001';

 v_items := jsonb_build_array(jsonb_build_object(
  'seed_id',v_seed,'domain','netit-ci-synthetic.invalid','role','end_user',
  'legal_name','NETIT CI SYNTHETIC INDUSTRIAL COMPANY',
  'identity_evidence_url','https://netit-ci-synthetic.invalid/company',
  'rights_reference_url','https://netit-ci-synthetic.invalid/rights',
  'rights_decision','licensed',
  'rights_note','SYNTHETIC local-only simulated license fixture; NOT a real company or real license.'
 ));
 v_bad_items := jsonb_build_array(jsonb_build_object(
  'seed_id',v_seed,'domain','netit-ci-synthetic.invalid','role','end_user',
  'legal_name','NETIT CI SYNTHETIC INDUSTRIAL COMPANY',
  'identity_evidence_url','https://netit-ci-synthetic.invalid/company',
  'rights_reference_url','https://netit-ci-synthetic.invalid/rights',
  'rights_decision','licensed',
  'rights_note','CHANGED SYNTHETIC local-only simulated license fixture; not the approved preview.'
 ));

 -- Preview writes no public company, role or assertion.
 v_preview := public.netit_releasebulk1(
   'NET-IT-CI-BATCH01','NET-IT-CI-WAVE01',v_items,NULL,false,false);
 IF v_preview->>'status'<>'ready_for_attested_commit'
    OR (v_preview->>'eligible')::int<>1
    OR (v_preview->>'published_now')::int<>0 THEN
   RAISE EXCEPTION 'Synthetic authorized preview did not report eligible=1: %',v_preview;
 END IF;
 IF EXISTS (SELECT 1 FROM public.network_companies
            WHERE website_domain='netit-ci-synthetic.invalid') THEN
   RAISE EXCEPTION 'Preview mutated canonical company';
 END IF;
 v_fingerprint := v_preview->>'manifest_fingerprint';

 -- Missing attestation refuses and rolls back.
 v_blocked := false;
 BEGIN
  PERFORM public.netit_releasebulk1(
   'NET-IT-CI-BATCH01','NET-IT-CI-WAVE01',v_items,v_fingerprint,false,true);
 EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
 END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'Commit without attestation was accepted'; END IF;

 -- Even genuine operator cannot switch the reviewed manifest on commit.
 v_blocked := false;
 BEGIN
  PERFORM public.netit_releasebulk1(
   'NET-IT-CI-BATCH01','NET-IT-CI-WAVE01',v_bad_items,v_fingerprint,true,true);
 EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
 END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'Changed rights review passed original fingerprint'; END IF;

 -- Positive synthetic commit on disposable DB only.
 v_commit := public.netit_releasebulk1(
   'NET-IT-CI-BATCH01','NET-IT-CI-WAVE01',v_items,v_fingerprint,true,true);
 IF v_commit->>'status'<>'published' OR (v_commit->>'published_count')::int<>1 THEN
   RAISE EXCEPTION 'Atomic synthetic commit failed: %',v_commit;
 END IF;
 SELECT id INTO STRICT v_company FROM public.network_companies
 WHERE website_domain='netit-ci-synthetic.invalid'
   AND publication_status='published' AND claimed_status='unclaimed'
   AND verification_status='unverified';
 IF NOT EXISTS (
   SELECT 1 FROM public.network_company_role_assignments a
   JOIN public.network_company_roles r ON r.id=a.role_id
   WHERE a.company_id=v_company AND r.canonical_key='end_user'
 ) THEN RAISE EXCEPTION 'Published company missing role assertion'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM private.netit_releasebulk1_links l
   WHERE l.company_id=v_company AND l.approved_by='5e5dfabe-f01d-4bca-89dc-61d031f80a01'
     AND l.wave='NET-IT-CI-WAVE01'
 ) THEN RAISE EXCEPTION 'Missing reviewer ledger record'; END IF;

 -- Exactly identical replay is idempotent.
 v_repeat := public.netit_releasebulk1(
   'NET-IT-CI-BATCH01','NET-IT-CI-WAVE01',v_items,v_fingerprint,true,true);
 IF v_repeat->>'status'<>'already_published'
    OR (v_repeat->>'created_now')::int<>0 THEN
   RAISE EXCEPTION 'Idempotent replay failed: %',v_repeat;
 END IF;
 IF (SELECT count(*) FROM public.network_companies
     WHERE website_domain='netit-ci-synthetic.invalid') <> 1 THEN
   RAISE EXCEPTION 'Replay duplicated company';
 END IF;

 -- Reuse the same wave with altered rights must be rejected.
 v_blocked := false;
 BEGIN
  PERFORM public.netit_releasebulk1(
   'NET-IT-CI-BATCH01','NET-IT-CI-WAVE01',v_bad_items,v_fingerprint,true,true);
 EXCEPTION WHEN invalid_parameter_value THEN v_blocked := true;
 END;
 IF NOT v_blocked THEN RAISE EXCEPTION 'Tampered replay was accepted'; END IF;
END $accept$;

RESET ROLE;
ROLLBACK;
SELECT 'NET-IT-RELEASEBULK1 isolated live SQL acceptance PASS; synthetic test fully rolled back' AS result;
