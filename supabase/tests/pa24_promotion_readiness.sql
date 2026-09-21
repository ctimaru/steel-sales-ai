-- PA2.4 promotion readiness acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.4 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000029a1','pa24@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000029f1','PA24 Org','pa24-org',
'00000000-0000-0000-0000-0000000029a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000029f1',
'00000000-0000-0000-0000-0000000029a1',
'admin','sales_director','active',true);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000002901',
'00000000-0000-0000-0000-0000000029a1',
'00000000-0000-0000-0000-000000002911',
'pa24.eml',
'00000000-0000-0000-0000-0000000029f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
('00000000-0000-0000-0000-000000002921','00000000-0000-0000-0000-0000000029a1','00000000-0000-0000-0000-000000002901','00000000-0000-0000-0000-000000002931','ready','rfq',now(),'00000000-0000-0000-0000-0000000029f1'),
('00000000-0000-0000-0000-000000002922','00000000-0000-0000-0000-0000000029a1','00000000-0000-0000-0000-000000002901','00000000-0000-0000-0000-000000002932','blocked','rfq',now(),'00000000-0000-0000-0000-0000000029f1'),
('00000000-0000-0000-0000-000000002923','00000000-0000-0000-0000-0000000029a1','00000000-0000-0000-0000-000000002901','00000000-0000-0000-0000-000000002933','multi','rfq',now(),'00000000-0000-0000-0000-0000000029f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values
(29001,'00000000-0000-0000-0000-0000000029a1','00000000-0000-0000-0000-000000002901','00000000-0000-0000-0000-000000002921','00000000-0000-0000-0000-000000002931','requested','inbound','round_tube','S355',273,8,12000,2,'PACCHI','pa24.eml','S355 273x8 12000 2 pacchi',0.95,'s355 273x8 12000','00000000-0000-0000-0000-0000000029f1'),
(29002,'00000000-0000-0000-0000-0000000029a1','00000000-0000-0000-0000-000000002901','00000000-0000-0000-0000-000000002922','00000000-0000-0000-0000-000000002932','requested','inbound','round_tube','S355',323.9,8,null,null,null,'pa24.eml','incomplete',0.70,'s355 323.9x8','00000000-0000-0000-0000-0000000029f1'),
(29003,'00000000-0000-0000-0000-0000000029a1','00000000-0000-0000-0000-000000002901','00000000-0000-0000-0000-000000002923','00000000-0000-0000-0000-000000002933','requested','inbound','round_tube','S355',406.4,8,12000,1,'PZ','pa24.eml','multi 1',0.96,'s355 406.4x8','00000000-0000-0000-0000-0000000029f1'),
(29004,'00000000-0000-0000-0000-0000000029a1','00000000-0000-0000-0000-000000002901','00000000-0000-0000-0000-000000002923','00000000-0000-0000-0000-000000002933','requested','inbound','round_tube','S355',508,10,12000,1,'PZ','pa24.eml','multi 2',0.96,'s355 508x10','00000000-0000-0000-0000-0000000029f1');

select pg_temp.assert_true(
  (public.p1_promotion_readiness('00000000-0000-0000-0000-0000000029f1',100)#>>'{summary,ready}')::int=1,
  'exactly one candidate should be curated ready'
);

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(public.p1_promotion_readiness('00000000-0000-0000-0000-0000000029f1',100)->'candidates') x
    where (x->>'observation_id')::bigint=29001 and x->>'readiness_status'='ready'
  ),
  'complete single-line request must be ready'
);

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(public.p1_promotion_readiness('00000000-0000-0000-0000-0000000029f1',100)->'candidates') x
    where (x->>'observation_id')::bigint=29002
      and x->>'readiness_status'='blocked'
      and x->'reasons' ? 'low_confidence'
      and x->'reasons' ? 'missing_quantity'
      and x->'reasons' ? 'missing_length'
  ),
  'incomplete request must expose blocker reasons'
);

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(public.p1_promotion_readiness('00000000-0000-0000-0000-0000000029f1',100)->'candidates') x
    where (x->>'observation_id')::bigint=29003
      and x->>'readiness_status'='blocked'
      and x->'reasons' ? 'multi_line_thread'
  ),
  'multi-line thread must not be curated ready'
);

rollback;
