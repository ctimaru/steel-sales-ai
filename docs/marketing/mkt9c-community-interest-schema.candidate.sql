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
create index mkt9_community_interest_status_idx on public.mkt9_community_interest(status,created_at desc);
comment on table public.mkt9_community_interest is 'Non-binding contact requests; email ownership not verified. Never memberships, revenue, investor access or commitments.';
commit;
-- Before activation: implement approved retention/purge job, verify real JWT owner/non-owner/anon/service_role with synthetic records, validate provider and legal notice.
