-- LR5 — Registration & Account Compliance acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.lr5_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'LR5 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.lr5_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(lower(expected_fragment) in lower(sqlerrm))=0 then
      raise exception 'LR5 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'LR5 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-000000005501'::uuid,'lr5-owner@example.test',now()),
  ('00000000-0000-0000-0000-000000005502'::uuid,'lr5-successor@example.test',now()),
  ('00000000-0000-0000-0000-000000005503'::uuid,'lr5-retention@example.test',now())
on conflict (id) do nothing;

insert into public.organizations(
  id,name,slug,created_by,onboarding_status
) values (
  '00000000-0000-0000-0000-0000000055f1'::uuid,
  'LR5 Compliance Organization',
  'lr5-compliance-organization',
  '00000000-0000-0000-0000-000000005501'::uuid,
  'completed'
);

insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values
  (
    '00000000-0000-0000-0000-0000000055f1'::uuid,
    '00000000-0000-0000-0000-000000005501'::uuid,
    'admin','sales_director','active',true
  ),
  (
    '00000000-0000-0000-0000-0000000055f1'::uuid,
    '00000000-0000-0000-0000-000000005502'::uuid,
    'member','salesperson','active',false
  );

select pg_temp.lr5_assert(
  not has_table_privilege('anon','public.user_legal_acceptances','SELECT')
  and has_table_privilege('authenticated','public.user_legal_acceptances','SELECT')
  and not has_table_privilege('authenticated','public.user_legal_acceptances','INSERT'),
  'legal evidence must be self-readable but not directly writable'
);

select pg_temp.lr5_assert(
  not has_table_privilege('authenticated','public.account_lifecycle_requests','INSERT')
  and not has_table_privilege('authenticated','public.account_data_export_events','INSERT'),
  'lifecycle/export evidence writes must stay behind governed RPCs'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005501',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.lr5_current_legal_acceptance_state() as initial_legal \\gset

select pg_temp.lr5_assert(
  not coalesce((:'initial_legal'::jsonb->>'accepted')::boolean,false),
  'new account must start without current legal acceptance evidence'
);

select pg_temp.lr5_assert_raises(
  $$select public.lr5_record_legal_acceptance(false,true,'first_login')$$,
  'privacy notice acknowledgement is required'
);

select public.lr5_record_legal_acceptance(
  true,true,'first_login'
) as first_acceptance \\gset

select public.lr5_record_legal_acceptance(
  true,true,'first_login'
) as replay_acceptance \\gset

select public.lr5_current_legal_acceptance_state() as legal_state \\gset

select pg_temp.lr5_assert(
  coalesce((:'first_acceptance'::jsonb->>'accepted')::boolean,false)
  and (:'first_acceptance'::jsonb->>'acceptance_id')=
      (:'replay_acceptance'::jsonb->>'acceptance_id')
  and coalesce((:'legal_state'::jsonb->>'accepted')::boolean,false)
  and (:'legal_state'::jsonb->>'privacy_notice_version')='2026-10-04-lr5-v1'
  and (:'legal_state'::jsonb->>'terms_version')='2026-10-04-lr5-v1',
  'legal acceptance must be versioned and retry-safe'
);

select public.lr5_account_export() as export_payload \\gset

select pg_temp.lr5_assert(
  (:'export_payload'::jsonb->>'export_version')='2026-10-04-lr5-v1'
  and (:'export_payload'::jsonb->'account'->>'email')='lr5-owner@example.test'
  and jsonb_array_length(:'export_payload'::jsonb->'organization_memberships')=1
  and position('Commercial Memory' in (:'export_payload'::jsonb->>'scope'))>0,
  'account export must be scoped to the requesting user and exclude organization-controlled Commercial Memory'
);

reset role;

select pg_temp.lr5_assert(
  (select count(*) from public.account_data_export_events
   where subject_user_ref='00000000-0000-0000-0000-000000005501'::uuid)=1,
  'account export must create one immutable evidence event'
);

select pg_temp.lr5_assert_raises(
  $$update public.user_legal_acceptances
    set terms_version='tampered'
    where subject_user_ref='00000000-0000-0000-0000-000000005501'::uuid$$,
  'LR5 compliance evidence is immutable'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005501',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.lr5_request_account_erasure(
  'DELETE_MY_ACCOUNT'
) as blocked_request \\gset

select pg_temp.lr5_assert(
  not coalesce((:'blocked_request'::jsonb->>'requested')::boolean,false)
  and (:'blocked_request'::jsonb->>'code')='last_organization_admin',
  'last organization admin must not be able to orphan the workspace'
);

reset role;

update public.organization_memberships
set role='admin'
where organization_id='00000000-0000-0000-0000-0000000055f1'::uuid
  and user_id='00000000-0000-0000-0000-000000005502'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000005501',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.lr5_request_account_erasure(
  'DELETE_MY_ACCOUNT'
) as accepted_request \\gset

select public.lr5_account_lifecycle_state() as lifecycle_state \\gset

select pg_temp.lr5_assert(
  coalesce((:'accepted_request'::jsonb->>'requested')::boolean,false)
  and coalesce((:'accepted_request'::jsonb->>'access_suspended')::boolean,false)
  and not coalesce((:'accepted_request'::jsonb->>'hard_delete_automatic')::boolean,true)
  and coalesce((:'lifecycle_state'::jsonb->>'access_suspended')::boolean,false),
  'eligible closure must immediately suspend workspace access without claiming automatic hard deletion'
);

reset role;

select pg_temp.lr5_assert(
  (select status from public.organization_memberships
   where organization_id='00000000-0000-0000-0000-0000000055f1'::uuid
     and user_id='00000000-0000-0000-0000-000000005501'::uuid)='suspended',
  'account closure must suspend active organization membership immediately'
);

insert into public.company_registration_applications(
  id,applicant_user_id,applicant_email_snapshot,
  legal_name,country_code,primary_company_type,contact_name,
  contact_phone,short_description,application_status,created_at,updated_at
) values (
  '00000000-0000-0000-0000-0000000055a1'::uuid,
  '00000000-0000-0000-0000-000000005503'::uuid,
  'lr5-retention@example.test',
  'LR5 Retention Company','IT','producer','Retention Person',
  '+39 000 000000','Personal draft details','draft',
  now()-interval '100 days',now()-interval '100 days'
);

select private.lr5_retention_cleanup_impl(now()) as retention_result \\gset

select pg_temp.lr5_assert(
  (:'retention_result'::jsonb->>'redacted_drafts')::integer>=1
  and (
    select applicant_user_id is null
      and contact_name='Retention redacted'
      and contact_phone is null
      and short_description is null
    from public.company_registration_applications
    where id='00000000-0000-0000-0000-0000000055a1'::uuid
  ),
  'stale draft personal applicant/contact data must be redacted after 90 days'
);

select pg_temp.lr5_assert(
  exists(
    select 1 from cron.job
    where jobname='lr5-retention-cleanup-daily'
      and schedule='15 3 * * *'
  ),
  'daily LR5 retention enforcement job must exist'
);

select pg_temp.lr5_assert(
  (select confdeltype
   from pg_constraint
   where conname='company_registration_applications_applicant_user_id_fkey')='n',
  'registration applicant identity must use ON DELETE SET NULL for post-retention identity detachment'
);

rollback;
