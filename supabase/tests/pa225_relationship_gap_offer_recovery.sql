-- PA2.25 relationship gap + shadow duplicate Offer recovery acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.25 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000038a1','pa225@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000038f1','PA225 Org','pa225-org',
'00000000-0000-0000-0000-0000000038a1','completed'
);

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000038f1',
'00000000-0000-0000-0000-0000000038a1',
'admin','sales_director','active',true
);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000003801',
'00000000-0000-0000-0000-0000000038a1',
'00000000-0000-0000-0000-000000003811',
'pa225.eml',
'00000000-0000-0000-0000-0000000038f1'
);

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,started_at,last_activity_at,email_count,organization_id
) values
(
'00000000-0000-0000-0000-000000003821',
'00000000-0000-0000-0000-0000000038a1',
'00000000-0000-0000-0000-000000003801',
'00000000-0000-0000-0000-000000003831',
'Safe shadow recovery','offer',now(),now(),1,
'00000000-0000-0000-0000-0000000038f1'
),
(
'00000000-0000-0000-0000-000000003822',
'00000000-0000-0000-0000-0000000038a1',
'00000000-0000-0000-0000-000000003801',
'00000000-0000-0000-0000-000000003832',
'Unsafe unique incomplete','offer',now(),now(),1,
'00000000-0000-0000-0000-0000000038f1'
);

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status
) values
(
'00000000-0000-0000-0000-000000003841',
'00000000-0000-0000-0000-0000000038a1',
'00000000-0000-0000-0000-0000000038f1',
'Safe shadow recovery','00000000-0000-0000-0000-000000003831','open'
),
(
'00000000-0000-0000-0000-000000003842',
'00000000-0000-0000-0000-0000000038a1',
'00000000-0000-0000-0000-0000000038f1',
'Unsafe unique incomplete','00000000-0000-0000-0000-000000003832','open'
);

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,quantity,quantity_unit,
price_value,price_unit,currency,source_filename,source_text,confidence,search_text,
organization_id,canonical_product_key,canonical_product_id
) values
(38001,'00000000-0000-0000-0000-0000000038a1','00000000-0000-0000-0000-000000003801',
 '00000000-0000-0000-0000-000000003821','00000000-0000-0000-0000-000000003831',
 'offered','outbound','round_tube','S355',193.7,10,25,'T',40.77,'M','EUR',
 'pa225.eml','193,7x10 25 ton -- €mt 40,77',0.98,'offer',
 '00000000-0000-0000-0000-0000000038f1','tube:v1|od=193.7|t=10','00000000-0000-0000-0000-000000003851'),
(38002,'00000000-0000-0000-0000-0000000038a1','00000000-0000-0000-0000-000000003801',
 '00000000-0000-0000-0000-000000003821','00000000-0000-0000-0000-000000003831',
 'offered','outbound','round_tube','S355',193.7,10,25,'T',null,null,null,
 'pa225.eml','193,7x10 25 ton',0.98,'offer shadow',
 '00000000-0000-0000-0000-0000000038f1','tube:v1|od=193.7|t=10','00000000-0000-0000-0000-000000003851'),
(38003,'00000000-0000-0000-0000-0000000038a1','00000000-0000-0000-0000-000000003801',
 '00000000-0000-0000-0000-000000003822','00000000-0000-0000-0000-000000003832',
 'offered','outbound','round_tube','S355',273,8,10,'T',20,'M','EUR',
 'pa225.eml','273x8 10 ton -- €mt 20',0.98,'offer',
 '00000000-0000-0000-0000-0000000038f1','tube:v1|od=273|t=8','00000000-0000-0000-0000-000000003852'),
(38004,'00000000-0000-0000-0000-0000000038a1','00000000-0000-0000-0000-000000003801',
 '00000000-0000-0000-0000-000000003822','00000000-0000-0000-0000-000000003832',
 'offered','outbound','round_tube','S355',323.9,8,5,'T',null,null,null,
 'pa225.eml','323,9x8 5 ton no price',0.98,'unique incomplete',
 '00000000-0000-0000-0000-0000000038f1','tube:v1|od=323.9|t=8','00000000-0000-0000-0000-000000003853');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000038a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_relationship_gap_offer_recovery_audit(
    '00000000-0000-0000-0000-0000000038f1',100
  )#>>'{offer_gap,safe_subset_recovery_ready}')::int=1,
  'exactly one safe shadow duplicate recovery must be ready'
);

select public.p1_recover_shadow_duplicate_offer(
  '00000000-0000-0000-0000-0000000038f1',
  '00000000-0000-0000-0000-000000003821'
) as result \gset

select pg_temp.assert_true(
  :'result'::jsonb->>'status'='recovered',
  'safe shadow duplicate thread must recover'
);

select pg_temp.assert_true(
  (select count(*) from public.offers where organization_id='00000000-0000-0000-0000-0000000038f1')=1
  and (select count(*) from public.offer_lines where organization_id='00000000-0000-0000-0000-0000000038f1')=1,
  'recovery must create one Offer and only the complete priced line'
);

select pg_temp.assert_true(
  (select count(*) from public.current_commercial_entity_promotions
   where organization_id='00000000-0000-0000-0000-0000000038f1'
     and entity_type='offer_line' and status='applied')=1
  and not exists (
    select 1 from public.current_commercial_entity_promotions
    where organization_id='00000000-0000-0000-0000-0000000038f1'
      and observation_id=38002 and entity_type='offer_line' and status='applied'
  ),
  'shadow evidence must remain unpromoted'
);

select pg_temp.assert_true(
  (select retained_evidence_observation_ids from public.commercial_offer_recoveries
   where organization_id='00000000-0000-0000-0000-0000000038f1')
   = array[38002]::bigint[],
  'audit must record retained shadow evidence'
);

select public.p1_recover_shadow_duplicate_offer(
  '00000000-0000-0000-0000-0000000038f1',
  '00000000-0000-0000-0000-000000003821'
) as repeat_result \gset

select pg_temp.assert_true(
  :'repeat_result'::jsonb->>'status'='already_recovered'
  and (select count(*) from public.commercial_offer_recoveries
       where organization_id='00000000-0000-0000-0000-0000000038f1')=1,
  'recovery must be idempotent'
);

select pg_temp.assert_true(
  (public.p1_recover_shadow_duplicate_offer(
    '00000000-0000-0000-0000-0000000038f1',
    '00000000-0000-0000-0000-000000003822'
  )->>'status')='blocked',
  'thread with unique incomplete product evidence must remain blocked'
);

rollback;
