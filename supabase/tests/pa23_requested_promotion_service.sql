-- PA2.3 controlled requested promotion service acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.3 promotion assertion failed: %',message; end if;
end;
$$;

create or replace function pg_temp.assert_raises(statement text, expected_fragment text)
returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then raise; end if;
    return;
  end;
  raise exception 'Expected failure: %', expected_fragment;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000028a1','pa23-service@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000028f1','PA23 Service','pa23-service',
'00000000-0000-0000-0000-0000000028a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000028f1',
'00000000-0000-0000-0000-0000000028a1',
'admin','sales_director','active',true);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000002801',
'00000000-0000-0000-0000-0000000028a1',
'00000000-0000-0000-0000-000000002811',
'pa23-service.eml',
'00000000-0000-0000-0000-0000000028f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
'00000000-0000-0000-0000-000000002821',
'00000000-0000-0000-0000-0000000028a1',
'00000000-0000-0000-0000-000000002801',
'00000000-0000-0000-0000-000000002831',
'PA23 service fixture','rfq',now(),
'00000000-0000-0000-0000-0000000028f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values
(
28001,'00000000-0000-0000-0000-0000000028a1',
'00000000-0000-0000-0000-000000002801',
'00000000-0000-0000-0000-000000002821',
'00000000-0000-0000-0000-000000002831',
'requested','inbound','round_tube','S355',273,8,12000,2,'PACCHI',
'pa23-service.eml','S355 273x8 12000 2 pacchi',0.95,'s355 273x8 12000',
'00000000-0000-0000-0000-0000000028f1'
),
(
28002,'00000000-0000-0000-0000-0000000028a1',
'00000000-0000-0000-0000-000000002801',
'00000000-0000-0000-0000-000000002821',
'00000000-0000-0000-0000-000000002831',
'requested','inbound','round_tube','S355',323.9,8,12000,1,'PZ',
'pa23-service.eml','low confidence',0.70,'s355 323.9x8',
'00000000-0000-0000-0000-0000000028f1'
),
(
28003,'00000000-0000-0000-0000-0000000028a1',
'00000000-0000-0000-0000-000000002801',
'00000000-0000-0000-0000-000000002821',
'00000000-0000-0000-0000-000000002831',
'requested','inbound','round_tube','S355',406.4,8,12000,1,'PZ',
'pa23-service.eml','pending review',0.96,'s355 406.4x8',
'00000000-0000-0000-0000-0000000028f1'
);

insert into public.commercial_review_queue(
id,owner_id,dataset_id,thread_id,source_review_id,reason,severity,source_text,status,
observation_id,organization_id
) values(
28003,
'00000000-0000-0000-0000-0000000028a1',
'00000000-0000-0000-0000-000000002801',
'00000000-0000-0000-0000-000000002821',
28003,'manual_check','warning','pending review','pending',
28003,'00000000-0000-0000-0000-0000000028f1'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000028a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.promote_requested_observation(28001) as first_result \gset

select pg_temp.assert_true(
:'first_result'::jsonb->>'status'='promoted'
and (select count(*) from public.rfqs)=1
and (select count(*) from public.rfq_lines)=1
and (select count(*) from public.commercial_entity_promotions where observation_id=28001)=1,
'eligible request must atomically create RFQ, line and promotion');

select public.promote_requested_observation(28001) as second_result \gset

select pg_temp.assert_true(
:'second_result'::jsonb->>'status'='already_promoted'
and (select count(*) from public.rfqs)=1
and (select count(*) from public.rfq_lines)=1,
'repeat must be idempotent');

select pg_temp.assert_raises(
'select public.promote_requested_observation(28002)',
'Observation confidence below promotion threshold'
);

select pg_temp.assert_raises(
'select public.promote_requested_observation(28003)',
'Pending review blocks promotion'
);

reset role;
rollback;
