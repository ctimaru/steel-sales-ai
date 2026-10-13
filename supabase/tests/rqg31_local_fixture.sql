-- RQG3.1 Chrome + PostgREST acceptance. RUN ONLY ON THROWAWAY LOCAL SUPABASE.
-- Preconditions: perf1_chrome_seed.sql and rqg31-seed-auth.mjs.
\set ON_ERROR_STOP on
begin;

-- Separate Platform roles (never company memberships).
insert into public.platform_staff(user_id,status)
values
 (:'claimsStaff_user_id'::uuid,'active'),
 (:'trustStaff_user_id'::uuid,'active'),
 (:'auditor_user_id'::uuid,'active');
insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values
 (:'claimsStaff_user_id'::uuid,'claims_verification_admin','active',:'owner_user_id'::uuid,'RQG3.1 disposable Claims reviewer'),
 (:'trustStaff_user_id'::uuid,'network_trust_admin','active',:'owner_user_id'::uuid,'RQG3.1 disposable Trust reviewer'),
 (:'auditor_user_id'::uuid,'platform_auditor','active',:'owner_user_id'::uuid,'RQG3.1 read-only auditor');

-- Two unrelated companies; private evidence is never sourced from production.
insert into public.commercial_datasets(id,owner_id,source_run_id,source_filename,organization_id)
values
 ('00000000-0000-0000-0000-000000031101',:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000031111','rqg31-a.eml','00000000-0000-0000-0000-000000023301'),
 ('00000000-0000-0000-0000-000000031102',:'trader_user_id'::uuid,'00000000-0000-0000-0000-000000031112','rqg31-b.eml','00000000-0000-0000-0000-000000023303');

insert into public.commercial_threads(id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id)
values
 ('00000000-0000-0000-0000-000000031121',:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000031101','00000000-0000-0000-0000-000000031131','RQG31 PRIVATE A THREAD','offer',now(),'00000000-0000-0000-0000-000000023301'),
 ('00000000-0000-0000-0000-000000031122',:'trader_user_id'::uuid,'00000000-0000-0000-0000-000000031102','00000000-0000-0000-0000-000000031132','RQG31 PRIVATE B THREAD','offer',now(),'00000000-0000-0000-0000-000000023303');

insert into public.commercial_observations(
 id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
 product_type,grade,standard,outer_diameter_mm,thickness_mm,length_mm,
 quantity,quantity_unit,price_value,price_unit,currency,availability_status,
 source_filename,source_text,confidence,search_text,organization_id
) values
 (98031,:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000031101','00000000-0000-0000-0000-000000031121','00000000-0000-0000-0000-000000031131','offered','outbound','round_tube','P235GH','EN 10216-2',168.3,7.11,12000,10,'PZ',900,'T','EUR','available','rqg31-a.eml','RQG31 ORIGINAL A CONFIRM',0.90,'rqg31 a confirm','00000000-0000-0000-0000-000000023301'),
 (98032,:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000031101','00000000-0000-0000-0000-000000031121','00000000-0000-0000-0000-000000031131','offered','outbound','round_tube','P235GH','EN 10216-2',168.3,7.11,12000,10,'PZ',900,'T','EUR','available','rqg31-a.eml','RQG31 ORIGINAL A CORRECT',0.90,'rqg31 a correct','00000000-0000-0000-0000-000000023301'),
 (98033,:'trader_user_id'::uuid,'00000000-0000-0000-0000-000000031102','00000000-0000-0000-0000-000000031122','00000000-0000-0000-0000-000000031132','offered','outbound','round_tube','P235GH','EN 10216-2',168.3,7.11,12000,10,'PZ',900,'T','EUR','available','rqg31-b.eml','RQG31 ORIGINAL B CONFIRM',0.90,'rqg31 b confirm','00000000-0000-0000-0000-000000023303'),
 (98034,:'trader_user_id'::uuid,'00000000-0000-0000-0000-000000031102','00000000-0000-0000-0000-000000031122','00000000-0000-0000-0000-000000031132','offered','outbound','round_tube','P235GH','EN 10216-2',168.3,7.11,12000,10,'PZ',900,'T','EUR','available','rqg31-b.eml','RQG31 ORIGINAL B CORRECT',0.90,'rqg31 b correct','00000000-0000-0000-0000-000000023303');

insert into public.commercial_review_queue(
 id,owner_id,dataset_id,thread_id,source_review_id,reason,severity,source_text,status,observation_id,organization_id
) values
 (98031,:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000031101','00000000-0000-0000-0000-000000031121',98031,'manual_check','warning','RQG31 PRIVATE A CONFIRM','pending',98031,'00000000-0000-0000-0000-000000023301'),
 (98032,:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000031101','00000000-0000-0000-0000-000000031121',98032,'grade_conflict','warning','RQG31 PRIVATE A CORRECT','pending',98032,'00000000-0000-0000-0000-000000023301'),
 (98033,:'trader_user_id'::uuid,'00000000-0000-0000-0000-000000031102','00000000-0000-0000-0000-000000031122',98033,'manual_check','warning','RQG31 PRIVATE B CONFIRM','pending',98033,'00000000-0000-0000-0000-000000023303'),
 (98034,:'trader_user_id'::uuid,'00000000-0000-0000-0000-000000031102','00000000-0000-0000-0000-000000031122',98034,'grade_conflict','warning','RQG31 PRIVATE B CORRECT','pending',98034,'00000000-0000-0000-0000-000000023303');

do $$
begin
 if (select count(*) from public.commercial_review_queue where id between 98031 and 98034)<>4 then
   raise exception 'RQG3.1: four isolated review records required';
 end if;
 if (select count(*) from public.platform_user_roles where role='platform_superadmin' and status='active')<>1 then
   raise exception 'RQG3.1: must preserve exactly one synthetic owner';
 end if;
 if (select count(*) from public.platform_staff where status='active')<>4 then
   raise exception 'RQG3.1: expected four isolated active staff';
 end if;
end $$;
commit;
select 'RQG3.1 disposable multi-role fixtures created; no hosted data' as result;
