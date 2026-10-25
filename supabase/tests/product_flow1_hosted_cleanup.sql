-- Always target-guard staging first. Idempotent; unexpected ownership/data aborts.
\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE q record; orgs uuid[]:=ARRAY['00000000-0000-4000-8000-000000072201','00000000-0000-4000-8000-000000072202']::uuid[]; BEGIN
 FOR q IN SELECT * FROM (VALUES
  ('00000000-0000-4000-8000-000000072201'::uuid,'c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5'::uuid,'sr2b-company-a','SR2B Demo Buyer A','00000000-0000-0000-0000-000000094401'::uuid,'flow1-hosted-a.eml'),
  ('00000000-0000-4000-8000-000000072202'::uuid,'dbc50941-f6d7-4e51-85c9-cdbf6d16f36e'::uuid,'sr2b-company-b','SR2B Demo Trader B','00000000-0000-0000-0000-000000094402'::uuid,'flow1-hosted-b.eml')) AS x(org_id,user_id,slug,name,dataset_id,filename)
 LOOP
  IF EXISTS (SELECT 1 FROM public.organizations WHERE (id=q.org_id OR slug=q.slug) AND (id<>q.org_id OR slug<>q.slug OR name<>q.name OR created_by IS DISTINCT FROM q.user_id))
   OR EXISTS (SELECT 1 FROM public.organization_memberships WHERE (organization_id=q.org_id OR user_id=q.user_id) AND (organization_id<>q.org_id OR user_id<>q.user_id OR role<>'admin' OR status<>'active'))
   OR EXISTS (SELECT 1 FROM public.commercial_datasets WHERE (id=q.dataset_id OR organization_id=q.org_id OR source_filename=q.filename) AND (id<>q.dataset_id OR organization_id IS DISTINCT FROM q.org_id OR owner_id IS DISTINCT FROM q.user_id OR source_filename IS DISTINCT FROM q.filename))
   OR EXISTS (SELECT 1 FROM public.commercial_threads WHERE dataset_id=q.dataset_id AND (owner_id IS DISTINCT FROM q.user_id OR organization_id IS DISTINCT FROM q.org_id))
   OR EXISTS (SELECT 1 FROM public.commercial_observations WHERE dataset_id=q.dataset_id AND (owner_id IS DISTINCT FROM q.user_id OR organization_id IS DISTINCT FROM q.org_id OR source_filename IS DISTINCT FROM q.filename))
  THEN RAISE EXCEPTION 'FLOW1 cleanup identity or namespace ownership mismatch'; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM public.buyer_rfq_campaigns WHERE organization_id=ANY(orgs) AND
    (organization_id<>orgs[1] OR owner_user_id<>'c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5'::uuid OR title NOT IN ('FLOW1 HOSTED 390','FLOW1 HOSTED 1440') OR status<>'draft' OR launched_at IS NOT NULL OR marketplace_request_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.buyer_distintas d WHERE d.id=buyer_rfq_campaigns.source_distinta_id AND d.organization_id=buyer_rfq_campaigns.organization_id AND d.owner_user_id=buyer_rfq_campaigns.owner_user_id AND d.title=buyer_rfq_campaigns.title)))
  OR EXISTS (SELECT 1 FROM public.buyer_distintas WHERE organization_id=ANY(orgs) AND
    (organization_id<>orgs[1] OR owner_user_id<>'c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5'::uuid OR title NOT IN ('FLOW1 HOSTED 390','FLOW1 HOSTED 1440')))
  OR (SELECT count(*) FROM public.buyer_rfq_campaigns WHERE organization_id=ANY(orgs))>2
  OR (SELECT count(*) FROM public.buyer_distintas WHERE organization_id=ANY(orgs))>2
  OR EXISTS (SELECT 1 FROM public.buyer_rfq_dispatches WHERE organization_id=ANY(orgs))
  OR EXISTS (SELECT 1 FROM public.buyer_rfq_quotes WHERE organization_id=ANY(orgs))
  OR EXISTS (SELECT 1 FROM public.buyer_distinta_deliveries x JOIN public.buyer_distintas d ON d.id=x.distinta_id WHERE d.organization_id=ANY(orgs))
 THEN RAISE EXCEPTION 'FLOW1 cleanup refuses non-draft, sent or unexpected procurement data'; END IF;
END $$;
DELETE FROM public.buyer_rfq_campaigns WHERE organization_id='00000000-0000-4000-8000-000000072201' AND owner_user_id='c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5' AND title IN ('FLOW1 HOSTED 390','FLOW1 HOSTED 1440');
DELETE FROM public.buyer_distintas WHERE organization_id='00000000-0000-4000-8000-000000072201' AND owner_user_id='c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5' AND title IN ('FLOW1 HOSTED 390','FLOW1 HOSTED 1440');
DELETE FROM public.commercial_datasets WHERE id IN ('00000000-0000-0000-0000-000000094401','00000000-0000-0000-0000-000000094402') AND organization_id IN ('00000000-0000-4000-8000-000000072201','00000000-0000-4000-8000-000000072202');
DELETE FROM public.organization_memberships WHERE (organization_id,user_id) IN (('00000000-0000-4000-8000-000000072201'::uuid,'c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5'::uuid),('00000000-0000-4000-8000-000000072202'::uuid,'dbc50941-f6d7-4e51-85c9-cdbf6d16f36e'::uuid));
DELETE FROM public.organizations WHERE (id,slug,created_by) IN (('00000000-0000-4000-8000-000000072201'::uuid,'sr2b-company-a','c8f21e9b-a1b8-4ab6-abc8-c07c81356bb5'::uuid),('00000000-0000-4000-8000-000000072202'::uuid,'sr2b-company-b','dbc50941-f6d7-4e51-85c9-cdbf6d16f36e'::uuid));
-- The original preflight proves all fixture namespaces absent and accounts retained.
\ir product_flow1_hosted_preflight.sql
\if :{?flow1_auth_users_before}
 SELECT (SELECT count(*) FROM auth.users)=:'flow1_auth_users_before'::bigint
  AND (SELECT count(*) FROM public.user_legal_acceptances)=:'flow1_legal_acceptances_before'::bigint AS flow1_audit_unchanged \gset
 \if :flow1_audit_unchanged
 \else
  \quit 1
 \endif
\endif
COMMIT;
SELECT 'FLOW1 hosted cleanup PASS: namespace absent; existing Auth and legal evidence preserved' AS result;
