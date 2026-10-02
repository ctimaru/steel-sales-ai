-- HP18 — Production Journey Acceptance
-- Disposable production-like acceptance. Everything rolls back.
--
-- This composes the critical launch journey instead of testing each subsystem
-- in isolation:
-- registration -> approval/activation -> claim -> setup -> team ->
-- Marketplace buyer -> supplier -> buyer lifecycle.

begin;

create temp table hp18_state(
  key text primary key,
  value jsonb not null
) on commit drop;

grant select, insert, update, delete on table hp18_state
to authenticated, service_role;

create or replace function pg_temp.hp18_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'HP18 assertion failed: %', message;
  end if;
end;
$$;

grant execute on function pg_temp.hp18_assert(boolean,text)
to authenticated, service_role;

-- A rebuilt CI database has no account-specific production owner. Create a
-- disposable fallback only when necessary; production reuses the real owner.
do $owner$
begin
  if not exists (
    select 1
    from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '00000000-0000-0000-0000-000000001800'::uuid,
      'hp18-owner@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(
      user_id,role,status,granted_by,reason
    ) values (
      '00000000-0000-0000-0000-000000001800'::uuid,
      'platform_superadmin',
      'active',
      null,
      'HP18 acceptance fallback owner'
    );
  end if;
end
$owner$;

insert into hp18_state(key,value)
select 'owner', jsonb_build_object('user_id',user_id)
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1;

select pg_temp.hp18_assert(
  exists(select 1 from hp18_state where key='owner'),
  'active platform superadmin required'
);

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000001801','hp18-buyer@example.test',now()),
  ('00000000-0000-0000-0000-000000001802','hp18-supplier@example.test',now()),
  ('00000000-0000-0000-0000-000000001803','hp18-team@example.test',now());

-- Buyer registration.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001801',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
  id,legal_name,country_code,primary_company_type,contact_name,website_url
) values (
  '00000000-0000-0000-0000-000000001811',
  'HP18 Buyer Steel Srl','IT','end_user','Buyer Admin',
  'https://hp18-buyer.example.test'
);

select public.p0a_submit_registration_application(
  '00000000-0000-0000-0000-000000001811'
);

-- Supplier registration.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001802',true);

insert into public.company_registration_applications(
  id,legal_name,country_code,primary_company_type,contact_name,website_url
) values (
  '00000000-0000-0000-0000-000000001812',
  'HP18 Supplier Steel Srl','IT','producer','Supplier Admin',
  'https://hp18-supplier.example.test'
);

select public.p0a_submit_registration_application(
  '00000000-0000-0000-0000-000000001812'
);

-- Platform review + atomic activation bridge.
select set_config(
  'request.jwt.claim.sub',
  (select value->>'user_id' from hp18_state where key='owner'),
  true
);

select public.p0a_approve_registration_application(
  '00000000-0000-0000-0000-000000001811'
);
select public.p0a_approve_registration_application(
  '00000000-0000-0000-0000-000000001812'
);

insert into hp18_state(key,value)
select 'buyer_activation',
  public.p0a_activate_registration_application(
    '00000000-0000-0000-0000-000000001811'
  );

insert into hp18_state(key,value)
select 'supplier_activation',
  public.p0a_activate_registration_application(
    '00000000-0000-0000-0000-000000001812'
  );

select pg_temp.hp18_assert(
  (select value->>'status' from hp18_state where key='buyer_activation')='activated'
  and (select value->>'network_link_status' from hp18_state where key='buyer_activation')='active'
  and (select value->>'claim_id' from hp18_state where key='buyer_activation') is not null,
  'buyer activation must atomically create workspace, link and claim'
);

select pg_temp.hp18_assert(
  (select value->>'status' from hp18_state where key='supplier_activation')='activated'
  and (select value->>'network_link_status' from hp18_state where key='supplier_activation')='active'
  and (select value->>'claim_id' from hp18_state where key='supplier_activation') is not null,
  'supplier activation must atomically create workspace, link and claim'
);

