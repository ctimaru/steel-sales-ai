create table public.platform_user_roles (
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null,
  status text not null default 'active',
  granted_by uuid null references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  reason text null,
  constraint platform_user_roles_pkey primary key (user_id, role),
  constraint platform_user_roles_role_check
    check (role in ('platform_superadmin')),
  constraint platform_user_roles_status_check
    check (status in ('active','revoked')),
  constraint platform_user_roles_revocation_check
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    )
);

create unique index platform_user_roles_one_active_superadmin_idx
  on public.platform_user_roles (role)
  where role = 'platform_superadmin' and status = 'active';

alter table public.platform_user_roles enable row level security;

revoke all on table public.platform_user_roles from public;
revoke all on table public.platform_user_roles from anon;
revoke all on table public.platform_user_roles from authenticated;

create or replace function private.is_platform_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.platform_user_roles pur
      where pur.user_id = (select auth.uid())
        and pur.role = 'platform_superadmin'
        and pur.status = 'active'
    );
$function$;

revoke all on function private.is_platform_superadmin() from public;
revoke all on function private.is_platform_superadmin() from anon;
grant execute on function private.is_platform_superadmin() to authenticated, service_role;

create or replace function public.is_platform_superadmin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.is_platform_superadmin();
$function$;

revoke all on function public.is_platform_superadmin() from public;
revoke all on function public.is_platform_superadmin() from anon;
grant execute on function public.is_platform_superadmin() to authenticated, service_role;

insert into public.platform_user_roles (
  user_id,
  role,
  status,
  granted_by,
  reason
)
values (
  'f45fab6e-3da8-41aa-8711-fc1b337a7dde'::uuid,
  'platform_superadmin',
  'active',
  null,
  'P0A.1 initial sole platform superadmin bootstrap'
)
on conflict (user_id, role) do update
set
  status = 'active',
  revoked_at = null,
  reason = excluded.reason;
