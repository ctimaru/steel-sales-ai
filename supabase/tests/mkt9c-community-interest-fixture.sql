-- Disposable PostgreSQL fixture only. This is NOT a production migration or a real-JWT test.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create function public.is_platform_superadmin() returns boolean language sql stable
as $$ select coalesce(current_setting('mkt9.fixture_owner',true),'')='yes' $$;
\ir ../../docs/marketing/mkt9c-community-interest-schema.candidate.sql

-- Verify actual role grants; test fixture's owner flag only substitutes platform identity.
do $$
begin
  if has_table_privilege('anon','public.mkt9_community_interest','select,insert,update,delete')
     or has_table_privilege('authenticated','public.mkt9_community_interest','insert')
     or has_column_privilege('authenticated','public.mkt9_community_interest','challenge_digest','select')
     or has_column_privilege('service_role','public.mkt9_community_interest','status','update') then
    raise exception 'Unexpected grant';
  end if;
end $$;

set role service_role;
insert into public.mkt9_community_interest(kind,locale,name,email,organization,notice_version,challenge_digest)
values('partner','it','Synthetic Partner','partner@example.invalid','Fixture company','mkt9c-draft-2026-11-24',repeat('a',64));
insert into public.mkt9_community_interest(kind,locale,name,email,organization,notice_version,challenge_digest)
values('investor','en','Synthetic Investor','partner@example.invalid',null,'mkt9c-draft-2026-11-24',repeat('b',64));
do $$
begin
  begin
    insert into public.mkt9_community_interest(kind,locale,name,email,organization,notice_version,challenge_digest)
    values('partner','it','Overwrite attempt','partner@example.invalid','Other company','mkt9c-draft-2026-11-24',repeat('c',64));
    raise exception 'Duplicate accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.mkt9_community_interest(kind,locale,name,email,organization,notice_version,challenge_digest)
    values('partner','it','Replay attempt','other@example.invalid','Other company','mkt9c-draft-2026-11-24',repeat('a',64));
    raise exception 'Challenge replay accepted';
  exception when unique_violation then null;
  end;
end $$;
reset role;

set role authenticated;
select set_config('mkt9.fixture_owner','no',false);
do $$
declare n integer;
begin
  select count(id) into n from public.mkt9_community_interest;
  if n<>0 then raise exception 'Non-owner read'; end if;
  update public.mkt9_community_interest set status='closed';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Non-owner update'; end if;
  delete from public.mkt9_community_interest;
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Non-owner delete'; end if;
end $$;
select set_config('mkt9.fixture_owner','yes',false);
do $$
declare n integer;
begin
  select count(id) into n from public.mkt9_community_interest;
  if n<>2 then raise exception 'Owner count or dedup failure'; end if;
  select count(id) into n from public.mkt9_community_interest where name='Synthetic Partner';
  if n<>1 then raise exception 'Original record overwritten'; end if;
  update public.mkt9_community_interest set status='contacted' where kind='investor';
  get diagnostics n = row_count;
  if n<>1 then raise exception 'Owner update failed'; end if;
  delete from public.mkt9_community_interest where kind='partner';
  get diagnostics n = row_count;
  if n<>1 then raise exception 'Owner delete failed'; end if;
end $$;
reset role;
select 'MKT9C isolated PostgreSQL grants, RLS and dedup PASS (identity fixture; real JWT not tested)' as result;
