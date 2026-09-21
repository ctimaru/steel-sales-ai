-- PA2.3 controlled promotion read-model bridge acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.3 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000027a1','pa23@bridge.example');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000027f1',
'PA23 Org','pa23-org',
'00000000-0000-0000-0000-0000000027a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000027f1',
'00000000-0000-0000-0000-0000000027a1',
'admin','sales_director','active',true);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000002701',
'00000000-0000-0000-0000-0000000027a1',
'00000000-0000-0000-0000-000000002711',
'pa23.eml',
'00000000-0000-0000-0000-0000000027f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
(
'00000000-0000-0000-0000-000000002721',
'00000000-0000-0000-0000-0000000027a1',
'00000000-0000-0000-0000-000000002701',
'00000000-0000-0000-0000-000000002731',
'Promoted S355 273x8','rfq','2026-09-21T16:00:00Z',
'00000000-0000-0000-0000-0000000027f1'
),
(
'00000000-0000-0000-0000-000000002722',
'00000000-0000-0000-0000-0000000027a1',
'00000000-0000-0000-0000-000000002701',
'00000000-0000-0000-0000-000000002732',
'Fallback S355 323x8','rfq','2026-09-21T16:05:00Z',
'00000000-0000-0000-0000-0000000027f1'
);

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values
(
27001,
'00000000-0000-0000-0000-0000000027a1',
'00000000-0000-0000-0000-000000002701',
'00000000-0000-0000-0000-000000002721',
'00000000-0000-0000-0000-000000002731',
'requested','inbound','round_tube','S355',273,8,12000,2,'PACCHI',
'pa23.eml','S355 273x8 12000 promoted',0.95,'s355 273x8 12000 promoted',
'00000000-0000-0000-0000-0000000027f1'
),
(
27002,
'00000000-0000-0000-0000-0000000027a1',
'00000000-0000-0000-0000-000000002701',
'00000000-0000-0000-0000-000000002722',
'00000000-0000-0000-0000-000000002732',
'requested','inbound','round_tube','S355',323,8,12000,1,'PACCHI',
'pa23.eml','S355 323x8 12000 fallback',0.94,'s355 323x8 12000 fallback',
'00000000-0000-0000-0000-0000000027f1'
);

insert into public.rfqs(
id,owner_id,organization_id,assigned_to_user_id,created_by_user_id,requested_at,status,priority
) values(
'00000000-0000-0000-0000-000000002741',
'00000000-0000-0000-0000-0000000027a1',
'00000000-0000-0000-0000-0000000027f1',
'00000000-0000-0000-0000-0000000027a1',
'00000000-0000-0000-0000-0000000027a1',
now(),'new','normal');

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,
min_length_mm,max_length_mm,source_observation_id,raw_spec_text,
canonical_product_id,canonical_product_key
) select
'00000000-0000-0000-0000-000000002742',
o.owner_id,o.organization_id,
'00000000-0000-0000-0000-000000002741',
o.quantity,o.quantity_unit,o.grade,o.length_mm,o.length_mm,o.id,o.source_text,
o.canonical_product_id,o.canonical_product_key
from public.commercial_observations o
where o.id=27001;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000027a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
'00000000-0000-0000-0000-0000000027f1',
27001,'rfq_line',
'00000000-0000-0000-0000-000000002742',
null,'created','applied',0.95,'deterministic_match',null,null,
'{"phase":"PA2.3"}'::jsonb
);

reset role;

select pg_temp.assert_true(
not has_function_privilege(
'authenticated',
'public.p1_global_structured_search_bridge(uuid,text,text[],jsonb,integer)',
'EXECUTE'),
'browser must not execute read bridge directly');

select pg_temp.assert_true(
has_function_privilege(
'service_role',
'public.p1_global_structured_search_bridge(uuid,text,text[],jsonb,integer)',
'EXECUTE'),
'service role must execute read bridge');

select pg_temp.assert_true(
(
  public.p1_global_structured_search_bridge(
    '00000000-0000-0000-0000-0000000027f1',
    'S355 273x8 12000',
    array['rfq'],
    '{}'::jsonb,
    50
  )->>'total'
)::int=1,
'promoted observation must yield exactly one RFQ result'
);

select pg_temp.assert_true(
(
  public.p1_global_structured_search_bridge(
    '00000000-0000-0000-0000-0000000027f1',
    'S355 273x8 12000',
    array['rfq'],
    '{}'::jsonb,
    50
  ) #>> '{results,0,metadata,source_model}'
)='normalized_promoted',
'promoted result must come from normalized read model'
);

select pg_temp.assert_true(
(
  public.p1_global_structured_search_bridge(
    '00000000-0000-0000-0000-0000000027f1',
    'S355 273x8 12000',
    array['rfq'],
    '{}'::jsonb,
    50
  ) #>> '{results,0,metadata,observation_id}'
)::bigint=27001,
'normalized result must preserve source observation lineage'
);

select pg_temp.assert_true(
(
  public.p1_global_structured_search_bridge(
    '00000000-0000-0000-0000-0000000027f1',
    'S355 323x8 12000',
    array['rfq'],
    '{}'::jsonb,
    50
  )->>'total'
)::int=1,
'unpromoted observation must remain available through fallback'
);

select pg_temp.assert_true(
(
  public.p1_global_structured_search_bridge(
    '00000000-0000-0000-0000-0000000027f1',
    'S355 323x8 12000',
    array['rfq'],
    '{}'::jsonb,
    50
  ) #>> '{results,0,metadata,source_model}'
) is null,
'fallback result must remain the legacy observation model'
);

rollback;
