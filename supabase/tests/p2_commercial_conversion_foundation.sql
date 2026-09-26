-- P2.5 Commercial Outcome Attribution & Conversion Foundation acceptance.
begin;

create or replace function pg_temp.p25_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P2.5 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000025a1','p25@example.com'),
('00000000-0000-0000-0000-0000000025b1','p25-other@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
('00000000-0000-0000-0000-0000000025f1','P25 Org','p25-org','00000000-0000-0000-0000-0000000025a1','completed'),
('00000000-0000-0000-0000-0000000025f2','P25 Other','p25-other','00000000-0000-0000-0000-0000000025b1','completed');

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values
('00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-0000000025a1','admin','sales_director','active',true),
('00000000-0000-0000-0000-0000000025f2','00000000-0000-0000-0000-0000000025b1','admin','sales_director','active',true);

insert into public.companies(
  id,owner_id,organization_id,name,company_type,country,vat_number
) values
('00000000-0000-0000-0000-000000002501','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','Verified A','customer','IT','IT25000000001'),
('00000000-0000-0000-0000-000000002502','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','Verified B','customer','DE','DE25000000002');

insert into public.commercial_company_identity_verifications(
  organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values
('00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002501','vat_number','IT25000000001','vat_document','00000000-0000-0000-0000-0000000025a1'),
('00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002502','vat_number','DE25000000002','vat_document','00000000-0000-0000-0000-0000000025a1');

insert into public.conversations(
  id,owner_id,organization_id,company_id,subject,external_thread_id,status
) values
('00000000-0000-0000-0000-000000002511','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002501','Converted chain','p25-chain','open'),
('00000000-0000-0000-0000-000000002512','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002502','Relationship gap','p25-gap','open'),
('00000000-0000-0000-0000-000000002513','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002501','Conflict source','p25-conflict','open');

insert into public.rfqs(
  id,owner_id,organization_id,conversation_id,company_id,requested_at,status,priority
) values
('00000000-0000-0000-0000-000000002521','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002511','00000000-0000-0000-0000-000000002501',now(),'qualified','normal'),
('00000000-0000-0000-0000-000000002522','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002513','00000000-0000-0000-0000-000000002502',now(),'qualified','normal');

insert into public.rfq_lines(
  id,owner_id,organization_id,rfq_id,canonical_product_key,raw_spec_text
) values
('00000000-0000-0000-0000-000000002531','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002521','tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:273|t=8|process=_','RFQ 273x8'),
('00000000-0000-0000-0000-000000002532','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002522','tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:323.9|t=8|process=_','RFQ conflict');

insert into public.offers(
  id,owner_id,organization_id,conversation_id,rfq_id,status,currency,offered_at
) values
('00000000-0000-0000-0000-000000002541','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002511','00000000-0000-0000-0000-000000002521','sent','EUR',now()),
('00000000-0000-0000-0000-000000002542','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002512',null,'sent','EUR',now()),
('00000000-0000-0000-0000-000000002543','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002513','00000000-0000-0000-0000-000000002522','sent','EUR',now());

insert into public.offer_lines(
  id,owner_id,organization_id,offer_id,canonical_product_key,raw_spec_text
) values
('00000000-0000-0000-0000-000000002551','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002541','tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:273|t=8|process=_','Offer 273x8'),
('00000000-0000-0000-0000-000000002552','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002542','tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:219.1|t=6|process=_','Offer gap'),
('00000000-0000-0000-0000-000000002553','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002543','tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:323.9|t=8|process=_','Offer conflict');

insert into public.orders(
  id,owner_id,organization_id,conversation_id,rfq_id,offer_id,status,ordered_at
) values
('00000000-0000-0000-0000-000000002561','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002511','00000000-0000-0000-0000-000000002521','00000000-0000-0000-0000-000000002541','received',now()),
('00000000-0000-0000-0000-000000002562','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002513','00000000-0000-0000-0000-000000002522',null,'received',now());

insert into public.order_lines(
  id,owner_id,organization_id,order_id,canonical_product_key,raw_spec_text
) values
('00000000-0000-0000-0000-000000002571','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002561','tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:273|t=8|process=_','Order 273x8'),
('00000000-0000-0000-0000-000000002572','00000000-0000-0000-0000-0000000025a1','00000000-0000-0000-0000-0000000025f1','00000000-0000-0000-0000-000000002562','tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:323.9|t=8|process=_','Order conflict');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000025a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p2_reconcile_commercial_outcome_attribution(
  '00000000-0000-0000-0000-0000000025f1'
) as reconcile_result \gset

select pg_temp.p25_assert(
  (:'reconcile_result'::jsonb->>'offers_attributed')::int=2,
  'reconciliation must attribute the two non-conflicting Offers'
);

select pg_temp.p25_assert(
  (:'reconcile_result'::jsonb->>'orders_attributed')::int=1,
  'reconciliation must attribute the deterministic Order'
);

select pg_temp.p25_assert(
  (:'reconcile_result'::jsonb->>'offer_source_conflicts')::int=1
  and (:'reconcile_result'::jsonb->>'order_source_conflicts')::int=1,
  'conflicting verified Company sources must be reported and not overwritten'
);

select pg_temp.p25_assert(
  (select company_id from public.offers where id='00000000-0000-0000-0000-000000002543') is null
  and (select company_id from public.orders where id='00000000-0000-0000-0000-000000002562') is null,
  'source conflicts must leave business outcome Company unset'
);

select pg_temp.p25_assert(
  (public.p2_commercial_conversion_foundation(
    '00000000-0000-0000-0000-0000000025f1',100,0
  )#>>'{summary,conversion_eligible_offer_count}')::int=1,
  'only same-Company RFQ-linked verified Offers belong to the conversion denominator'
);

select pg_temp.p25_assert(
  (public.p2_commercial_conversion_foundation(
    '00000000-0000-0000-0000-0000000025f1',100,0
  )#>>'{summary,converted_offer_count}')::int=1,
  'explicit same-Company Order→Offer link must count as converted'
);

select pg_temp.p25_assert(
  (public.p2_commercial_conversion_foundation(
    '00000000-0000-0000-0000-0000000025f1',100,0
  )#>>'{summary,conversion_rate_pct}')::numeric=100.0,
  'conversion rate must be computed only on the deterministic denominator'
);

select pg_temp.p25_assert(
  (
    select (x->>'analysis_status')='relationship_gap'
    from jsonb_array_elements(
      public.p2_commercial_conversion_foundation(
        '00000000-0000-0000-0000-0000000025f1',100,0
      )->'outcomes'
    ) x
    where x->>'entity_id'='00000000-0000-0000-0000-000000002542'
  ),
  'verified Offer without RFQ relationship must remain a relationship gap, not a lost conversion'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000025b1',true);

select pg_temp.p25_assert(
  (public.p2_commercial_conversion_foundation(
    '00000000-0000-0000-0000-0000000025f1',100,0
  )#>>'{summary,offer_count}')::int=0,
  'cross-tenant conversion foundation must expose no outcomes'
);

select pg_temp.p25_assert(
  not has_function_privilege(
    'anon','public.p2_commercial_conversion_foundation(uuid,integer,integer)','EXECUTE'
  )
  and not has_function_privilege(
    'anon','public.p2_reconcile_commercial_outcome_attribution(uuid)','EXECUTE'
  ),
  'anonymous role must not read or reconcile P2.5 outcomes'
);

reset role;
rollback;
