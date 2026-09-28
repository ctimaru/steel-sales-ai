-- SA8 — Network Verification & Moderation Delegation Cutover acceptance.
begin;

create or replace function pg_temp.sa8_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SA8 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.sa8_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'SA8 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'SA8 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000b801'::uuid,'sa8-network-trust@example.com',now()),
  ('00000000-0000-0000-0000-00000000b802'::uuid,'sa8-platform-auditor@example.com',now()),
  ('00000000-0000-0000-0000-00000000b803'::uuid,'sa8-outsider@example.com',now())
on conflict (id) do nothing;

do $root$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000b800'::uuid,'sa8-owner@example.com',now())
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-00000000b800'::uuid,
      'platform_superadmin','active',null,'SA8 acceptance fallback owner'
    );
  end if;
end
$root$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

select pg_temp.sa8_assert(
  exists (
    select 1 from public.platform_roles
    where role_key='network_trust_admin'
      and label='Network Trust Admin'
      and status='active'
  ),
  'Network Trust Admin role must be active'
);

select pg_temp.sa8_assert(
  (
    select count(*)
    from public.platform_role_permissions
    where role_key='network_trust_admin'
      and permission_key like 'network_trust.%'
  )=7,
  'Network Trust Admin must receive the seven Network Trust capabilities'
);

select pg_temp.sa8_assert(
  not exists (
    select 1
    from public.platform_role_permissions rp
    join public.platform_permissions p on p.permission_key=rp.permission_key
    where rp.role_key='network_trust_admin'
      and p.is_root_only
  ),
  'Network Trust Admin must not receive root-only permissions'
);

select pg_temp.sa8_assert(
  not exists (
    select 1
    from public.platform_role_permissions
    where role_key='claims_verification_admin'
      and permission_key like 'network_trust.%'
  ),
  'Claims & Ownership Admin must remain outside Network verification authority'
);

insert into public.platform_staff(user_id,status,activated_at,updated_at)
values
  ('00000000-0000-0000-0000-00000000b801'::uuid,'active',now(),now()),
  ('00000000-0000-0000-0000-00000000b802'::uuid,'active',now(),now())
on conflict (user_id) do update
set status='active',suspended_at=null,revoked_at=null,updated_at=now();

insert into public.platform_staff_roles(user_id,role_key,status,assigned_by,reason)
values
  (
    '00000000-0000-0000-0000-00000000b801'::uuid,
    'network_trust_admin','active',:'owner_id'::uuid,'SA8 acceptance'
  ),
  (
    '00000000-0000-0000-0000-00000000b802'::uuid,
    'platform_auditor','active',:'owner_id'::uuid,'SA8 acceptance'
  );

insert into public.network_companies(
  id,legal_name,country_code,website_url,website_domain,
  publication_status,claimed_status,verification_status
)
values
(
  '00000000-0000-0000-0000-00000000b810'::uuid,
  'SA8 Trust Primary S.r.l.','IT',
  'https://sa8-match.example/primary','sa8-match.example',
  'published','unclaimed','unverified'
),
(
  '00000000-0000-0000-0000-00000000b811'::uuid,
  'SA8 Trust Duplicate Candidate S.r.l.','IT',
  'https://sa8-match.example/duplicate','sa8-match.example',
  'published','unclaimed','unverified'
);

-- Network Trust Admin receives only its operational domain plus console access.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b801',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa8_assert(
  public.has_platform_permission('platform.console.access')
  and public.has_platform_permission('network_trust.read')
  and public.has_platform_permission('network_trust.assert')
  and public.has_platform_permission('network_trust.verify')
  and public.has_platform_permission('network_trust.revoke')
  and public.has_platform_permission('network_trust.review_changes')
  and public.has_platform_permission('network_trust.identity_refresh')
  and public.has_platform_permission('network_trust.identity_review'),
  'Network Trust Admin must receive the complete Trust capability set'
);

select pg_temp.sa8_assert(
  not public.has_platform_permission('platform.staff.manage_roles')
  and not public.has_platform_permission('platform.staff.invite')
  and not public.has_platform_permission('tenant_access.break_glass')
  and not public.has_platform_permission('registrations.read')
  and not public.has_platform_permission('claims.read')
  and not public.has_platform_permission('knowledge.read_drafts'),
  'Network Trust Admin must remain outside root governance and unrelated operational domains'
);

select pg_temp.sa8_assert(
  not has_table_privilege('authenticated','public.network_data_assertions','SELECT')
  and not has_table_privilege('authenticated','public.network_verifications','SELECT')
  and not has_table_privilege('authenticated','public.network_change_reviews','SELECT')
  and not has_table_privilege('authenticated','public.network_identity_resolution_candidates','SELECT'),
  'Network Trust staff must use governed RPCs rather than raw governance tables'
);

