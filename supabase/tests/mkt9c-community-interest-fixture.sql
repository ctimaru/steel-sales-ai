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

-- Maintenance executed only by the disposable database owner.
insert into public.mkt9_community_interest(kind,locale,name,email,organization,notice_version,challenge_digest,created_at,expires_at)
values('investor','it','Expired fixture','expired@example.invalid',null,'mkt9c-draft-2026-11-24',repeat('d',64),now()-interval '91 days',now()-interval '1 day');
\ir ../../docs/marketing/mkt9c-retention-purge.candidate.sql
do $$
begin
  if exists(select 1 from public.mkt9_community_interest where email='expired@example.invalid') then raise exception 'Expired record survived purge'; end if;
  if (select count(*) from public.mkt9_community_interest where email='partner@example.invalid' and kind='investor')<>1 then raise exception 'Unexpired record removed'; end if;
end $$;
\ir ../../docs/marketing/mkt9c-retention-purge.candidate.sql
select 'MKT9C retention candidate PASS: expired removed, active preserved, repeat safe' as result;

-- C.2: actual database transaction functions, not provider email delivery.
set role service_role;
do $$
declare id1 uuid:='10000000-0000-4000-8000-000000000001'; id2 uuid:='10000000-0000-4000-8000-000000000002';
  payload jsonb:='{"kind":"partner","locale":"it","name":"OTP Fixture","email":"otp@example.invalid","organization":"Fixture","notice_version":"mkt9c-draft-2026-11-24"}';
begin
 if not public.mkt9_reserve_email(id1,repeat('1',64),repeat('2',64),repeat('3',64),payload) then raise exception 'Reserve denied'; end if;
 if public.mkt9_reserve_email(id2,repeat('1',64),repeat('4',64),repeat('5',64),payload) then raise exception 'Cooldown bypassed'; end if;
 if public.mkt9_reserve_email(id2,repeat('9',64),repeat('4',64),repeat('3',64),payload) then raise exception 'Challenge replay accepted'; end if;
 if public.mkt9_confirm_email(id1,repeat('9',64)) then raise exception 'Wrong code accepted'; end if;
 if not public.mkt9_confirm_email(id1,repeat('2',64)) then raise exception 'Correct code rejected'; end if;
 if public.mkt9_confirm_email(id1,repeat('2',64)) then raise exception 'Code reused'; end if;
 if not public.mkt9_reserve_email(id2,repeat('6',64),repeat('4',64),repeat('5',64),payload||'{"email":"locked@example.invalid"}'::jsonb) then raise exception 'Second reserve denied'; end if;
 for i in 1..5 loop
  if public.mkt9_confirm_email(id2,repeat('9',64)) then raise exception 'Wrong code accepted'; end if;
 end loop;
 if public.mkt9_confirm_email(id2,repeat('4',64)) then raise exception 'Attempt cap bypassed'; end if;
end $$;
reset role;
do $$
begin
 if not exists(select 1 from public.mkt9_community_interest where email='otp@example.invalid' and email_verified_at is not null) then raise exception 'Verified lead missing'; end if;
 if exists(select 1 from public.mkt9_community_interest where email='locked@example.invalid') then raise exception 'Unverified lead persisted'; end if;
 if has_function_privilege('anon','public.mkt9_reserve_email(uuid,text,text,text,jsonb)','execute') or has_function_privilege('authenticated','public.mkt9_confirm_email(uuid,text)','execute') then raise exception 'Public RPC access'; end if;
 if has_table_privilege('authenticated','public.mkt9_community_pending','select') or has_table_privilege('anon','public.mkt9_community_rate','select') then raise exception 'Private challenge data exposed'; end if;
end $$;
update public.mkt9_community_pending set expires_at=now()-interval '1 minute';
update public.mkt9_community_rate set created_at=now()-interval '25 hours';
\ir ../../docs/marketing/mkt9c-retention-purge.candidate.sql
do $$ begin
 if exists(select 1 from public.mkt9_community_pending) or exists(select 1 from public.mkt9_community_rate) then raise exception 'Temporary data not purged'; end if;
end $$;
select 'MKT9C2 OTP fixture PASS: reserve, cooldown, replay, attempts, confirmed lead, privileges, purge' as result;
