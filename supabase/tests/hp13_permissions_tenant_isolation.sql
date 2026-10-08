-- HP13 — Permissions & Tenant Isolation Re-Audit
-- Launch gate regression: 0 cross-tenant leaks / 0 privilege escalation.
-- Disposable CI transaction only; all fixtures roll back.

begin;

create or replace function pg_temp.hp13_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'HP13 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.hp13_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(lower(expected_fragment) in lower(sqlerrm))=0 then
      raise exception 'HP13 expected error containing "%", got "%"',
        expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'HP13 statement unexpectedly succeeded: %',statement;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Structural exposure audit
-- ---------------------------------------------------------------------------

-- RLS + no policy is intentionally deny-by-default only when browser roles
-- also have no CRUD grants. Any future grant turns this gate red.
select pg_temp.hp13_assert(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p')
      and c.relrowsecurity
      and not exists (
        select 1 from pg_policy p where p.polrelid=c.oid
      )
      and (
        has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
        or has_table_privilege(
          'authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'
        )
      )
  ),
  'RLS/no-policy tables must remain deny-by-default for browser roles'
);

-- Browser-readable views must execute with caller permissions.
select pg_temp.hp13_assert(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='v'
      and (
        has_table_privilege('anon',c.oid,'SELECT')
        or has_table_privilege('authenticated',c.oid,'SELECT')
      )
      and not (
        coalesce(c.reloptions,'{}'::text[])
        @> array['security_invoker=true']
      )
  ),
  'browser-readable public views must be security_invoker'
);

-- SECURITY DEFINER functions callable by anon are an explicit allowlist:
-- the curated, read-only public Scuola/Knowledge API.
select pg_temp.hp13_assert(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('anon',p.oid,'EXECUTE')
  )=10,
  'anonymous SECURITY DEFINER surface must remain exactly the reviewed 10 RPCs'
);

select pg_temp.hp13_assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('anon',p.oid,'EXECUTE')
      and p.proname not in (
        'k2_public_knowledge_grade',
        'k2_public_knowledge_grades',
        'k2_public_knowledge_standard',
        'k2_public_knowledge_standards',
        'k5_public_tube_weight_references',
        'k6_public_tube_dimension_page',
        'k6_public_tube_dimension_pages',
        'k7_public_tube_family_hubs',
        'k7_public_tube_size_hub',
        'k7_public_tube_size_hubs'
      )
  ),
  'no unreviewed anonymous SECURITY DEFINER function may be exposed'
);

select pg_temp.hp13_assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('anon',p.oid,'EXECUTE')
      and (
        p.provolatile<>'s'
        or coalesce(array_to_string(p.proconfig,','),'') not like '%search_path=""%'
        or pg_get_functiondef(p.oid) ilike '%organization_memberships%'
        or pg_get_functiondef(p.oid) ilike '%organization_id%'
        or pg_get_functiondef(p.oid) ilike '%auth.users%'
        or pg_get_functiondef(p.oid) ilike '%platform_staff%'
        or pg_get_functiondef(p.oid) ilike '%commercial_%'
        or pg_get_functiondef(p.oid) ilike '%marketplace_%'
      )
  ),
  'anonymous SECURITY DEFINER functions must stay stable, fixed-path and tenant-free'
);

-- Authenticated SECURITY DEFINER exposure is constrained to the audited
-- legacy allowlist. We intentionally do not freeze an exact count: removing
-- an exposed function is security-positive, while adding any unreviewed
-- function is rejected by the allowlist assertion below.
select pg_temp.hp13_assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and p.proname not in (
        'p1_acknowledge_operational_alert',
        'p1_operational_alert_audit_read',
        'p1_apply_commercial_review_correction',
        'p1_operational_alerts_read',
        'p1_operational_alerts_summary',
        'p1_resolve_operational_alert',
        'nc31_workspace_notification_set_state',
        'nc31_workspace_notification_destination',
        'nc32_platform_notification_set_state',
        'nc32_platform_notification_destination',
        'platform_access_context',
        'sa2_claim_platform_staff_invitation',
        'sa2_create_platform_staff_invitation',
        'sa2_platform_staff_directory',
        'sa2_platform_staff_invitation_queue',
        'sa2_revoke_platform_staff_invitation',
        'sa2_set_platform_staff_roles',
        'sa2_set_platform_staff_status'
      )
  ),
  'no unreviewed authenticated SECURITY DEFINER function may be exposed'
);

