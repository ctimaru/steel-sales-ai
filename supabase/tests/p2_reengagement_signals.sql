-- P2.1 Dormant Accounts & Re-engagement Signals acceptance.
begin;

create or replace function pg_temp.p21_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P2.1 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000021a1','p21@example.com'),
('00000000-0000-0000-0000-0000000021b1','p21-other@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
('00000000-0000-0000-0000-0000000021f1','P21 Org','p21-org','00000000-0000-0000-0000-0000000021a1','completed'),
('00000000-0000-0000-0000-0000000021f2','P21 Other','p21-other','00000000-0000-0000-0000-0000000021b1','completed');

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values
('00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-0000000021a1','admin','sales_director','active',true),
('00000000-0000-0000-0000-0000000021f2','00000000-0000-0000-0000-0000000021b1','admin','sales_director','active',true);

insert into public.companies(id,owner_id,organization_id,name,company_type,country) values
('00000000-0000-0000-0000-000000002101','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','Dormant Orders','customer','IT'),
('00000000-0000-0000-0000-000000002102','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','Watch Offers','customer','DE'),
('00000000-0000-0000-0000-000000002103','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','Active Customer','customer','FR'),
('00000000-0000-0000-0000-000000002104','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','Unverified Old','customer','ES'),
('00000000-0000-0000-0000-000000002105','00000000-0000-0000-0000-0000000021b1','00000000-0000-0000-0000-0000000021f2','Other Tenant Old','customer','AT');

insert into public.commercial_company_identity_verifications(
  organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values
('00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002101','vat_number','IT21000000001','vat_document','00000000-0000-0000-0000-0000000021a1'),
('00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002102','vat_number','DE21000000002','vat_document','00000000-0000-0000-0000-0000000021a1'),
('00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002103','vat_number','FR21000000003','vat_document','00000000-0000-0000-0000-0000000021a1'),
('00000000-0000-0000-0000-0000000021f2','00000000-0000-0000-0000-000000002105','vat_number','AT21000000005','vat_document','00000000-0000-0000-0000-0000000021b1');

insert into public.conversations(
  id,owner_id,organization_id,company_id,subject,status,started_at,last_activity_at
) values
('00000000-0000-0000-0000-000000002111','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002101','Dormant thread','archived','2026-04-01T08:00:00Z','2026-05-01T08:00:00Z'),
('00000000-0000-0000-0000-000000002112','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002102','Watch thread','archived','2026-07-01T08:00:00Z','2026-08-01T08:00:00Z'),
('00000000-0000-0000-0000-000000002113','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002103','Active thread','open','2026-09-01T08:00:00Z','2026-09-20T08:00:00Z'),
('00000000-0000-0000-0000-000000002114','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002104','Unverified thread','archived','2026-03-01T08:00:00Z','2026-04-01T08:00:00Z'),
('00000000-0000-0000-0000-000000002115','00000000-0000-0000-0000-0000000021b1','00000000-0000-0000-0000-0000000021f2','00000000-0000-0000-0000-000000002105','Other tenant thread','archived','2026-03-01T08:00:00Z','2026-04-01T08:00:00Z');

insert into public.rfqs(id,owner_id,organization_id,conversation_id,company_id,requested_at,status,priority) values
('00000000-0000-0000-0000-000000002121','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002111','00000000-0000-0000-0000-000000002101','2026-04-15T08:00:00Z','quoted','normal'),
('00000000-0000-0000-0000-000000002122','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002113','00000000-0000-0000-0000-000000002103','2026-09-20T08:00:00Z','in_progress','normal');

insert into public.offers(id,owner_id,organization_id,conversation_id,company_id,offered_at,status,currency) values
('00000000-0000-0000-0000-000000002131','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002111','00000000-0000-0000-0000-000000002101','2026-04-20T08:00:00Z','sent','EUR'),
('00000000-0000-0000-0000-000000002132','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002112','00000000-0000-0000-0000-000000002102','2026-08-01T08:00:00Z','sent','EUR');

insert into public.orders(id,owner_id,organization_id,conversation_id,company_id,ordered_at,status) values
('00000000-0000-0000-0000-000000002141','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002111','00000000-0000-0000-0000-000000002101','2026-05-01T08:00:00Z','confirmed'),
('00000000-0000-0000-0000-000000002144','00000000-0000-0000-0000-0000000021a1','00000000-0000-0000-0000-0000000021f1','00000000-0000-0000-0000-000000002114','00000000-0000-0000-0000-000000002104','2026-04-01T08:00:00Z','confirmed'),
('00000000-0000-0000-0000-000000002145','00000000-0000-0000-0000-0000000021b1','00000000-0000-0000-0000-0000000021f2','00000000-0000-0000-0000-000000002115','00000000-0000-0000-0000-000000002105','2026-04-01T08:00:00Z','confirmed');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000021a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p21_assert(
  (public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',45,90,100,0)#>>'{summary,total}')::int=2,
  'only watch/dormant verified historical companies must surface'
);

select pg_temp.p21_assert(
  public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',45,90,100,0)#>>'{signals,0,name}'='Dormant Orders'
  and public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',45,90,100,0)#>>'{signals,0,signal_state}'='dormant'
  and public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',45,90,100,0)#>>'{signals,0,has_order_history}'='true',
  'order-history dormant relationship must rank first'
);

select pg_temp.p21_assert(
  public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',45,90,100,0)#>>'{signals,1,name}'='Watch Offers'
  and public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',45,90,100,0)#>>'{signals,1,signal_state}'='watch',
  'watch relationship must surface after dormant order history'
);

select pg_temp.p21_assert(
  public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',45,90,100,0)#>>'{signals,0,latest_evidence,event_type}'='order',
  'latest evidence must identify the last normalized business event'
);

select pg_temp.p21_assert(
  jsonb_path_exists(
    public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',45,90,100,0),
    '$.signals[0].reason_codes[*] ? (@ == "historical_orders")'
  ),
  'reason codes must expose deterministic order-history rationale'
);

select pg_temp.p21_assert(
  (public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f2',45,90,100,0)#>>'{summary,total}')::int=0,
  'cross-tenant organization must remain invisible'
);

select pg_temp.p21_assert(
  public.p2_reengagement_signals('00000000-0000-0000-0000-0000000021f1',90,45,100,0)#>>'{policy,dormant_after_days}'='91',
  'invalid threshold ordering must normalize deterministically'
);

reset role;
rollback;
