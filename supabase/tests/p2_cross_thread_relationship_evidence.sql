-- P2.6 Cross-Thread Relationship Evidence & Conversion Activation acceptance.
begin;

create or replace function pg_temp.p26_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P2.6 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000027a1','p26@example.com'),
('00000000-0000-0000-0000-0000000027b1','p26-other@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
('00000000-0000-0000-0000-0000000027f1','P26 Org','p26-org','00000000-0000-0000-0000-0000000027a1','completed'),
('00000000-0000-0000-0000-0000000027f2','P26 Other','p26-other','00000000-0000-0000-0000-0000000027b1','completed');

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values
('00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-0000000027a1','admin','sales_director','active',true),
('00000000-0000-0000-0000-0000000027f2','00000000-0000-0000-0000-0000000027b1','admin','sales_director','active',true);

insert into public.companies(
  id,owner_id,organization_id,name,company_type,country,vat_number
) values(
  '00000000-0000-0000-0000-000000002701',
  '00000000-0000-0000-0000-0000000027a1',
  '00000000-0000-0000-0000-0000000027f1',
  'P26 Verified Buyer','customer','IT','IT27000000001'
);

insert into public.commercial_company_identity_verifications(
  organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values(
  '00000000-0000-0000-0000-0000000027f1',
  '00000000-0000-0000-0000-000000002701',
  'vat_number','IT27000000001','vat_document',
  '00000000-0000-0000-0000-0000000027a1'
);

insert into public.contacts(
  id,owner_id,organization_id,full_name,email
) values
('00000000-0000-0000-0000-000000002711','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','P26 Buyer','buyer@p26.example'),
('00000000-0000-0000-0000-000000002712','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','P26 Other Buyer','other@p26.example');

insert into public.conversations(
  id,owner_id,organization_id,company_id,subject,external_thread_id,status
) values
('00000000-0000-0000-0000-000000002721','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002701','RFQ and offer','p26-offer-thread','open'),
('00000000-0000-0000-0000-000000002722','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002701','Order follow-up','p26-order-thread','open'),
('00000000-0000-0000-0000-000000002723','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002701','Other order','p26-other-order-thread','open');

insert into public.messages(
  id,owner_id,organization_id,conversation_id,external_message_id,
  direction,sender_email,sent_at,subject,sender_contact_id,sender_company_id
) values
('00000000-0000-0000-0000-000000002731','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002721','<p26-offer>','inbound','buyer@p26.example','2026-01-10T10:00:00Z','RFQ and offer','00000000-0000-0000-0000-000000002711','00000000-0000-0000-0000-000000002701'),
('00000000-0000-0000-0000-000000002732','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002722','<p26-order>','inbound','buyer@p26.example','2026-01-11T09:00:00Z','Order follow-up','00000000-0000-0000-0000-000000002711','00000000-0000-0000-0000-000000002701'),
('00000000-0000-0000-0000-000000002733','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002723','<p26-order-other>','inbound','other@p26.example','2026-01-12T09:00:00Z','Other order','00000000-0000-0000-0000-000000002712','00000000-0000-0000-0000-000000002701');

insert into public.rfqs(
  id,owner_id,organization_id,conversation_id,company_id,contact_id,requested_at,status,priority
) values(
  '00000000-0000-0000-0000-000000002741',
  '00000000-0000-0000-0000-0000000027a1',
  '00000000-0000-0000-0000-0000000027f1',
  '00000000-0000-0000-0000-000000002721',
  '00000000-0000-0000-0000-000000002701',
  '00000000-0000-0000-0000-000000002711',
  '2026-01-10T08:00:00Z','qualified','normal'
);

insert into public.rfq_lines(
  id,owner_id,organization_id,rfq_id,canonical_product_key,raw_spec_text
) values(
  '00000000-0000-0000-0000-000000002751',
  '00000000-0000-0000-0000-0000000027a1',
  '00000000-0000-0000-0000-0000000027f1',
  '00000000-0000-0000-0000-000000002741',
  'tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:193.7|t=10|process=_',
  'RFQ 193.7x10'
);

insert into public.offers(
  id,owner_id,organization_id,conversation_id,company_id,rfq_id,status,currency,offered_at
) values(
  '00000000-0000-0000-0000-000000002761',
  '00000000-0000-0000-0000-0000000027a1',
  '00000000-0000-0000-0000-0000000027f1',
  '00000000-0000-0000-0000-000000002721',
  '00000000-0000-0000-0000-000000002701',
  '00000000-0000-0000-0000-000000002741',
  'sent','EUR','2026-01-10T10:00:00Z'
);

insert into public.offer_lines(
  id,owner_id,organization_id,offer_id,canonical_product_key,raw_spec_text
) values(
  '00000000-0000-0000-0000-000000002771',
  '00000000-0000-0000-0000-0000000027a1',
  '00000000-0000-0000-0000-0000000027f1',
  '00000000-0000-0000-0000-000000002761',
  'tube:v1|family=round_tube|grade=s355|standard=_|material=_|geom=od:193.7|t=10|process=_',
  'Offer 193.7x10 - available 55 bars'
);

insert into public.orders(
  id,owner_id,organization_id,conversation_id,company_id,status,ordered_at
) values
('00000000-0000-0000-0000-000000002781','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002722','00000000-0000-0000-0000-000000002701','received','2026-01-11T09:00:00Z'),
('00000000-0000-0000-0000-000000002782','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002723','00000000-0000-0000-0000-000000002701','received','2026-01-12T09:00:00Z');

insert into public.order_lines(
  id,owner_id,organization_id,order_id,canonical_product_key,raw_spec_text
) values
('00000000-0000-0000-0000-000000002791','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002781','tube:v1|family=round_tube|grade=s355j2h|standard=_|material=_|geom=od:193.7|t=10|process=_','Order 193.7x10 - 35 bars'),
('00000000-0000-0000-0000-000000002792','00000000-0000-0000-0000-0000000027a1','00000000-0000-0000-0000-0000000027f1','00000000-0000-0000-0000-000000002782','tube:v1|family=round_tube|grade=s355j2h|standard=_|material=_|geom=od:193.7|t=10|process=_','Other order 193.7x10');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000027a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p26_assert(
  (public.p2_cross_thread_relationship_evidence(
    '00000000-0000-0000-0000-0000000027f1',90,100,0
  )#>>'{summary,order_offer_pending}')::int=2,
  'two cross-thread Order→Offer candidates must be reviewable'
);

select pg_temp.p26_assert(
  (
    select x->>'evidence_class'='strong_review'
      and (x->>'shared_contact')::boolean
      and (x->>'geometry_overlap_count')::int=1
      and (x->>'exact_product_overlap_count')::int=0
    from jsonb_array_elements(
      public.p2_cross_thread_relationship_evidence(
        '00000000-0000-0000-0000-0000000027f1',90,100,0
      )->'candidates'
    ) x
    where x->>'source_entity_id'='00000000-0000-0000-0000-000000002781'
      and x->>'relationship_type'='order_offer'
  ),
  'same Contact + exact geometry + short chronology must produce strong_review without pretending canonical equality'
);

select pg_temp.p26_assert(
  (
    select x->>'evidence_class'='review'
      and not (x->>'shared_contact')::boolean
    from jsonb_array_elements(
      public.p2_cross_thread_relationship_evidence(
        '00000000-0000-0000-0000-0000000027f1',90,100,0
      )->'candidates'
    ) x
    where x->>'source_entity_id'='00000000-0000-0000-0000-000000002782'
      and x->>'relationship_type'='order_offer'
  ),
  'same verified Company with different Contact remains review, never strong'
);

select public.p2_decide_cross_thread_relationship(
  '00000000-0000-0000-0000-0000000027f1',
  'order_offer',
  '00000000-0000-0000-0000-000000002781',
  '00000000-0000-0000-0000-000000002761',
  'accepted',
  'Acceptance evidence verified'
) as accepted_result \gset

select pg_temp.p26_assert(
  :'accepted_result'::jsonb->>'status'='applied'
  and (:'accepted_result'::jsonb->>'linked_line_count')::int=0,
  'accepted geometry-only candidate must apply entity relationship without forcing canonical line FK'
);

select pg_temp.p26_assert(
  (select offer_id from public.orders where id='00000000-0000-0000-0000-000000002781')
    ='00000000-0000-0000-0000-000000002761'::uuid
  and
  (select offer_line_id from public.order_lines where id='00000000-0000-0000-0000-000000002791') is null,
  'entity relationship must activate while geometry-only line remains unlinked'
);

select pg_temp.p26_assert(
  (select count(*) from public.commercial_relationship_activations
   where organization_id='00000000-0000-0000-0000-0000000027f1'
     and relationship_type='order_offer'
     and source_entity_id='00000000-0000-0000-0000-000000002781'
     and evidence_type='human_confirmed_cross_thread_evidence')=1,
  'accepted cross-thread relationship must enter immutable activation ledger'
);

select pg_temp.p26_assert(
  (public.p2_commercial_conversion_foundation(
    '00000000-0000-0000-0000-0000000027f1',100,0
  )#>>'{summary,conversion_rate_pct}')::numeric=100.0,
  'accepted Order→Offer must synchronously activate conversion when Offer already has deterministic RFQ link'
);

select public.p2_decide_cross_thread_relationship(
  '00000000-0000-0000-0000-0000000027f1',
  'order_offer',
  '00000000-0000-0000-0000-000000002782',
  '00000000-0000-0000-0000-000000002761',
  'rejected',
  'Different Contact; human rejected'
) as rejected_result \gset

select pg_temp.p26_assert(
  :'rejected_result'::jsonb->>'status'='rejected'
  and (select offer_id from public.orders where id='00000000-0000-0000-0000-000000002782') is null,
  'rejection must be audit-only and must not mutate the relationship'
);

select pg_temp.p26_assert(
  (public.p2_cross_thread_relationship_evidence(
    '00000000-0000-0000-0000-0000000027f1',90,100,0
  )#>>'{summary,order_offer_pending}')::int=0
  and
  (public.p2_cross_thread_relationship_evidence(
    '00000000-0000-0000-0000-0000000027f1',90,100,0
  )#>>'{summary,order_rfq_pending}')::int=2
  and
  (public.p2_cross_thread_relationship_evidence(
    '00000000-0000-0000-0000-0000000027f1',90,100,0
  )#>>'{summary,accepted_total}')::int=1
  and
  (public.p2_cross_thread_relationship_evidence(
    '00000000-0000-0000-0000-0000000027f1',90,100,0
  )#>>'{summary,rejected_total}')::int=1,
  'decisions must close only the selected relationship type; no implicit Order→RFQ cascade is allowed'
);

select pg_temp.p26_assert(
  (public.p2_decide_cross_thread_relationship(
    '00000000-0000-0000-0000-0000000027f1',
    'order_offer',
    '00000000-0000-0000-0000-000000002782',
    '00000000-0000-0000-0000-000000002761',
    'accepted',
    null
  )->>'status')='already_decided',
  'a candidate receives one immutable final decision'
);

select pg_temp.p26_assert(
  not has_function_privilege(
    'anon',
    'public.p2_cross_thread_relationship_evidence(uuid,integer,integer,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p2_decide_cross_thread_relationship(uuid,text,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'anonymous role must not read or decide P2.6 evidence'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000027b1',true);

do $$
begin
  perform public.p2_cross_thread_relationship_evidence(
    '00000000-0000-0000-0000-0000000027f1',90,100,0
  );
  raise exception 'expected cross-tenant access denial';
exception
  when sqlstate '42501' then null;
end $$;

reset role;
rollback;