select pg_temp.hp13_assert(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and coalesce(array_to_string(p.proconfig,','),'') not like '%search_path=""%'
  ),
  'authenticated SECURITY DEFINER functions must pin an empty search_path'
);

-- ---------------------------------------------------------------------------
-- 2. Two-tenant BOLA / role fixtures
-- ---------------------------------------------------------------------------

insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000013a1'::uuid,'hp13-a@example.test',now()),
 ('00000000-0000-0000-0000-0000000013b1'::uuid,'hp13-b@example.test',now()),
 ('00000000-0000-0000-0000-0000000013c1'::uuid,'hp13-viewer@example.test',now())
on conflict (id) do nothing;

insert into public.organizations(id,name,slug,created_by,onboarding_status) values
 ('00000000-0000-0000-0000-0000000013f1'::uuid,'HP13 Tenant A','hp13-tenant-a',
  '00000000-0000-0000-0000-0000000013a1'::uuid,'completed'),
 ('00000000-0000-0000-0000-0000000013f2'::uuid,'HP13 Tenant B','hp13-tenant-b',
  '00000000-0000-0000-0000-0000000013b1'::uuid,'completed');

insert into public.organization_memberships(
 organization_id,user_id,role,business_role,status,is_default
) values
 ('00000000-0000-0000-0000-0000000013f1'::uuid,
  '00000000-0000-0000-0000-0000000013a1'::uuid,
  'admin','sales_director','active',true),
 ('00000000-0000-0000-0000-0000000013f2'::uuid,
  '00000000-0000-0000-0000-0000000013b1'::uuid,
  'admin','sales_director','active',true),
 ('00000000-0000-0000-0000-0000000013f1'::uuid,
  '00000000-0000-0000-0000-0000000013c1'::uuid,
  'viewer','operations','active',true);

insert into public.network_companies(
 id,legal_name,country_code,website_url,website_domain,
 publication_status,claimed_status,verification_status
) values (
 '00000000-0000-0000-0000-0000000013d2'::uuid,
 'HP13 Network B','IT',
 'https://hp13-b.example.test','hp13-b.example.test',
 'published','claimed','verified'
);

insert into public.network_company_claims(
 network_company_id,organization_id,requested_by,status,
 request_note,reviewed_by,reviewed_at,review_note
) values (
 '00000000-0000-0000-0000-0000000013d2'::uuid,
 '00000000-0000-0000-0000-0000000013f2'::uuid,
 '00000000-0000-0000-0000-0000000013b1'::uuid,
 'approved','Created by M7 registration bridge',
 '00000000-0000-0000-0000-0000000013b1'::uuid,
 now(),'HP13 isolation fixture'
);

insert into public.organization_network_company_links(
 organization_id,network_company_id,link_status,linked_by,claim_id
)
select
 '00000000-0000-0000-0000-0000000013f2'::uuid,
 '00000000-0000-0000-0000-0000000013d2'::uuid,
 'active',
 '00000000-0000-0000-0000-0000000013b1'::uuid,
 c.id
from public.network_company_claims c
where c.network_company_id='00000000-0000-0000-0000-0000000013d2'::uuid
  and c.organization_id='00000000-0000-0000-0000-0000000013f2'::uuid;

-- Registration preparation is actor-scoped by trigger.
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-0000000013b1',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.company_registration_applications(
 id,legal_name,country_code,primary_company_type,contact_name,short_description
) values (
 '00000000-0000-0000-0000-0000000013e2'::uuid,
 'HP13 Registration B','IT','producer','HP13 B','tenant B registration'
);

-- ---------------------------------------------------------------------------
-- 3. Positive controls: B can access B
-- ---------------------------------------------------------------------------

set local role authenticated;

select pg_temp.hp13_assert(
  (
    public.hp11_marketplace_readiness(
      '00000000-0000-0000-0000-0000000013f2'::uuid
    )->>'organization_id'
  )::uuid='00000000-0000-0000-0000-0000000013f2'::uuid,
  'Tenant B must read its own Marketplace readiness'
);

select pg_temp.hp13_assert(
  public.p3_7_managed_profile_state(
    '00000000-0000-0000-0000-0000000013d2'::uuid
  )->'company'->>'legal_name'='HP13 Network B',
  'Tenant B admin must manage its own linked Network profile'
);

select pg_temp.hp13_assert(
  public.hp12_registration_recovery_state(
    '00000000-0000-0000-0000-0000000013e2'::uuid
  )->'application'->>'legal_name'='HP13 Registration B',
  'Applicant B must read its own registration recovery state'
);

