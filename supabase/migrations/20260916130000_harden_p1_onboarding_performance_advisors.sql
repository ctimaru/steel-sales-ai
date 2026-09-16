-- P1.1 performance hardening after production Advisor review.
-- Consolidate duplicate permissive SELECT policies on organization_memberships
-- and index the new P1.1 auth-user foreign keys.

drop policy if exists organization_memberships_admin_select on public.organization_memberships;
drop policy if exists organization_memberships_self_select on public.organization_memberships;

create policy organization_memberships_select
on public.organization_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_organization_admin(organization_id)
);

create index if not exists organization_invitations_auth_user_id_idx
  on public.organization_invitations (auth_user_id);

create index if not exists organization_invitations_invited_by_idx
  on public.organization_invitations (invited_by);

create index if not exists organizations_onboarding_updated_by_idx
  on public.organizations (onboarding_updated_by);
