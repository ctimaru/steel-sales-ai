-- P5.3a — Deterministic Entitlement Ordering acceptance.
-- Reproduces same-transaction grant/revoke ties. Everything rolls back.

begin;

create or replace function pg_temp.p53a_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P5.3a assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000053a1'::uuid,'p53a-buyer@example.test',now()),
  ('00000000-0000-0000-0000-0000000053a2'::uuid,'p53a-supplier@example.test',now());

insert into public.organizations(id,name,slug,created_by,country_code,industry)
values
  ('00000000-0000-0000-0000-0000000053a3'::uuid,'P5.3a Buyer','p53a-buyer','00000000-0000-0000-0000-0000000053a1'::uuid,'IT','steel'),
  ('00000000-0000-0000-0000-0000000053a4'::uuid,'P5.3a Supplier','p53a-supplier','00000000-0000-0000-0000-0000000053a2'::uuid,'DE','steel');

insert into public.organization_memberships(organization_id,user_id,role,status,is_default)
values
  ('00000000-0000-0000-0000-0000000053a3'::uuid,'00000000-0000-0000-0000-0000000053a1'::uuid,'admin','active',true),
  ('00000000-0000-0000-0000-0000000053a4'::uuid,'00000000-0000-0000-0000-0000000053a2'::uuid,'viewer','active',true);

insert into public.marketplace_requests(
  id,organization_id,created_by_user_id,title,visibility_mode,status,
  opens_at,closes_at,published_at,source_kind
)
values(
  '00000000-0000-0000-0000-0000000053a5'::uuid,
  '00000000-0000-0000-0000-0000000053a3'::uuid,
  '00000000-0000-0000-0000-0000000053a1'::uuid,
  'P5.3a ordering fixture',
  'anonymous',
  'published',
  now()-interval '1 hour',
  now()+interval '1 day',
  now()-interval '1 hour',
  'manual'
);

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

select public.p5_3_grant_entitlement(
  '00000000-0000-0000-0000-0000000053a4'::uuid,
  'opportunity_unlock',
  '00000000-0000-0000-0000-0000000053a5'::uuid,
  'credit',
  'credit:p53a-cycle-1',
  now()+interval '1 day',
  'p53a.grant.001',
  '{}'::jsonb
);

select public.p5_3_revoke_entitlement(
  '00000000-0000-0000-0000-0000000053a4'::uuid,
  'opportunity_unlock',
  '00000000-0000-0000-0000-0000000053a5'::uuid,
  'credit',
  'credit:p53a-cycle-1',
  'p53a.revoke.001',
  '{}'::jsonb
);

reset role;

select pg_temp.p53a_assert(
  (
    select count(distinct effective_at)=1
    from public.marketplace_entitlement_events
    where supplier_organization_id='00000000-0000-0000-0000-0000000053a4'::uuid
      and request_id='00000000-0000-0000-0000-0000000053a5'::uuid
  ),
  'fixture must reproduce identical transaction-stable effective_at timestamps'
);

select pg_temp.p53a_assert(
  (
    select bool_and(event_sequence is not null)
    from public.marketplace_entitlement_events
    where supplier_organization_id='00000000-0000-0000-0000-0000000053a4'::uuid
      and request_id='00000000-0000-0000-0000-0000000053a5'::uuid
  ),
  'every entitlement event must receive a monotonic sequence'
);

select pg_temp.p53a_assert(
  (
    select event_type='revoked'
    from public.marketplace_entitlement_events
    where supplier_organization_id='00000000-0000-0000-0000-0000000053a4'::uuid
      and request_id='00000000-0000-0000-0000-0000000053a5'::uuid
    order by effective_at desc,event_sequence desc
    limit 1
  ),
  'later same-transaction revoke must sort after grant'
);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000053a2',true);

select pg_temp.p53a_assert(
  public.p5_3_entitlement_state(
    '00000000-0000-0000-0000-0000000053a4'::uuid,
    '00000000-0000-0000-0000-0000000053a5'::uuid
  )->>'state'='locked',
  'same-transaction revoke must deterministically relock supplier'
);

reset role;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

select public.p5_3_grant_entitlement(
  '00000000-0000-0000-0000-0000000053a4'::uuid,
  'opportunity_unlock',
  '00000000-0000-0000-0000-0000000053a5'::uuid,
  'credit',
  'credit:p53a-cycle-2',
  now()+interval '1 day',
  'p53a.grant.002',
  '{}'::jsonb
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000053a2',true);

select pg_temp.p53a_assert(
  public.p5_3_entitlement_state(
    '00000000-0000-0000-0000-0000000053a4'::uuid,
    '00000000-0000-0000-0000-0000000053a5'::uuid
  )->>'state'='entitled',
  'later same-transaction re-grant must deterministically reactivate supplier'
);

reset role;

select pg_temp.p53a_assert(
  (
    select array_agg(event_type order by event_sequence)
    from public.marketplace_entitlement_events
    where supplier_organization_id='00000000-0000-0000-0000-0000000053a4'::uuid
      and request_id='00000000-0000-0000-0000-0000000053a5'::uuid
  )=array['granted','revoked','granted']::text[],
  'event sequence must preserve exact insertion order'
);

rollback;
