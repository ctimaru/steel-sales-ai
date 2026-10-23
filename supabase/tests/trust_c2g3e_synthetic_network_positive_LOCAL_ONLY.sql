-- TRUST-AUDIT1C.2G.3E: POSITIVE Network batch with SYNTHETIC source-review fixture.
-- Never apply this file to hosted Supabase. Local Docker test ONLY; fully rolled back.
-- Synthetic approval proves worker behavior, NOT third-party reuse rights.
BEGIN;
DO $test$
DECLARE v_id uuid:='99e3e330-8f77-40c4-9b51-b99393a530ee';
BEGIN
  IF current_setting('is_superuser',true) <> 'on' AND current_user<>'postgres' THEN
    RAISE EXCEPTION 'Local-only fixture requires postgres administrative test identity';
  END IF;
  INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  VALUES(v_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'trust-c2g3e-synthetic@example.invalid','',now(),now(),now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.network_discovery_source_registry(
     id,source_name,source_url,source_type,country_code,
     governance_status,terms_status,database_rights_status,personal_data_policy,
     rights_evidence_url,review_note,reviewed_by,reviewed_at,
     enabled_for_discovery,max_domains_per_run,minimum_interval_hours
  ) VALUES (
     '8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid,
     'Synthetic local Wikidata test fixture only',
     'https://query.wikidata.org/sparql','curated_public_source','IT',
     'approved','allows_reuse','low_risk','exclude_personal_data',
     'https://www.wikidata.org/wiki/Wikidata:Licensing',
     'Synthetic local fixture; not a real licensing decision or production permission',
     v_id,now(),true,200,24)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.network_netlaunch2_cursors(industry_qid,next_offset)
  VALUES ('Q2285982',0),('Q1924906',0)
  ON CONFLICT (industry_qid) DO NOTHING;
  INSERT INTO public.network_netlaunch2_runs(run_day,industry_ids,offsets,status)
  VALUES((now() at time zone 'UTC')::date,ARRAY['Q2285982','Q1924906']::text[],
    '{"Q2285982":0,"Q1924906":0}'::jsonb,'claimed');
END $test$;
DO $test$
DECLARE v_run uuid; result jsonb;
BEGIN
  SELECT id INTO v_run FROM public.network_netlaunch2_runs
  WHERE run_day=(now() at time zone 'UTC')::date;
  IF v_run IS NULL THEN RAISE EXCEPTION 'No synthetic claimed run'; END IF;
  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT public.netlaunch2_commit_daily(
    v_run,
    '[{"qid":"Q999999999","label":"Synthetic Steel Fixture Ltd",
       "domain":"synthetic-c2g3e.invalid",
       "website":"https://synthetic-c2g3e.invalid/",
       "industry_qid":"Q2285982"}]'::jsonb,
    '{"Q2285982":1,"Q1924906":0}'::jsonb
  ) INTO result;
  IF result->>'status'<>'completed'
    OR (result->>'accepted')::integer<>1
    OR (result->>'new_unconfirmed')::integer<>1
    OR (result->>'canonical_published')::integer<>0 THEN
      RAISE EXCEPTION 'C2G3E synthetic batch result invalid';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.network_netfast2_structured_entities
       WHERE domain='synthetic-c2g3e.invalid') THEN
    RAISE EXCEPTION 'C2G3E synthetic entity not inserted';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.network_netlaunch2_runs
       WHERE id=v_run AND status='completed' AND accepted=1 AND inserted=1) THEN
    RAISE EXCEPTION 'C2G3E synthetic run counters wrong';
  END IF;
END $test$;
ROLLBACK;
