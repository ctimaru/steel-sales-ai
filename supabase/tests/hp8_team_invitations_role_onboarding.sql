-- HP8 — Team Invitations & Role Onboarding acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.hp8_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'HP8 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.hp8_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(lower(expected_fragment) in lower(sqlerrm))=0 then
      raise exception 'HP8 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'HP8 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000008801'::uuid,'hp8-admin@example.test',now()),
  ('00000000-0000-0000-0000-000000008802'::uuid,'hp8-member@example.test',now()),
  ('00000000-0000-0000-0000-000000008803'::uuid,'hp8-outsider@example.test',now())
on conflict (id) do nothing;

insert into public.organizations(
  id,name,slug,created_by,onboarding_status
) values
  (
    '00000000-0000-0000-0000-0000000088f1'::uuid,
    'HP8 Organization One',
    'hp8-organization-one',
    '00000000-0000-0000-0000-000000008801'::uuid,
    'completed'
  ),
  (
    '00000000-0000-0000-0000-0000000088f2'::uuid,
    'HP8 Organization Two',
    'hp8-organization-two',
    '00000000-0000-0000-0000-000000008801'::uuid,
    'completed'
  );

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values
  (
    '00000000-0000-0000-0000-0000000088f1'::uuid,
    '00000000-0000-0000-0000-000000008801'::uuid,
    'admin','sales_director','active',true
  ),
  (
    '00000000-0000-0000-0000-0000000088f2'::uuid,
    '00000000-0000-0000-0000-000000008801'::uuid,
    'admin','sales_director','active',false
  );

insert into public.organization_invitations(
  id,organization_id,email,role,business_role,status,invited_by,
  invited_at,expires_at,delivery_status,delivery_mode,send_count,last_sent_at
) values
  (
    '00000000-0000-0000-0000-0000000088a1'::uuid,
    '00000000-0000-0000-0000-0000000088f1'::uuid,
    'hp8-member@example.test',
    'member','salesperson','pending',
    '00000000-0000-0000-0000-000000008801'::uuid,
    now(),now()+interval '7 days','sent','invite',1,now()
  ),
  (
    '00000000-0000-0000-0000-0000000088a2'::uuid,
    '00000000-0000-0000-0000-0000000088f2'::uuid,
    'hp8-member@example.test',
    'viewer','operations','pending',
    '00000000-0000-0000-0000-000000008801'::uuid,
    now(),now()+interval '7 days','sent','magic_link',2,now()
  ),
  (
    '00000000-0000-0000-0000-0000000088a3'::uuid,
    '00000000-0000-0000-0000-0000000088f1'::uuid,
    'hp8-outsider@example.test',
    'viewer',null,'pending',
    '00000000-0000-0000-0000-000000008801'::uuid,
    now()-interval '8 days',now()-interval '1 day','sent','invite',1,now()-interval '8 days'
  );

-- Exposed HP8 functions are invoker-only; private implementations remain definer-only.
select pg_temp.hp8_assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'hp8_invitation_context',
        'hp8_claim_organization_invitation',
        'hp8_team_state',
        'hp8_revoke_organization_invitation',
        'hp8_set_organization_member_status',
        'hp8_auth_user_lookup'
      )
      and p.prosecdef
  ),
  'HP8 public RPCs must be SECURITY INVOKER'
);

select pg_temp.hp8_assert(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in (
        'hp8_invitation_context_impl',
        'hp8_claim_organization_invitation_impl',
        'hp8_team_state_impl',
        'hp8_revoke_organization_invitation_impl',
        'hp8_set_organization_member_status_impl',
        'hp8_auth_user_lookup_impl'
      )
      and p.prosecdef
  )=6,
  'HP8 private implementations must remain SECURITY DEFINER'
);

select pg_temp.hp8_assert(
  not has_function_privilege('anon','public.hp8_invitation_context(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.hp8_claim_organization_invitation(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.hp8_team_state(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.hp8_revoke_organization_invitation(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.hp8_set_organization_member_status(uuid,uuid,text)','EXECUTE'),
  'anon must not execute HP8 browser RPCs'
);

select pg_temp.hp8_assert(
  not has_function_privilege('authenticated','public.hp8_auth_user_lookup(text)','EXECUTE'),
  'Auth identity lookup must remain service-role-only'
);

-- Outsider cannot inspect another email's invitation.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000008803',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.hp8_assert_raises(
  $$select public.hp8_invitation_context('00000000-0000-0000-0000-0000000088a1'::uuid)$$,
  'invitation not available'
);