-- ---------------------------------------------------------------------------
-- 4. Cross-tenant attempts: A must never access B
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-0000000013a1',
  true
);

select pg_temp.hp13_assert_raises(
  'select public.p1_normalized_commercial_explorer(''00000000-0000-0000-0000-0000000013f2''::uuid)',
  'organization access denied'
);

select pg_temp.hp13_assert_raises(
  $$select public.hp7_company_setup_state(
      '00000000-0000-0000-0000-0000000013f2'::uuid
    )$$,
  'active organization membership required'
);

select pg_temp.hp13_assert_raises(
  $$select public.hp11_marketplace_readiness(
      '00000000-0000-0000-0000-0000000013f2'::uuid
    )$$,
  'active organization membership required'
);

select pg_temp.hp13_assert_raises(
  $$select public.p5_1_my_requests(
      '00000000-0000-0000-0000-0000000013f2'::uuid
    )$$,
  'active organization membership required'
);

select pg_temp.hp13_assert_raises(
  $$select public.hp5_company_claim_experience(
      '00000000-0000-0000-0000-0000000013d2'::uuid,
      '00000000-0000-0000-0000-0000000013f2'::uuid
    )$$,
  'active organization admin membership required'
);

select pg_temp.hp13_assert_raises(
  $$select public.p3_7_managed_profile_state(
      '00000000-0000-0000-0000-0000000013d2'::uuid
    )$$,
  'managed Network company access required'
);

select pg_temp.hp13_assert_raises(
  $$select public.hp8_team_state(
      '00000000-0000-0000-0000-0000000013f2'::uuid
    )$$,
  'organization admin role required'
);

-- Applicant-scoped recovery fails closed with a null application rather than
-- disclosing another applicant's record.
select pg_temp.hp13_assert(
  public.hp12_registration_recovery_state(
    '00000000-0000-0000-0000-0000000013e2'::uuid
  )->'application'='null'::jsonb,
  'Tenant A must not see Tenant B registration application'
);

-- ---------------------------------------------------------------------------
-- 5. Platform RBAC / privilege escalation
-- ---------------------------------------------------------------------------

select pg_temp.hp13_assert_raises(
  $$select public.p0a_admin_registration_queue(null)$$,
  'Platform permission required'
);

select pg_temp.hp13_assert_raises(
  $$select * from public.sa2_platform_staff_directory()$$,
  'Platform permission required'
);

select pg_temp.hp13_assert_raises(
  $$select public.sa2_set_platform_staff_roles(
      '00000000-0000-0000-0000-0000000013a1'::uuid,
      array['platform_auditor'],
      'HP13 attempted self escalation'
    )$$,
  'Platform permission required'
);

-- Browser roles cannot bypass governed RPCs by querying raw internals.
select pg_temp.hp13_assert_raises(
  $$select count(*) from public.marketplace_requests$$,
  'permission denied'
);

select pg_temp.hp13_assert_raises(
  $$select count(*) from public.platform_staff$$,
  'permission denied'
);

-- RLS hides B's memberships from A.
select pg_temp.hp13_assert(
  (
    select count(*)
    from public.organization_memberships
    where organization_id='00000000-0000-0000-0000-0000000013f2'::uuid
  )=0,
  'Tenant A must not read Tenant B memberships'
);

-- Viewer keeps allowed reads but cannot obtain write authority.
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-0000000013c1',
  true
);

select pg_temp.hp13_assert(
  public.hp11_marketplace_readiness(
    '00000000-0000-0000-0000-0000000013f1'::uuid
  )->>'membership_role'='viewer',
  'viewer must retain allowed tenant read access'
);

select pg_temp.hp13_assert_raises(
  $$select public.p5_1_create_request(
      '00000000-0000-0000-0000-0000000013f1'::uuid,
      'HP13 forbidden viewer write',
      'network'
    )$$,
  'active organization admin/member membership required'
);

-- ---------------------------------------------------------------------------
-- 6. Public Scuola boundary
-- ---------------------------------------------------------------------------

reset role;
set local role anon;

select pg_temp.hp13_assert(
  has_function_privilege(
    'anon',
    'public.k2_public_knowledge_standards(text,integer,integer)',
    'EXECUTE'
  ),
  'public knowledge list RPC is intentionally anonymous'
);

select count(*) from public.k2_public_knowledge_standards(null,1,0);

select pg_temp.hp13_assert_raises(
  $$select count(*) from public.steel_knowledge_standard_pages$$,
  'permission denied'
);

reset role;

rollback;
