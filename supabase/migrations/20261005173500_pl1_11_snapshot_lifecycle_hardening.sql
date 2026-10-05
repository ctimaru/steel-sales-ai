-- PL1.11 — private pricing snapshot lifecycle hardening.
-- Personal commercial snapshots are removed with the owning user/organization,
-- while source price-list references remain restrictive for reproducibility.

begin;

alter table public.pricing_session_lines
  drop constraint if exists pricing_session_lines_session_id_fkey;

alter table public.pricing_session_lines
  add constraint pricing_session_lines_session_id_fkey
  foreign key (session_id)
  references public.pricing_sessions(id)
  on delete cascade;

alter table public.pricing_sessions
  drop constraint if exists pricing_sessions_owner_user_id_fkey;

alter table public.pricing_sessions
  add constraint pricing_sessions_owner_user_id_fkey
  foreign key (owner_user_id)
  references auth.users(id)
  on delete cascade;

alter table public.pricing_sessions
  drop constraint if exists pricing_sessions_organization_id_fkey;

alter table public.pricing_sessions
  add constraint pricing_sessions_organization_id_fkey
  foreign key (organization_id)
  references public.organizations(id)
  on delete cascade;

commit;
