-- Hosted staging ONLY; run scripts/staging-ready1-target-guard.py first.
-- Reads existing QA identity/legal metadata; never creates Auth or legal evidence.
\set ON_ERROR_STOP on
\set flow1_a 'c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5'
\set flow1_b 'dbc50941-f6d7-4e51-85c9-cdbf6d16f36e'
\set flow1_org_a '00000000-0000-4000-8000-000000072201'
\set flow1_org_b '00000000-0000-4000-8000-000000072202'
DO $$ DECLARE q record; BEGIN
 IF (SELECT count(*) FROM auth.users) <> 2 THEN RAISE EXCEPTION 'FLOW1 expected exactly two existing QA identities'; END IF;
 FOR q IN SELECT * FROM (VALUES
  ('c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5'::uuid,'sr2b-admin-a@smartsteelsales.test'),
  ('dbc50941-f6d7-4e51-85c9-cdbf6d16f36e'::uuid,'sr2b-admin-b@smartsteelsales.test')) AS x(id,email)
 LOOP
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=q.id AND email=q.email AND email_confirmed_at IS NOT NULL)
   OR EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id=q.id)
   OR NOT EXISTS (SELECT 1 FROM public.user_legal_acceptances WHERE user_id=q.id
    AND privacy_notice_version='2026-10-04-lr5-v1' AND terms_version='2026-10-04-lr5-v1'
    AND privacy_acknowledged_at IS NOT NULL AND terms_accepted_at IS NOT NULL)
  THEN RAISE EXCEPTION 'FLOW1 existing identity, legal evidence or empty-membership guard failed'; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM public.knowledge_embedding_models WHERE status='active')
  OR EXISTS (SELECT 1 FROM public.organizations WHERE id IN ('00000000-0000-4000-8000-000000072201','00000000-0000-4000-8000-000000072202') OR slug IN ('sr2b-company-a','sr2b-company-b'))
  OR EXISTS (SELECT 1 FROM public.commercial_datasets WHERE id IN ('00000000-0000-0000-0000-000000094401','00000000-0000-0000-0000-000000094402') OR source_filename IN ('flow1-hosted-a.eml','flow1-hosted-b.eml') OR source_run_id IN ('00000000-0000-0000-0000-000000094411','00000000-0000-0000-0000-000000094412'))
  OR EXISTS (SELECT 1 FROM public.commercial_threads WHERE id IN ('00000000-0000-0000-0000-000000094421','00000000-0000-0000-0000-000000094422') OR source_conversation_id IN ('00000000-0000-0000-0000-000000094431','00000000-0000-0000-0000-000000094432'))
  OR EXISTS (SELECT 1 FROM public.commercial_observations WHERE source_filename IN ('flow1-hosted-a.eml','flow1-hosted-b.eml') OR source_conversation_id IN ('00000000-0000-0000-0000-000000094431','00000000-0000-0000-0000-000000094432'))
 THEN RAISE EXCEPTION 'FLOW1 requires zero active models and an unused reserved namespace'; END IF;
END $$;
-- Capture these two integers before seeding; pass them to assert and cleanup.
SELECT (SELECT count(*) FROM auth.users) AS flow1_auth_users_before,
       (SELECT count(*) FROM public.user_legal_acceptances) AS flow1_legal_acceptances_before;
