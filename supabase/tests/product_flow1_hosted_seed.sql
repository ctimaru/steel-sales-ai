-- Target guard + fixed workflow concurrency are mandatory. No Auth/legal/model writes.
\set ON_ERROR_STOP on
BEGIN;
\ir product_flow1_hosted_preflight.sql
INSERT INTO public.organizations (id,name,slug,created_by,industry,country_code,onboarding_status,guided_setup_completed_at,onboarding_completed_at) VALUES
 (:'flow1_org_a','SR2B Demo Buyer A','sr2b-company-a',:'flow1_a','steel','IT','completed',now(),now()),
 (:'flow1_org_b','SR2B Demo Trader B','sr2b-company-b',:'flow1_b','steel','IT','completed',now(),now());
INSERT INTO public.organization_memberships (organization_id,user_id,role,business_role,status,is_default) VALUES
 (:'flow1_org_a',:'flow1_a','admin','sales_director','active',true),
 (:'flow1_org_b',:'flow1_b','admin','sales_director','active',true);
INSERT INTO public.commercial_datasets (id,owner_id,organization_id,source_run_id,source_filename,status) VALUES
 ('00000000-0000-0000-0000-000000094401',:'flow1_a',:'flow1_org_a','00000000-0000-0000-0000-000000094411','flow1-hosted-a.eml','ready'),
 ('00000000-0000-0000-0000-000000094402',:'flow1_b',:'flow1_org_b','00000000-0000-0000-0000-000000094412','flow1-hosted-b.eml','ready');
INSERT INTO public.commercial_threads (id,owner_id,organization_id,dataset_id,source_conversation_id,subject,last_activity_at) VALUES
 ('00000000-0000-0000-0000-000000094421',:'flow1_a',:'flow1_org_a','00000000-0000-0000-0000-000000094401','00000000-0000-0000-0000-000000094431','FLOW1 HOSTED STEEL BUYER A',now()),
 ('00000000-0000-0000-0000-000000094422',:'flow1_b',:'flow1_org_b','00000000-0000-0000-0000-000000094402','00000000-0000-0000-0000-000000094432','FLOW1 HOSTED STEEL TRADER B',now());
-- canonical_product_key/id are GENERATED ALWAYS; let the existing schema compute them.
INSERT INTO public.commercial_observations (owner_id,organization_id,dataset_id,thread_id,source_conversation_id,item_role,product_type,grade,standard,outer_diameter_mm,thickness_mm,source_filename,source_text,search_text) VALUES
 (:'flow1_a',:'flow1_org_a','00000000-0000-0000-0000-000000094401','00000000-0000-0000-0000-000000094421','00000000-0000-0000-0000-000000094431','requested','round_tube','S355J2H','EN 10219',60.3,3.2,'flow1-hosted-a.eml','FLOW1 HOSTED STEEL BUYER A verified round 60.3 x 3.2 EN 10219','FLOW1 HOSTED STEEL BUYER A'),
 (:'flow1_b',:'flow1_org_b','00000000-0000-0000-0000-000000094402','00000000-0000-0000-0000-000000094422','00000000-0000-0000-0000-000000094432','requested','round_tube','S355J2H','EN 10219',60.3,3.2,'flow1-hosted-b.eml','FLOW1 HOSTED STEEL TRADER B verified round 60.3 x 3.2 EN 10219','FLOW1 HOSTED STEEL TRADER B');
COMMIT;
SELECT 'FLOW1 hosted fixture seeded: two existing users, two isolated structured sources, no RFQs' AS result;
