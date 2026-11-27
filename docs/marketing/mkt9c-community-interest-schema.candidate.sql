-- MKT9.C migration CANDIDATE ONLY. Do not run against production.
-- Generate canonical migration through local Supabase CLI after disposable RLS test.
begin;
create table public.mkt9_community_interest (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('partner','investor')),
  locale text not null check (locale in ('it','en')),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254 and email=lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  organization text check (organization is null or char_length(btrim(organization)) between 1 and 160),
  notice_version text not null check (notice_version='mkt9c-draft-2026-11-24'),
  challenge_digest text not null unique check (challenge_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '90 days'),
  unique(kind,email),
  check (kind<>'partner' or organization is not null)
);
alter table public.mkt9_community_interest enable row level security;
revoke all on public.mkt9_community_interest from public,anon,authenticated,service_role;
grant insert(kind,locale,name,email,organization,notice_version,challenge_digest) on public.mkt9_community_interest to service_role;
grant select(id,kind,locale,name,email,organization,notice_version,status,created_at,expires_at),update(status),delete on public.mkt9_community_interest to authenticated;
create policy mkt9_owner_read on public.mkt9_community_interest for select to authenticated using ((select public.is_platform_superadmin()));
create policy mkt9_owner_update on public.mkt9_community_interest for update to authenticated using ((select public.is_platform_superadmin())) with check ((select public.is_platform_superadmin()));
create policy mkt9_owner_delete on public.mkt9_community_interest for delete to authenticated using ((select public.is_platform_superadmin()));
create index mkt9_community_interest_expiry_idx on public.mkt9_community_interest(expires_at);
create index mkt9_community_interest_status_idx on public.mkt9_community_interest(status,created_at desc);
comment on table public.mkt9_community_interest is 'Non-binding contact requests; email ownership not verified. Never memberships, revenue, investor access or commitments.';
-- C.2: short-lived email verification; only the server-side intake role can use it.
alter table public.mkt9_community_interest add column email_verified_at timestamptz;
grant insert(email_verified_at) on public.mkt9_community_interest to service_role;
grant select(email_verified_at) on public.mkt9_community_interest to authenticated;
create table public.mkt9_community_pending (
 id uuid primary key,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=2048),
 code_digest text not null check(code_digest ~ '^[0-9a-f]{64}$'),
 challenge_digest text not null unique check(challenge_digest ~ '^[0-9a-f]{64}$'),
 attempts integer not null default 0 check(attempts between 0 and 5),
 expires_at timestamptz not null default(now()+interval '10 minutes')
);
create table public.mkt9_community_rate (
 id uuid primary key,
 email_digest text not null check(email_digest ~ '^[0-9a-f]{64}$'),
 challenge_digest text not null unique check(challenge_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now()
);
alter table public.mkt9_community_pending enable row level security;
alter table public.mkt9_community_rate enable row level security;
revoke all on public.mkt9_community_pending,public.mkt9_community_rate from public,anon,authenticated,service_role;
grant select,insert,update(attempts),delete on public.mkt9_community_pending to service_role;
grant select,insert on public.mkt9_community_rate to service_role;
create index mkt9_pending_expiry_idx on public.mkt9_community_pending(expires_at);
create index mkt9_rate_email_idx on public.mkt9_community_rate(email_digest,created_at);
create index mkt9_rate_time_idx on public.mkt9_community_rate(created_at);
create function public.mkt9_reserve_email(p_id uuid,p_email_digest text,p_code_digest text,p_challenge_digest text,p_payload jsonb)
returns boolean language plpgsql security invoker set search_path='' as $mkt9$
begin
  -- Serialize the low-volume sending budget across all instances.
  perform pg_catalog.pg_advisory_xact_lock(933104,1);
  if exists(select 1 from public.mkt9_community_rate where challenge_digest=p_challenge_digest)
  or (select count(*) from public.mkt9_community_rate where created_at>now()-interval '1 hour')>=60
  or (select count(*) from public.mkt9_community_rate where email_digest=p_email_digest and created_at>now()-interval '24 hours')>=3
  or exists(select 1 from public.mkt9_community_rate where email_digest=p_email_digest and created_at>now()-interval '10 minutes') then
    return false;
  end if;
  insert into public.mkt9_community_pending(id,payload,code_digest,challenge_digest) values(p_id,p_payload,p_code_digest,p_challenge_digest);
  insert into public.mkt9_community_rate(id,email_digest,challenge_digest) values(p_id,p_email_digest,p_challenge_digest);
  return true;
end $mkt9$;
create function public.mkt9_confirm_email(p_id uuid,p_code_digest text)
returns boolean language plpgsql security invoker set search_path='' as $mkt9$
declare r public.mkt9_community_pending%rowtype;
begin
  select * into r from public.mkt9_community_pending where id=p_id for update;
  if not found or r.expires_at<=now() or r.attempts>=5 then return false; end if;
  if r.code_digest is distinct from p_code_digest then
    update public.mkt9_community_pending set attempts=attempts+1 where id=p_id;
    return false;
  end if;
  begin
    insert into public.mkt9_community_interest(kind,locale,name,email,organization,notice_version,challenge_digest,email_verified_at)
    values(r.payload->>'kind',r.payload->>'locale',r.payload->>'name',r.payload->>'email',r.payload->>'organization',r.payload->>'notice_version',r.challenge_digest,now());
  exception when unique_violation then
    -- Same response for duplicate; never overwrite an earlier lead.
    null;
  end;
  delete from public.mkt9_community_pending where id=p_id;
  return true;
end $mkt9$;
revoke all on function public.mkt9_reserve_email(uuid,text,text,text,jsonb),public.mkt9_confirm_email(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.mkt9_reserve_email(uuid,text,text,text,jsonb),public.mkt9_confirm_email(uuid,text) to service_role;

commit;
-- Before activation: implement approved retention/purge job, verify real JWT owner/non-owner/anon/service_role with synthetic records, validate provider and legal notice.
