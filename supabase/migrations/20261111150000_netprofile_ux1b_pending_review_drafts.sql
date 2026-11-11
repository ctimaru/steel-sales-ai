-- NET-PROFILE-UX1.B2 — Prepare private inventory while canonical company is in review.
-- An approved company admin may save private drafts while the company is pending_review.
-- Publication is still forbidden until the canonical profile is itself published.
-- This migration does not publish any company or inventory row.
create or replace function private.netprofile_ux1b_can_manage(p_org uuid,p_company uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select (select auth.uid()) is not null
    and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
    and private.m7_user_can_manage_network_company(p_company,(select auth.uid()))
    and exists (
      select 1 from public.organization_memberships om
      join public.organization_network_company_links l
        on l.organization_id=om.organization_id and l.link_status='active'
      join public.network_company_claims cl
        on cl.organization_id=om.organization_id
       and cl.network_company_id=l.network_company_id
       and cl.status='approved'
      join public.network_companies c on c.id=l.network_company_id
      where om.user_id=(select auth.uid())
        and om.organization_id=p_org and om.status='active' and om.role='admin'
        and l.network_company_id=p_company
        and c.publication_status in ('published','pending_review')
        and c.archived_at is null
    );
$function$;

create or replace function private.netprofile_ux1b_publication_guard()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if new.publication_status='published' and not exists (
    select 1 from public.network_companies c
    join public.organization_network_company_links l
      on l.network_company_id=c.id and l.link_status='active'
    join public.network_company_claims cl
      on cl.network_company_id=c.id
     and cl.organization_id=l.organization_id and cl.status='approved'
    where c.id=new.company_id
      and l.organization_id=new.organization_id
      and c.publication_status='published'
      and c.archived_at is null
  ) then
    raise exception 'Publish the company profile before publishing its stock'
      using errcode='42501';
  end if;
  return new;
end;
$function$;
drop trigger if exists netprofile_ux1b_before_publish on private.netprofile_ux1b_inventory;
create trigger netprofile_ux1b_before_publish
  before insert or update on private.netprofile_ux1b_inventory
  for each row execute function private.netprofile_ux1b_publication_guard();
revoke all on function private.netprofile_ux1b_publication_guard() from public,anon,authenticated;
grant execute on function private.netprofile_ux1b_publication_guard() to service_role;