-- Claim experience must reflect the approved registration bridge claim.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001801',true);

insert into hp18_state(key,value)
select 'buyer_claim',
  public.hp5_company_claim_experience(
    (select (value->>'network_company_id')::uuid
     from hp18_state where key='buyer_activation'),
    (select (value->>'organization_id')::uuid
     from hp18_state where key='buyer_activation')
  );

select pg_temp.hp18_assert(
  (select value->'current_claim'->>'status'
   from hp18_state where key='buyer_claim')='approved'
  and (select (value->>'claim_is_separate_from_network_verification')::boolean
       from hp18_state where key='buyer_claim'),
  'activated buyer must see its approved governed claim'
);

-- Guided setup for buyer and supplier.
select public.update_organization_onboarding(
  (select (value->>'organization_id')::uuid
   from hp18_state where key='buyer_activation'),
  'HP18 Buyer Steel Srl','IT','steel',array['email'],true,true
);

insert into hp18_state(key,value)
select 'buyer_setup',
  public.hp7_company_setup_state(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='buyer_activation')
  );

select pg_temp.hp18_assert(
  (select (value->>'setup_completed')::boolean
   from hp18_state where key='buyer_setup'),
  'buyer guided setup must complete'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001802',true);

select public.update_organization_onboarding(
  (select (value->>'organization_id')::uuid
   from hp18_state where key='supplier_activation'),
  'HP18 Supplier Steel Srl','IT','steel',array['email'],true,true
);

select pg_temp.hp18_assert(
  (public.hp7_company_setup_state(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='supplier_activation')
  )->>'setup_completed')::boolean,
  'supplier guided setup must complete'
);

-- Team onboarding.
reset role;

insert into public.organization_invitations(
  id,organization_id,email,role,business_role,status,invited_by,
  invited_at,expires_at,delivery_status,delivery_mode,send_count,last_sent_at
) values (
  '00000000-0000-0000-0000-000000001821',
  (select (value->>'organization_id')::uuid
   from hp18_state where key='buyer_activation'),
  'hp18-team@example.test',
  'member','salesperson','pending',
  '00000000-0000-0000-0000-000000001801',
  now(),now()+interval '7 days','sent','invite',1,now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001803',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into hp18_state(key,value)
select 'team_claim',
  public.hp8_claim_organization_invitation(
    '00000000-0000-0000-0000-000000001821'
  );

select pg_temp.hp18_assert(
  (select value->>'status' from hp18_state where key='team_claim')='accepted'
  and (select value->>'role' from hp18_state where key='team_claim')='member'
  and (select value->>'business_role' from hp18_state where key='team_claim')='salesperson',
  'team invitation must onboard the invited user with governed role'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001801',true);

select pg_temp.hp18_assert(
  jsonb_array_length(
    public.hp8_team_state(
      (select (value->>'organization_id')::uuid
       from hp18_state where key='buyer_activation')
    )->'members'
  )=2,
  'buyer admin must see admin plus invited team member'
);

-- Buyer creates and publishes an anonymous Marketplace request.
insert into hp18_state(key,value)
select 'market_request',
  public.p5_1_create_request(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='buyer_activation'),
    'HP18 production journey demand',
    'anonymous'
  );

select public.p5_1_add_request_line(
  (select (value->>'request_id')::uuid
   from hp18_state where key='market_request'),
  jsonb_build_object(
    'product_family_key','tubes_pipes',
    'quantity','25',
    'quantity_unit','t',
    'delivery_country_code','IT',
    'notes','HP18 private buyer note'
  )
);

select public.p5_1_publish_request(
  (select (value->>'request_id')::uuid
   from hp18_state where key='market_request'),
  now()+interval '7 days'
);

-- Pilot authority grants supplier entitlement.
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);

select public.p5_3_grant_entitlement(
  (select (value->>'organization_id')::uuid
   from hp18_state where key='supplier_activation'),
  'opportunity_unlock',
  (select (value->>'request_id')::uuid
   from hp18_state where key='market_request'),
  'pilot',
  'hp18-production-like',
  now()+interval '1 day',
  'hp18.production.acceptance.001',
  '{"scope":"HP18"}'::jsonb
);

