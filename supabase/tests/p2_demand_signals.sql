-- P2.2 Demand Signal Foundation acceptance.
begin;

create or replace function pg_temp.p22_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P2.2 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.p22_assert(
  not has_function_privilege('anon','public.p2_demand_signals(uuid,integer,integer,integer)','EXECUTE'),
  'anonymous role must not execute demand signals'
);

select pg_temp.p22_assert(
  has_function_privilege('authenticated','public.p2_demand_signals(uuid,integer,integer,integer)','EXECUTE'),
  'authenticated role must execute demand signals'
);

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000022a1','p22@example.com'),
('00000000-0000-0000-0000-0000000022b1','p22-other@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
('00000000-0000-0000-0000-0000000022f1','P22 Org','p22-org','00000000-0000-0000-0000-0000000022a1','completed'),
('00000000-0000-0000-0000-0000000022f2','P22 Other','p22-other','00000000-0000-0000-0000-0000000022b1','completed');

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values
('00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-0000000022a1','admin','sales_director','active',true),
('00000000-0000-0000-0000-0000000022f2','00000000-0000-0000-0000-0000000022b1','admin','sales_director','active',true);

insert into public.companies(id,owner_id,organization_id,name,company_type,country) values
('00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','Account A','customer','IT'),
('00000000-0000-0000-0000-000000002202','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','Account B','customer','DE'),
('00000000-0000-0000-0000-000000002205','00000000-0000-0000-0000-0000000022b1','00000000-0000-0000-0000-0000000022f2','Other Tenant','customer','AT');

insert into public.rfqs(id,owner_id,organization_id,company_id,requested_at,status,priority) values
('00000000-0000-0000-0000-000000002211','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002201',now()-interval '5 days','qualified','normal'),
('00000000-0000-0000-0000-000000002212','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002201',now()-interval '12 days','quoted','normal'),
('00000000-0000-0000-0000-000000002213','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002202',now()-interval '18 days','qualified','normal'),
('00000000-0000-0000-0000-000000002214','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1',null,now()-interval '8 days','qualified','normal'),
('00000000-0000-0000-0000-000000002215','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1',null,now()-interval '15 days','qualified','normal'),
('00000000-0000-0000-0000-000000002216','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002201',now()-interval '120 days','qualified','normal'),
('00000000-0000-0000-0000-000000002219','00000000-0000-0000-0000-0000000022b1','00000000-0000-0000-0000-0000000022f2','00000000-0000-0000-0000-000000002205',now()-interval '4 days','qualified','normal');

insert into public.rfq_lines(
  id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,requested_standard,
  canonical_product_id,canonical_product_key,raw_spec_text
) values
('00000000-0000-0000-0000-000000002221','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002211',10,'T','S355J2H','EN10219','00000000-0000-0000-0000-0000000022c1','tube:v1|family=round_tube|grade=s355j2h|standard=en10219|geom=od:219.1|t=10','EN 10219 S355J2H 219.1x10'),
('00000000-0000-0000-0000-000000002222','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002212',20,'PZ','S355J2H','EN10219','00000000-0000-0000-0000-0000000022c1','tube:v1|family=round_tube|grade=s355j2h|standard=en10219|geom=od:219.1|t=10','EN 10219 S355J2H 219.1x10'),
('00000000-0000-0000-0000-000000002223','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002213',5,'T','S355J2H','EN10219','00000000-0000-0000-0000-0000000022c1','tube:v1|family=round_tube|grade=s355j2h|standard=en10219|geom=od:219.1|t=10','EN 10219 S355J2H 219.1x10'),
('00000000-0000-0000-0000-000000002224','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002214',7,'T','S235','EN10219','00000000-0000-0000-0000-0000000022c2','tube:v1|family=square_tube|grade=s235|standard=en10219|geom=100x100|t=5','EN 10219 S235 100x100x5'),
('00000000-0000-0000-0000-000000002225','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002215',9,'T','S235','EN10219','00000000-0000-0000-0000-0000000022c2','tube:v1|family=square_tube|grade=s235|standard=en10219|geom=100x100|t=5','EN 10219 S235 100x100x5'),
('00000000-0000-0000-0000-000000002226','00000000-0000-0000-0000-0000000022a1','00000000-0000-0000-0000-0000000022f1','00000000-0000-0000-0000-000000002216',100,'T','S355','EN10219','00000000-0000-0000-0000-0000000022c3','tube:v1|family=round_tube|grade=s355|standard=en10219|geom=od:273|t=8','Old request'),
('00000000-0000-0000-0000-000000002229','00000000-0000-0000-0000-0000000022b1','00000000-0000-0000-0000-0000000022f2','00000000-0000-0000-0000-000000002219',3,'T','S355','EN10219','00000000-0000-0000-0000-0000000022c1','tube:v1|family=round_tube|grade=s355j2h|standard=en10219|geom=od:219.1|t=10','Other tenant request');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000022a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p22_assert(
  (public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>>'{summary,signal_count}')::int=2,
  'one repeated-account and one multi-account signal must surface'
);

select pg_temp.p22_assert(
  public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>>'{signals,0,signal_type}'='multi_account'
  and public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>>'{signals,0,distinct_company_count}'='2',
  'multi-account demand must rank first and require two companies'
);

select pg_temp.p22_assert(
  public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>>'{signals,1,signal_type}'='repeated_account'
  and public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>>'{signals,1,company_name}'='Account A'
  and public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>>'{signals,1,distinct_rfq_count}'='2',
  'repeated account demand must require two distinct RFQs for the same company and product'
);

select pg_temp.p22_assert(
  jsonb_array_length(public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>'{signals,1,quantity_summaries}')=2,
  'mixed units must remain separate quantity summaries'
);

select pg_temp.p22_assert(
  jsonb_array_length(public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>'{signals,1,evidence}')=2,
  'repeated-account evidence must preserve the two RFQs that established the signal'
);

select pg_temp.p22_assert(
  (public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',30,100,0)#>>'{summary,unattributed_rfq_count}')::int=2,
  'unattributed RFQs must be visible in data quality but must not create account signals'
);

select pg_temp.p22_assert(
  (public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',90,100,0)#>>'{summary,distinct_rfq_count}')::int=5,
  '90-day window must exclude 120-day evidence'
);

select pg_temp.p22_assert(
  (public.p2_demand_signals('00000000-0000-0000-0000-0000000022f2',30,100,0)#>>'{summary,normalized_line_count}')::int=0,
  'cross-tenant organization must remain invisible'
);

select pg_temp.p22_assert(
  public.p2_demand_signals('00000000-0000-0000-0000-0000000022f1',60,100,0)#>>'{policy,window_days}'='30',
  'unsupported window must normalize to 30 days'
);

reset role;
rollback;