select pg_temp.sa8_assert(
  jsonb_typeof(public.sa8_network_trust_queue(100)->'evidence')='array'
  and jsonb_typeof(public.sa8_network_trust_queue(100)->'identity_candidates')='array',
  'Network Trust Admin must read the governed queue'
);

-- Delegated assertion creation is intentionally restricted to approved evidence sources.
select pg_temp.sa8_assert_raises(
  $$select public.m4_create_data_assertion(
      'company',
      '00000000-0000-0000-0000-00000000b810'::uuid,
      'legal_name',
      to_jsonb('forbidden source'::text),
      'registration_application',
      'SA8 forbidden delegated source',
      'platform_curated',
      0.9,
      'accepted'
    )$$,
  'delegated Network Trust evidence source type is not allowed'
);

select public.m4_create_data_assertion(
  'company',
  '00000000-0000-0000-0000-00000000b810'::uuid,
  'legal_name',
  to_jsonb('SA8 Trust Primary S.r.l.'::text),
  'public_web',
  'https://sa8-match.example/evidence',
  'platform_curated',
  0.9900,
  'accepted'
) as assertion_id \gset

select pg_temp.sa8_assert(
  :'assertion_id'::uuid is not null,
  'Network Trust Admin must create append-only accepted public evidence'
);

-- Accepted matching evidence can drive Network verification.
select public.m4_record_verification(
  'company',
  '00000000-0000-0000-0000-00000000b810'::uuid,
  'verified',
  :'assertion_id'::uuid,
  now()+interval '180 days',
  'SA8 delegated company verification'
) as verified_id \gset

select public.sa8_network_trust_queue(250) as queue_after_verify \gset

select pg_temp.sa8_assert(
  exists (
    select 1
    from jsonb_array_elements(:'queue_after_verify'::jsonb->'current_verifications') item
    where item->>'verification_id'=:'verified_id'
      and item->>'status'='verified'
      and item->>'target_id'='00000000-0000-0000-0000-00000000b810'
  ),
  'delegated verification must appear in the governed Trust queue'
);

-- A revocation is a separate high-risk capability and preserves verification history.
select public.m4_record_verification(
  'company',
  '00000000-0000-0000-0000-00000000b810'::uuid,
  'revoked',
  :'assertion_id'::uuid,
  null,
  'SA8 delegated verification revocation'
) as revoked_id \gset

reset role;

select pg_temp.sa8_assert(
  exists (
    select 1 from public.network_companies
    where id='00000000-0000-0000-0000-00000000b810'::uuid
      and verification_status='revoked'
  )
  and exists (
    select 1 from public.network_verifications
    where id=:'verified_id'::uuid
      and status='verified'
      and not is_current
  )
  and exists (
    select 1 from public.network_verifications
    where id=:'revoked_id'::uuid
      and status='revoked'
      and is_current
  ),
  'verification revocation must preserve immutable verification history and update only current state'
);

-- Provenance moderation records a decision but does not silently overwrite the profile.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b801',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.m4_open_change_review(
  '00000000-0000-0000-0000-00000000b810'::uuid,
  :'assertion_id'::uuid,
  'legal_name',
  to_jsonb('SA8 Trust Primary S.r.l.'::text),
  to_jsonb('SA8 Proposed Legal Name S.r.l.'::text)
) as review_id \gset

select public.m4_decide_change_review(
  :'review_id'::uuid,
  'accepted',
  'SA8 accepted provenance decision without silent overwrite'
) as review_payload \gset

reset role;

select pg_temp.sa8_assert(
  :'review_payload'::jsonb->>'status'='accepted'
  and :'review_payload'::jsonb->>'automatic_overwrite_performed'='false'
  and exists (
    select 1 from public.network_companies
    where id='00000000-0000-0000-0000-00000000b810'::uuid
      and legal_name='SA8 Trust Primary S.r.l.'
  ),
  'accepted provenance review must not silently overwrite canonical profile data'
);

-- Identity refresh/review is delegated but confirmed_match remains evidence only.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b801',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.m5_refresh_identity_candidates() as refresh_payload \gset

select pg_temp.sa8_assert(
  :'refresh_payload'::jsonb->>'automatic_merge_performed'='false',
  'identity refresh must never perform an automatic merge'
);

