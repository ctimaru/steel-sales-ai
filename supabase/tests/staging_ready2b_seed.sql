-- STAGING-READY2B / Synthetic hosted preview acceptance ONLY.
-- Never run on production. GitHub workflow separately validates the DB ref.
-- Values are test-only; user IDs are generated through staging GoTrue admin API.
\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
 IF (SELECT count(*) FROM auth.users) <> 3 THEN
   RAISE EXCEPTION 'STAGING-READY2B requires precisely three staging Auth users';
 END IF;
 IF EXISTS (SELECT 1 FROM public.organizations
            WHERE slug IN ('sr2b-company-a','sr2b-company-b')
               OR id IN ('00000000-0000-4000-8000-000000072201'::uuid,
                         '00000000-0000-4000-8000-000000072202'::uuid))
 THEN
   RAISE EXCEPTION 'STAGING-READY2B fixture already exists: stop';
 END IF;
END;
$guard$;

INSERT INTO public.organizations
 (id,name,slug,created_by,industry,country_code,onboarding_status,
  guided_setup_completed_at,onboarding_completed_at)
VALUES
 ('00000000-0000-4000-8000-000000072201','SR2B Demo Buyer A','sr2b-company-a',
  :'admin_a_user_id'::uuid,'steel','IT','completed',now(),now()),
 ('00000000-0000-4000-8000-000000072202','SR2B Demo Trader B','sr2b-company-b',
  :'admin_b_user_id'::uuid,'steel','IT','completed',now(),now());

INSERT INTO public.organization_memberships
 (organization_id,user_id,role,business_role,status,is_default)
VALUES
 ('00000000-0000-4000-8000-000000072201',:'admin_a_user_id'::uuid,'admin','sales_director','active',true),
 ('00000000-0000-4000-8000-000000072202',:'admin_b_user_id'::uuid,'admin','sales_director','active',true),
 ('00000000-0000-4000-8000-000000072201',:'viewer_a_user_id'::uuid,'viewer',NULL,'active',true);

-- Test-only legal acknowledgements: no natural person or user acceptance is simulated.
INSERT INTO public.user_legal_acceptances
 (user_id,subject_user_ref,privacy_notice_version,privacy_acknowledged_at,
  terms_version,terms_accepted_at,acceptance_source)
SELECT user_id,user_id,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'
FROM (VALUES
 (:'admin_a_user_id'::uuid),
 (:'admin_b_user_id'::uuid),
 (:'viewer_a_user_id'::uuid)
) AS synthetic(user_id);

INSERT INTO public.buyer_distintas
 (id,owner_user_id,organization_id,title,line_count,total_meters,total_tonnes)
VALUES
 ('00000000-0000-4000-8000-000000072221',:'admin_a_user_id'::uuid,
  '00000000-0000-4000-8000-000000072201','SR2B BUYER A PRIVATE DISTINTA',1,120,3),
 ('00000000-0000-4000-8000-000000072222',:'admin_b_user_id'::uuid,
  '00000000-0000-4000-8000-000000072202','SR2B TRADER B PRIVATE DISTINTA',1,120,3);

INSERT INTO public.buyer_distinta_lines
 (id,distinta_id,line_position,description,standard_code,grade_code,
  quantity_mode,quantity,bar_length_m,weight_kg_m,line_meters,line_tonnes)
VALUES
 ('00000000-0000-4000-8000-000000072231',
  '00000000-0000-4000-8000-000000072221',1,
  'SR2B Buyer EN 10219 Tube','EN 10219','S355J2H','bars',20,6,25,120,3),
 ('00000000-0000-4000-8000-000000072232',
  '00000000-0000-4000-8000-000000072222',1,
  'SR2B Trader EN 10210 Tube','EN 10210','S355J2H','bars',20,6,25,120,3);

INSERT INTO public.buyer_rfq_campaigns
 (id,owner_user_id,organization_id,source_distinta_id,title,status,due_at)
VALUES
 ('00000000-0000-4000-8000-000000072211',:'admin_a_user_id'::uuid,
  '00000000-0000-4000-8000-000000072201',
  '00000000-0000-4000-8000-000000072221','SR2B BUYER A PRIVATE RFQ','draft',
  now()+interval '14 days'),
 ('00000000-0000-4000-8000-000000072212',:'admin_b_user_id'::uuid,
  '00000000-0000-4000-8000-000000072202',
  '00000000-0000-4000-8000-000000072222','SR2B TRADER B PRIVATE RFQ','draft',
  now()+interval '14 days');

DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.organizations WHERE slug LIKE 'sr2b-company-%')<>2
    OR (SELECT count(*) FROM public.organization_memberships
        WHERE organization_id IN ('00000000-0000-4000-8000-000000072201'::uuid,
                                  '00000000-0000-4000-8000-000000072202'::uuid))<>3
    OR (SELECT count(*) FROM public.buyer_rfq_campaigns
        WHERE id IN ('00000000-0000-4000-8000-000000072211'::uuid,
                     '00000000-0000-4000-8000-000000072212'::uuid))<>2
 THEN
   RAISE EXCEPTION 'STAGING-READY2B synthetic fixture integrity failed';
 END IF;
END;
$verify$;
COMMIT;
SELECT 'STAGING-READY2B synthetic-only seed PASS (2 orgs/3 users/2 private RFQs)' AS result;
