-- STAGING-READY2B strict cleanup for only two reserved fixture organizations.
-- The accompanying GitHub workflow verifies the staging DB target first.
\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.organizations
   WHERE id IN ('00000000-0000-4000-8000-000000072201'::uuid,
                '00000000-0000-4000-8000-000000072202'::uuid)
     AND (id,slug) NOT IN (
       ('00000000-0000-4000-8000-000000072201'::uuid,'sr2b-company-a'),
       ('00000000-0000-4000-8000-000000072202'::uuid,'sr2b-company-b')
     )
 ) THEN RAISE EXCEPTION 'Unexpected organization identity: cleanup denied'; END IF;
 IF EXISTS (
   SELECT 1 FROM public.organizations
   WHERE slug IN ('sr2b-company-a','sr2b-company-b')
     AND id NOT IN ('00000000-0000-4000-8000-000000072201'::uuid,
                    '00000000-0000-4000-8000-000000072202'::uuid)
 ) THEN RAISE EXCEPTION 'Slug belongs to unknown organization: cleanup denied'; END IF;
END;
$guard$;

DELETE FROM public.buyer_rfq_campaigns
 WHERE id IN ('00000000-0000-4000-8000-000000072211'::uuid,
              '00000000-0000-4000-8000-000000072212'::uuid)
   AND organization_id IN ('00000000-0000-4000-8000-000000072201'::uuid,
                           '00000000-0000-4000-8000-000000072202'::uuid);
DELETE FROM public.buyer_distinta_lines
 WHERE distinta_id IN ('00000000-0000-4000-8000-000000072221'::uuid,
                       '00000000-0000-4000-8000-000000072222'::uuid);
DELETE FROM public.buyer_distintas
 WHERE id IN ('00000000-0000-4000-8000-000000072221'::uuid,
              '00000000-0000-4000-8000-000000072222'::uuid)
   AND organization_id IN ('00000000-0000-4000-8000-000000072201'::uuid,
                           '00000000-0000-4000-8000-000000072202'::uuid);
DELETE FROM public.user_legal_acceptances
 WHERE user_id IN (SELECT id FROM auth.users
                   WHERE lower(email) IN (
                     'sr2b-admin-a@smartsteelsales.test',
                     'sr2b-admin-b@smartsteelsales.test',
                     'sr2b-viewer-a@smartsteelsales.test'
                   ));
DELETE FROM public.organization_memberships
 WHERE organization_id IN ('00000000-0000-4000-8000-000000072201'::uuid,
                           '00000000-0000-4000-8000-000000072202'::uuid);
DELETE FROM public.organizations
 WHERE (id,slug) IN (
    ('00000000-0000-4000-8000-000000072201'::uuid,'sr2b-company-a'),
    ('00000000-0000-4000-8000-000000072202'::uuid,'sr2b-company-b')
 );
COMMIT;
SELECT 'STAGING-READY2B reserved fixtures cleanup SQL completed' AS result;