select item->>'candidate_id' as candidate_id
from jsonb_array_elements(
  public.sa8_network_trust_queue(250)->'identity_candidates'
) item
where (
  item->>'company_a_id'='00000000-0000-0000-0000-00000000b810'
  and item->>'company_b_id'='00000000-0000-0000-0000-00000000b811'
) or (
  item->>'company_a_id'='00000000-0000-0000-0000-00000000b811'
  and item->>'company_b_id'='00000000-0000-0000-0000-00000000b810'
)
limit 1 \gset

select pg_temp.sa8_assert(
  nullif(:'candidate_id','') is not null,
  'identity refresh must surface the deterministic duplicate candidate'
);

select public.m5_review_identity_candidate(
  :'candidate_id'::uuid,
  'confirmed_match',
  'SA8 confirmed match acceptance — evidence only'
) as identity_payload \gset

select pg_temp.sa8_assert(
  :'identity_payload'::jsonb->>'status'='confirmed_match'
  and :'identity_payload'::jsonb->>'merge_performed'='false',
  'confirmed identity match must remain evidence only'
);

reset role;

select pg_temp.sa8_assert(
  (select count(*)=2 from public.network_companies where id in (
    '00000000-0000-0000-0000-00000000b810'::uuid,
    '00000000-0000-0000-0000-00000000b811'::uuid
  ))
  and exists (
    select 1 from public.network_identity_resolution_candidates
    where id=:'candidate_id'::uuid
      and status='confirmed_match'
  ),
  'identity confirmation must preserve both company identities and candidate provenance'
);

-- No delegated Trust operator receives tenant membership.
select pg_temp.sa8_assert(
  not exists (
    select 1 from public.organization_memberships
    where user_id='00000000-0000-0000-0000-00000000b801'::uuid
  ),
  'Network Trust Admin must not gain tenant membership'
);

-- Every mutation is auditable through the common Platform ledger.
select pg_temp.sa8_assert(
  exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000b801'::uuid
      and permission_key='network_trust.assert'
      and action='network_assertion_created'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000b801'::uuid
      and permission_key='network_trust.verify'
      and action='network_verification_verified'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000b801'::uuid
      and permission_key='network_trust.revoke'
      and action='network_verification_revoked'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000b801'::uuid
      and permission_key='network_trust.review_changes'
      and action='network_change_review_accepted'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000b801'::uuid
      and permission_key='network_trust.identity_refresh'
      and action='network_identity_candidates_refreshed'
  )
  and exists (
    select 1 from public.platform_access_events
    where actor_user_id='00000000-0000-0000-0000-00000000b801'::uuid
      and permission_key='network_trust.identity_review'
      and action='network_identity_match_confirmed'
  ),
  'all delegated Network Trust mutations must record effective permission audit events'
);

-- Platform Auditor sees the Trust queue but cannot mutate.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b802',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa8_assert(
  public.has_platform_permission('network_trust.read')
  and not public.has_platform_permission('network_trust.assert')
  and not public.has_platform_permission('network_trust.verify')
  and not public.has_platform_permission('network_trust.revoke')
  and not public.has_platform_permission('network_trust.review_changes')
  and not public.has_platform_permission('network_trust.identity_refresh')
  and not public.has_platform_permission('network_trust.identity_review'),
  'Platform Auditor must remain read-only for Network Trust'
);

select pg_temp.sa8_assert(
  jsonb_typeof(public.sa8_network_trust_queue(20)->'evidence')='array',
  'Platform Auditor must read the Network Trust queue'
);

select pg_temp.sa8_assert_raises(
  format(
    $$select public.m4_record_verification(
      'company',
      %L::uuid,
      'verified',
      %L::uuid,
      null,
      'auditor denied'
    )$$,
    '00000000-0000-0000-0000-00000000b810',
    :'assertion_id'
  ),
  'Platform permission required: network_trust.verify'
);

-- Ordinary authenticated users cannot read Trust governance.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b803',true);

select pg_temp.sa8_assert_raises(
  'select public.sa8_network_trust_queue(20)',
  'Platform permission required: network_trust.read'
);

-- Platform Owner keeps implicit access to all known Trust permissions.
select set_config('request.jwt.claim.sub',:'owner_id',true);

select pg_temp.sa8_assert(
  public.has_platform_permission('network_trust.read')
  and public.has_platform_permission('network_trust.assert')
  and public.has_platform_permission('network_trust.verify')
  and public.has_platform_permission('network_trust.revoke')
  and public.has_platform_permission('network_trust.review_changes')
  and public.has_platform_permission('network_trust.identity_refresh')
  and public.has_platform_permission('network_trust.identity_review')
  and jsonb_typeof(public.sa8_network_trust_queue(20)->'identity_candidates')='array',
  'Platform Owner must retain uninterrupted Network Trust authority'
);

rollback;
