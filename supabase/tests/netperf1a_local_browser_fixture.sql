-- NET-PERF1.A: disposable localhost benchmark fixture (never hosted Supabase).
-- Precondition: perf1-chrome-seed-auth.mjs and perf1_chrome_seed.sql were run
-- against the same local GoTrue/Postgres instance.
\set ON_ERROR_STOP on
begin;
-- The hosted project has a reviewed SECURITY DEFINER facade for
-- netlaunch4b_browse_page (verified through pg_proc); a fresh local
-- migrations reset still has the older SECURITY INVOKER wrapper. Mirror
-- the HOSTED authorization boundary in this throwaway lab database only.
-- Do not grant direct EXECUTE on private impl or anonymous facade access.
do $check$ begin
  if to_regprocedure('public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer)') is null
  or to_regprocedure('private.netlaunch4b_browse_page_impl(uuid,text,text,text,text,text,text,integer,integer)') is null
  then raise exception 'NET-PERF1.A: Network browse facade not installed'; end if;
end $check$;
alter function public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer)
  security definer;
revoke all on function private.netlaunch4b_browse_page_impl(uuid,text,text,text,text,text,text,integer,integer)
  from public,anon,authenticated;
revoke all on function public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer)
  from public,anon;
grant execute on function public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer)
  to authenticated;
-- A fail-closed assertion. The psql variable is substituted only in this
-- ordinary SQL statement (not inside a dollar-quoted plpgsql body).
select 1/(case when exists(select 1 from public.platform_user_roles
    where user_id=:'owner_user_id'::uuid
    and role='platform_superadmin' and status='active')
  and exists(select 1 from public.organizations
    where id='00000000-0000-0000-0000-000000023301'::uuid
      and slug='dt23-buyer') then 1 else 0 end) as local_owner_fixture_verified;

-- The existing PERF1 owner is intentionally membership-less. This additional
-- membership is used ONLY by the dedicated NET-PERF workflow; it is destroyed
-- with the local database and never runs in the shared PERF1 acceptance suite.
insert into public.organization_memberships(
  organization_id,user_id,role,business_role,status,is_default
) values (
  '00000000-0000-0000-0000-000000023301',:'owner_user_id'::uuid,
  'admin','sales_director','active',true
);
insert into public.user_legal_acceptances(
  user_id,subject_user_ref,privacy_notice_version,privacy_acknowledged_at,
  terms_version,terms_accepted_at,acceptance_source
) values (
  :'owner_user_id'::uuid,:'owner_user_id'::uuid,
  '2026-10-04-lr5-v1',now(),'2026-10-04-lr5-v1',now(),'account'
);

-- Public, fictional, and deterministic companies. The dataset is deliberately
-- small: it validates interactions, not realistic production database latency.
insert into public.network_companies(
  id,legal_name,country_code,publication_status,description
)
select
 ('70000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 'NET-PERF1.A Synthetic Steel '||lpad(i::text,2,'0'),
 case when i<=24 then 'IT' else 'RO' end,
 'published',
 'Disposable synthetic company for localhost browser measurements only'
from generate_series(1,36) as g(i);

do $check$ begin
 if (select count(*) from public.network_companies where legal_name like 'NET-PERF1.A Synthetic Steel %')<>36
 then raise exception 'NET-PERF1.A synthetic directory should have 36 companies'; end if;
end $check$;
commit;
