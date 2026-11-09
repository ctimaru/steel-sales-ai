-- OFFICE-PROFILES1 — Ufficio acquisti come profilo assegnabile dalla Direzione Aziendale.
--
-- PROPOSTA, NON APPLICATA A PRODUZIONE. Richiede autorizzazione specifica del founder
-- (migrazione Supabase in produzione). Estende soltanto i valori ammessi di
-- business_role con 'purchasing'. Non cambia RLS, ruoli di permesso (admin/member/viewer)
-- né chi può assegnare i profili: resta private.is_organization_admin().

alter table public.organization_memberships
  drop constraint if exists organization_memberships_business_role_check;
alter table public.organization_memberships
  add constraint organization_memberships_business_role_check
  check (
    business_role is null
    or business_role in ('sales_director', 'salesperson', 'purchasing', 'operations')
  );

alter table public.organization_invitations
  drop constraint if exists organization_invitations_business_role_check;
alter table public.organization_invitations
  add constraint organization_invitations_business_role_check
  check (
    business_role is null
    or business_role in ('sales_director', 'salesperson', 'purchasing', 'operations')
  );

comment on column public.organization_memberships.business_role is
  'Profilo operativo assegnato dalla Direzione Aziendale: sales_director (direzione), salesperson (Ufficio commerciale), purchasing (Ufficio acquisti), operations. Ogni ufficio consulta anche l''altro; la scrittura per area è applicata dall''applicazione, la RLS non cambia.';

create or replace function private.set_organization_member_business_role_impl(
  p_organization_id uuid,
  p_user_id uuid,
  p_business_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status text;
  normalized_business_role text := nullif(trim(lower(p_business_role)), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_organization_admin(p_organization_id) then
    raise exception 'Organization admin role required';
  end if;

  if normalized_business_role is not null
     and normalized_business_role not in ('sales_director', 'salesperson', 'purchasing', 'operations') then
    raise exception 'Unsupported organization business role';
  end if;

  select m.status
  into target_status
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = p_user_id
  for update;

  if not found or target_status <> 'active' then
    raise exception 'Active organization membership not found';
  end if;

  update public.organization_memberships
  set
    business_role = normalized_business_role,
    updated_at = now()
  where organization_id = p_organization_id
    and user_id = p_user_id;
end;
$$;
