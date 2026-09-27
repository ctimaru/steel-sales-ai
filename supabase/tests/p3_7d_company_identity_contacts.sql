-- P3.7D — Company Identity & Public Contacts acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.p37d_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.7D assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.p37d_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'P3.7D expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'P3.7D statement unexpectedly succeeded: %',statement;
end;
$$;

do $p37d_bootstrap$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values (
      '00000000-0000-0000-0000-0000000037d1',
      'p37d-superadmin@example.test',
      now()
    )
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-0000000037d1',
      'platform_superadmin','active',null,
      'P3.7D acceptance fallback superadmin'
    );
  end if;
end;
$p37d_bootstrap$;

select user_id as superadmin_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

insert into public.organizations(
  id,name,slug,created_by,country_code,industry
) values (
  '00000000-0000-0000-0000-0000000037d2',
  'P3.7D Managed Organization',
  'p37d-managed-organization',
  :'superadmin_id'::uuid,
  'IT','steel'
);

insert into public.organization_memberships(
  organization_id,user_id,role,status,is_default
) values (
  '00000000-0000-0000-0000-0000000037d2',
  :'superadmin_id'::uuid,
  'admin','active',false
);

insert into public.network_companies(
  id,legal_name,trading_name,country_code,website_url,website_domain,description,
  publication_status,claimed_status,verification_status
) values (
  '00000000-0000-0000-0000-0000000037d3',
  'P3.7D Identity Company S.r.l.',
  'P3.7D Tubes',
  'IT',
  'https://p37d.example.test',
  'p37d.example.test',
  'Identity and public contacts acceptance',
  'published','claimed','unverified'
);

insert into public.organization_network_company_links(
  id,organization_id,network_company_id,link_status,linked_by
) values (
  '00000000-0000-0000-0000-0000000037d4',
  '00000000-0000-0000-0000-0000000037d2',
  '00000000-0000-0000-0000-0000000037d3',
  'active',
  :'superadmin_id'::uuid
);

select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select public.p3_7d_set_logo_path(
  '00000000-0000-0000-0000-0000000037d3',
  '00000000-0000-0000-0000-0000000037d3/logo'
) as logo_result \gset

select (
  public.p3_7d_upsert_contact(
    '00000000-0000-0000-0000-0000000037d3',
    null,
    jsonb_build_object(
      'contact_type','sales',
      'display_name','Ufficio Commerciale',
      'email','sales@p37d.example.test',
      'phone','+39 011 000 0000',
      'website_url','https://p37d.example.test/contact',
      'publication_status','published'
    )
  )->>'contact_id'
) as contact_id \gset

select public.p3_7d_managed_identity_contacts(
  '00000000-0000-0000-0000-0000000037d3'
) as managed_state \gset

select public.p3_7d_public_identity_contacts(
  '00000000-0000-0000-0000-0000000037d3'
) as public_state \gset

reset role;

select pg_temp.p37d_assert(
  :'managed_state'::jsonb->>'logo_path'='00000000-0000-0000-0000-0000000037d3/logo'
  and jsonb_array_length(:'managed_state'::jsonb->'contacts')=1,
  'managed identity state must expose logo and public contact'
);

select pg_temp.p37d_assert(
  :'public_state'::jsonb->>'logo_path'='00000000-0000-0000-0000-0000000037d3/logo'
  and jsonb_array_length(:'public_state'::jsonb->'contacts')=1
  and :'public_state'::jsonb->'contacts'->0->>'provenance_kind'='company_declared',
  'public identity state must expose safe company-declared contact provenance'
);

select pg_temp.p37d_assert(
  exists(
    select 1
    from public.network_data_assertions
    where id=(
      select source_assertion_id
      from public.network_contacts
      where id=:'contact_id'::uuid
    )
      and entity_type='contact'
      and source_type='company_declared'
      and source_reference='managed_profile:p3.7d'
      and ownership_type='company_managed'
      and review_state='accepted'
  ),
  'managed public contact must create canonical provenance'
);

select pg_temp.p37d_assert(
  (
    select count(*)
    from public.network_profile_management_events
    where network_company_id='00000000-0000-0000-0000-0000000037d3'
      and operation in ('update_overview','add_contact')
  )=2,
  'logo and contact mutations must create immutable audit events'
);

select pg_temp.p37d_assert(
  (select verification_status
   from public.network_companies
   where id='00000000-0000-0000-0000-0000000037d3')='unverified',
  'identity mutations must never auto-verify the company'
);

select pg_temp.p37d_assert(
  exists(
    select 1
    from storage.buckets
    where id='network-company-media'
      and public
      and file_size_limit=2097152
      and allowed_mime_types @> array['image/png','image/jpeg','image/webp']::text[]
  ),
  'company media bucket must be public and restricted to safe logo MIME types'
);

select pg_temp.p37d_assert(
  (
    select count(*)
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname like 'p3_7d_company_media_%'
  )=4,
  'company media bucket must have managed-path CRUD policies'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.p3_7d_upsert_contact(
  '00000000-0000-0000-0000-0000000037d3',
  :'contact_id'::uuid,
  jsonb_build_object(
    'contact_type','sales',
    'display_name','Ufficio Commerciale',
    'email','sales@p37d.example.test',
    'publication_status','draft'
  )
);

select public.p3_7d_public_identity_contacts(
  '00000000-0000-0000-0000-0000000037d3'
) as draft_public_state \gset

reset role;

select pg_temp.p37d_assert(
  jsonb_array_length(:'draft_public_state'::jsonb->'contacts')=0,
  'draft contacts must not leak onto public profile'
);

insert into public.network_contacts(
  id,company_id,contact_type,display_name,email,
  publication_status,consent_basis,source_reference,verification_status
) values (
  '00000000-0000-0000-0000-0000000037d5',
  '00000000-0000-0000-0000-0000000037d3',
  'general','Crawler Contact','crawler@p37d.example.test',
  'published','public_web','https://p37d.example.test','unverified'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p37d_assert_raises(
  format(
    $sql$select public.p3_7d_upsert_contact(
      %L::uuid,%L::uuid,
      '{"contact_type":"general","display_name":"Tampered","email":"tampered@p37d.example.test","publication_status":"published"}'::jsonb
    )$sql$,
    '00000000-0000-0000-0000-0000000037d3',
    '00000000-0000-0000-0000-0000000037d5'
  ),
  'cannot be overwritten directly'
);

reset role;

update public.network_contacts
set verification_status='verified'
where id=:'contact_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'superadmin_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p37d_assert_raises(
  format(
    $sql$select public.p3_7d_archive_contact(%L::uuid,%L::uuid)$sql$,
    '00000000-0000-0000-0000-0000000037d3',
    :'contact_id'
  ),
  'requires Platform review'
);

reset role;

select pg_temp.p37d_assert(
  not has_table_privilege('authenticated','public.network_data_assertions','SELECT'),
  'authenticated users must still have no direct assertion-table access'
);

rollback;
