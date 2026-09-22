-- PA2.16 controlled RFQ backlog promotion acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.16 assertion failed: %',message; end if;
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
  raise exception 'Expected failure: %',expected_fragment;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000031a1','pa216@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values('00000000-0000-0000-0000-0000000031f1','PA216 Org','pa216-org',
'00000000-0000-0000-0000-0000000031a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values('00000000-0000-0000-0000-0000000031f1',
'00000000-0000-0000-0000-0000000031a1','admin','sales_director','active',true);

insert into public.commercial_datasets(id,owner_id,source_run_id,source_filename,organization_id)
values('00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-0000000031a1',
'00000000-0000-0000-0000-000000003111','pa216.eml','00000000-0000-0000-0000-0000000031f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
('00000000-0000-0000-0000-000000003121','00000000-0000-0000-0000-0000000031a1','00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003131','ready','rfq',now(),'00000000-0000-0000-0000-0000000031f1'),
('00000000-0000-0000-0000-000000003122','00000000-0000-0000-0000-0000000031a1','00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003132','blocked','rfq',now(),'00000000-0000-0000-0000-0000000031f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values
(31001,'00000000-0000-0000-0000-0000000031a1','00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003121','00000000-0000-0000-0000-000000003131','requested','inbound','round_tube','S355',273,8,12000,20,'T','pa216.eml','273x8 12000 20 ton',0.96,'273x8','00000000-0000-0000-0000-0000000031f1'),
(31002,'00000000-0000-0000-0000-0000000031a1','00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003122','00000000-0000-0000-0000-000000003132','requested','inbound','round_tube','S355',323.9,8,null,20,'T','pa216.eml','323.9x8 20 ton',0.96,'323.9x8','00000000-0000-0000-0000-0000000031f1');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000031a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p1_promote_ready_rfq_observation(
'00000000-0000-0000-0000-0000000031f1',31001) as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='promoted'
  and :'first_result'::jsonb->>'execution_mode'='single_explicit'
  and (select count(*) from public.rfq_lines where source_observation_id=31001)=1
  and (select count(*) from public.current_commercial_entity_promotions where observation_id=31001 and entity_type='rfq_line' and status='applied')=1,
  'ready observation must create exactly one normalized RFQ line and ledger link'
);

select public.p1_promote_ready_rfq_observation(
'00000000-0000-0000-0000-0000000031f1',31001) as second_result \gset

select pg_temp.assert_true(
  :'second_result'::jsonb->>'status'='already_promoted'
  and :'second_result'::jsonb->>'rfq_line_id'=:'first_result'::jsonb->>'rfq_line_id'
  and (select count(*) from public.rfq_lines where source_observation_id=31001)=1,
  'repeat explicit promotion must be idempotent'
);

select pg_temp.assert_raises(
  $$select public.p1_promote_ready_rfq_observation('00000000-0000-0000-0000-0000000031f1',31002)$$,
  'not PA2.15 ready'
);

select pg_temp.assert_true(
  (select count(*) from public.rfq_lines where source_observation_id=31002)=0,
  'blocked observation must create no business entity'
);

reset role;
rollback;
