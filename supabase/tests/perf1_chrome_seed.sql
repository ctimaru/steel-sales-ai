-- PERF1: browser fixtures in disposable local Supabase ONLY.
-- The browser logs in via REAL GoTrue; DB seeding is strictly CI/runner-scoped.
-- Never execute this file against hosted Supabase: fixed IDs may conflict.
\set ON_ERROR_STOP on
begin;

insert into public.organizations (
 id,name,slug,created_by,industry,country_code,onboarding_status,
 guided_setup_completed_at,onboarding_completed_at
) values
 ('00000000-0000-0000-0000-000000023301','DEMO Industrial Engineering','dt23-buyer',:'buyer_user_id'::uuid,'steel','IT','completed',now(),now()),
 ('00000000-0000-0000-0000-000000023302','DEMO Steel Manufacturing','dt23-producer',:'producer_user_id'::uuid,'steel','IT','completed',now(),now()),
 ('00000000-0000-0000-0000-000000023303','DEMO Tubes Trading','dt23-trader',:'trader_user_id'::uuid,'steel','IT','completed',now(),now()),
 ('00000000-0000-0000-0000-000000023304','DEMO Steel Processing','dt23-processor',:'processor_user_id'::uuid,'steel','IT','completed',now(),now());

insert into public.organization_memberships(organization_id,user_id,role,business_role,status,is_default)
values
 ('00000000-0000-0000-0000-000000023301',:'buyer_user_id'::uuid,'admin','sales_director','active',true),
 ('00000000-0000-0000-0000-000000023302',:'producer_user_id'::uuid,'admin','sales_director','active',true),
 ('00000000-0000-0000-0000-000000023303',:'trader_user_id'::uuid,'admin','sales_director','active',true),
 ('00000000-0000-0000-0000-000000023304',:'processor_user_id'::uuid,'admin','operations','active',true),
 ('00000000-0000-0000-0000-000000023301',:'buyerViewer_user_id'::uuid,'viewer',null,'active',true);

-- Current published legal version: test-only acceptance for browser QA accounts.
-- No real person has clicked or accepted anything. All rows die with the CI DB.
insert into public.user_legal_acceptances(
  user_id,subject_user_ref,privacy_notice_version,privacy_acknowledged_at,
  terms_version,terms_accepted_at,acceptance_source
) values
 (:'buyer_user_id'::uuid,:'buyer_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'),
 (:'producer_user_id'::uuid,:'producer_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'),
 (:'trader_user_id'::uuid,:'trader_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'),
 (:'processor_user_id'::uuid,:'processor_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'),
 (:'buyerViewer_user_id'::uuid,:'buyerViewer_user_id'::uuid,'2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account');

insert into public.buyer_distintas(
 id,owner_user_id,organization_id,title,line_count,total_meters,total_tonnes
) values
 ('00000000-0000-0000-0000-000000023311',:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000023301','DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219',2,240,6),
 ('00000000-0000-0000-0000-000000023312',:'producer_user_id'::uuid,'00000000-0000-0000-0000-000000023302','DEMOTEST23 PRODUCER PRIVATE RFQ',1,120,3),
 ('00000000-0000-0000-0000-000000023313',:'trader_user_id'::uuid,'00000000-0000-0000-0000-000000023303','DEMOTEST23 TRADER PRIVATE RFQ',1,120,3),
 ('00000000-0000-0000-0000-000000023314',:'processor_user_id'::uuid,'00000000-0000-0000-0000-000000023304','DEMOTEST23 PROCESSOR PRIVATE RFQ',1,120,3);

insert into public.buyer_distinta_lines(
 id,distinta_id,line_position,description,standard_code,grade_code,
 quantity_mode,quantity,bar_length_m,weight_kg_m,line_meters,line_tonnes
) values
 ('00000000-0000-0000-0000-000000023331','00000000-0000-0000-0000-000000023311',1,'RHS 200x100x6','EN 10219','S355J2H','bars',20,6,25,120,3),
 ('00000000-0000-0000-0000-000000023332','00000000-0000-0000-0000-000000023311',2,'CHS 168.3x6.3','EN 10210','S355J2H','bars',20,6,25,120,3),
 ('00000000-0000-0000-0000-000000023333','00000000-0000-0000-0000-000000023312',1,'DEMO producer supply','EN 10219','S355J2H','bars',20,6,25,120,3),
 ('00000000-0000-0000-0000-000000023334','00000000-0000-0000-0000-000000023313',1,'DEMO trader supply','EN 10210','S355J2H','bars',20,6,25,120,3),
 ('00000000-0000-0000-0000-000000023335','00000000-0000-0000-0000-000000023314',1,'DEMO service process','EN 10219','S235JRH','bars',20,6,25,120,3);

insert into public.buyer_rfq_campaigns(
 id,owner_user_id,organization_id,source_distinta_id,title,status,due_at
) values
 ('00000000-0000-0000-0000-000000023321',:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000023301','00000000-0000-0000-0000-000000023311','DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219','draft',now()+interval '14 days'),
 ('00000000-0000-0000-0000-000000023322',:'producer_user_id'::uuid,'00000000-0000-0000-0000-000000023302','00000000-0000-0000-0000-000000023312','DEMOTEST23 PRODUCER PRIVATE RFQ','draft',now()+interval '14 days'),
 ('00000000-0000-0000-0000-000000023323',:'trader_user_id'::uuid,'00000000-0000-0000-0000-000000023303','00000000-0000-0000-0000-000000023313','DEMOTEST23 TRADER PRIVATE RFQ','draft',now()+interval '14 days'),
 ('00000000-0000-0000-0000-000000023324',:'processor_user_id'::uuid,'00000000-0000-0000-0000-000000023304','00000000-0000-0000-0000-000000023314','DEMOTEST23 PROCESSOR PRIVATE RFQ','draft',now()+interval '14 days');

-- Platform Owner identity is strictly synthetic and exists ONLY in this throwaway DB.
-- Existing one-owner partial unique index remains intact; no hosted environment is touched.
insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
values (:'owner_user_id'::uuid,'platform_superadmin','active',null,'PERF1 local Chrome acceptance');

do $$
begin
 if (select count(*) from public.platform_user_roles where role='platform_superadmin' and status='active') <> 1 then
  raise exception 'PERF1 expected a single synthetic platform owner';
 end if;
 if (select count(*) from public.organizations where slug like 'dt23-%') <> 4 then
  raise exception 'PERF1: expected exactly four organizations';
 end if;
 if (select count(*) from public.organization_memberships m
     join public.organizations o on o.id=m.organization_id
     where o.slug like 'dt23-%') <> 5 then
  raise exception 'PERF1: expected five real login memberships';
 end if;
 if (select count(distinct standard_code) from public.buyer_distinta_lines
     where distinta_id='00000000-0000-0000-0000-000000023311') <> 2 then
  raise exception 'PERF1: buyer RFQ must mix two standards';
 end if;
end $$;
commit;
select 'PERF1 local-only Chrome fixtures seeded: 4 organizations, 6 GoTrue users (5 tenant + 1 owner), 4 private RFQs' as result;
