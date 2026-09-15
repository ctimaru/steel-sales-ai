-- P0.2 follow-up: cover the organizations.created_by foreign key surfaced by
-- the Supabase performance advisor after the production tenant rollout.

create index if not exists organizations_created_by_idx
  on public.organizations(created_by);