reset role;

-- The invited identity can inspect one exact invitation.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000008802',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.hp8_invitation_context(
  '00000000-0000-0000-0000-0000000088a1'::uuid
) as invitation_context \gset

select pg_temp.hp8_assert(
  (:'invitation_context'::jsonb->>'organization_id')::uuid =
    '00000000-0000-0000-0000-0000000088f1'::uuid
  and (:'invitation_context'::jsonb->>'role')='member'
  and (:'invitation_context'::jsonb->>'business_role')='salesperson',
  'invitation context must expose the exact governed assignment'
);

-- Legacy no-id claiming refuses ambiguity when the same email has multiple invitations.
select pg_temp.hp8_assert_raises(
  $$select public.claim_pending_organization_invitations()$$,
  'multiple pending invitations require explicit invitation id'
);

-- Explicit acceptance claims only invite A.
select public.hp8_claim_organization_invitation(
  '00000000-0000-0000-0000-0000000088a1'::uuid
) as first_claim \gset

select public.hp8_claim_organization_invitation(
  '00000000-0000-0000-0000-0000000088a1'::uuid
) as replay_claim \gset

select pg_temp.hp8_assert(
  coalesce((:'first_claim'::jsonb->>'claimed')::boolean,false)
  and coalesce((:'replay_claim'::jsonb->>'idempotent_replay')::boolean,false),
  'exact invitation acceptance must be retry-safe'
);

reset role;

select pg_temp.hp8_assert(
  exists (
    select 1
    from public.organization_memberships
    where organization_id='00000000-0000-0000-0000-0000000088f1'::uuid
      and user_id='00000000-0000-0000-0000-000000008802'::uuid
      and role='member'
      and business_role='salesperson'
      and status='active'
      and is_default
  ),
  'accepted invite must create active membership with permission and business role'
);

select pg_temp.hp8_assert(
  (select status from public.organization_invitations
   where id='00000000-0000-0000-0000-0000000088a1'::uuid)='accepted'
  and
  (select status from public.organization_invitations
   where id='00000000-0000-0000-0000-0000000088a2'::uuid)='pending',
  'claiming one invitation must not accept another invitation for the same email'
);

-- Admin read model expires stale pending rows and sees lifecycle data.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000008801',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.hp8_team_state(
  '00000000-0000-0000-0000-0000000088f1'::uuid
) as team_state \gset

select pg_temp.hp8_assert(
  jsonb_array_length(:'team_state'::jsonb->'members')=2
  and jsonb_array_length(:'team_state'::jsonb->'invitations')=2,
  'admin team state must expose members and invitation lifecycle'
);

reset role;

select pg_temp.hp8_assert(
  (select status from public.organization_invitations
   where id='00000000-0000-0000-0000-0000000088a3'::uuid)='expired'
  and
  (select expired_at from public.organization_invitations
   where id='00000000-0000-0000-0000-0000000088a3'::uuid) is not null,
  'team state must reconcile expired pending invitations'
);

-- Admin can suspend and restore a member, but cannot suspend themselves.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000008801',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.hp8_set_organization_member_status(
  '00000000-0000-0000-0000-0000000088f1'::uuid,
  '00000000-0000-0000-0000-000000008802'::uuid,
  'suspended'
);

select pg_temp.hp8_assert_raises(
  $$select public.hp8_set_organization_member_status(
      '00000000-0000-0000-0000-0000000088f1'::uuid,
      '00000000-0000-0000-0000-000000008801'::uuid,
      'suspended'
    )$$,
  'cannot suspend your own organization membership'
);

select public.hp8_set_organization_member_status(
  '00000000-0000-0000-0000-0000000088f1'::uuid,
  '00000000-0000-0000-0000-000000008802'::uuid,
  'active'
);

-- Pending invite can be revoked, and the invited identity cannot activate it afterward.
select public.hp8_revoke_organization_invitation(
  '00000000-0000-0000-0000-0000000088a2'::uuid
) as revoke_result \gset

select pg_temp.hp8_assert(
  (:'revoke_result'::jsonb->>'status')='revoked',
  'admin must be able to revoke a pending invitation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000008802',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.hp8_claim_organization_invitation(
  '00000000-0000-0000-0000-0000000088a2'::uuid
) as revoked_claim \gset

select pg_temp.hp8_assert(
  (:'revoked_claim'::jsonb->>'status')='revoked'
  and not coalesce((:'revoked_claim'::jsonb->>'claimed')::boolean,false),
  'revoked invitation must stay non-claimable'
);

rollback;