-- Supplier opens governed detail, preserving anonymous buyer privacy.
reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001802',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into hp18_state(key,value)
select 'supplier_detail',
  public.p5_3_marketplace_detail(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='supplier_activation'),
    (select (value->>'request_id')::uuid
     from hp18_state where key='market_request')
  );

select pg_temp.hp18_assert(
  (select value->'buyer'->>'visibility_mode'
   from hp18_state where key='supplier_detail')='anonymous'
  and position(
    'HP18 Buyer Steel'
    in (select value::text from hp18_state where key='supplier_detail')
  )=0
  and position(
    'HP18 private buyer note'
    in (select value::text from hp18_state where key='supplier_detail')
  )=0,
  'supplier unlocked detail must preserve anonymous buyer privacy'
);

-- Supplier response.
insert into hp18_state(key,value)
select 'response',
  public.p5_4_create_response(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='supplier_activation'),
    (select (value->>'request_id')::uuid
     from hp18_state where key='market_request'),
    'interest',
    'HP18 supplier interested in this opportunity.',
    current_date+7
  );

insert into hp18_state(key,value)
select 'submitted',
  public.p5_4_submit_response(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='supplier_activation'),
    (select (value->>'response_id')::uuid
     from hp18_state where key='response')
  );

select pg_temp.hp18_assert(
  (select value->>'status' from hp18_state where key='submitted')='submitted',
  'supplier response must submit'
);

-- Buyer receives, opens and resolves the governed response.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000001801',true);

insert into hp18_state(key,value)
select 'buyer_inbox',
  public.p5_4_buyer_inbox(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='buyer_activation'),
    (select (value->>'request_id')::uuid
     from hp18_state where key='market_request'),
    20,0
  );

select pg_temp.hp18_assert(
  (select (value->>'total')::integer
   from hp18_state where key='buyer_inbox')=1
  and
  (select value->'items'->0->>'response_id'
   from hp18_state where key='buyer_inbox')
  =
  (select value->>'response_id'
   from hp18_state where key='response'),
  'buyer inbox must receive submitted supplier response'
);

insert into hp18_state(key,value)
select 'buyer_detail',
  public.p5_4_buyer_response_detail(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='buyer_activation'),
    (select (value->>'response_id')::uuid
     from hp18_state where key='response')
  );

select pg_temp.hp18_assert(
  (select value->'response'->>'status'
   from hp18_state where key='buyer_detail')='submitted',
  'buyer must open supplier response detail'
);

insert into hp18_state(key,value)
select 'ack',
  public.p5_4_buyer_transition(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='buyer_activation'),
    (select (value->>'response_id')::uuid
     from hp18_state where key='response'),
    'acknowledge'
  );

insert into hp18_state(key,value)
select 'close',
  public.p5_4_buyer_transition(
    (select (value->>'organization_id')::uuid
     from hp18_state where key='buyer_activation'),
    (select (value->>'response_id')::uuid
     from hp18_state where key='response'),
    'close'
  );

select pg_temp.hp18_assert(
  (select value->>'status' from hp18_state where key='ack')='acknowledged'
  and
  (select value->>'status' from hp18_state where key='close')='closed',
  'buyer must acknowledge and close governed response'
);

reset role;

select pg_temp.hp18_assert(
  (
    select array_agg(event_type order by event_sequence)
    from public.marketplace_response_events
    where response_id=(
      select (value->>'response_id')::uuid
      from hp18_state where key='response'
    )
  ) = array['created','submitted','acknowledged','closed']::text[],
  'response ledger must preserve deterministic lifecycle'
);

select jsonb_build_object(
  'status','passed',
  'registration','passed',
  'activation_claim','passed',
  'setup','passed',
  'team','passed',
  'marketplace_supplier','passed',
  'marketplace_buyer','passed'
) as hp18_result;

rollback;
