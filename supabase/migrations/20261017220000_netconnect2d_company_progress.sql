-- NET-CONNECT2D — company-owned Network progress, no personal or cross-tenant data.
-- Read-only contract. Claim/verification/connection acceptance are NEVER inferred.
create or replace function private.netconnect2d_company_progress_impl(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_owned uuid;
begin
  if p_organization_id is null or (select auth.uid()) is null or
     not exists (
       select 1 from public.organization_memberships m
        where m.organization_id=p_organization_id
          and m.user_id=(select auth.uid()) and m.status='active'
     ) then
    raise exception 'Active organization membership required' using errcode='42501';
  end if;
  select l.network_company_id into v_owned
  from public.organization_network_company_links l
  join public.network_companies c on c.id=l.network_company_id
    and c.publication_status='published' and c.archived_at is null
  join public.network_company_claims cl on cl.network_company_id=c.id
    and cl.organization_id=l.organization_id and cl.status='approved'
  where l.organization_id=p_organization_id and l.link_status='active'
  order by l.created_at desc limit 1;

  return jsonb_build_object(
    'contract','netconnect2d-company-growth-v1',
    'organization_id',p_organization_id,
    'owned_company_id',v_owned,
    'claim_requests_pending',(select count(*)::integer from public.network_company_claims cl
      where cl.organization_id=p_organization_id and cl.status in ('requested','under_review')),
    'requests_sent',(select count(*)::integer from public.network_connection_requests r
      where r.sender_organization_id=p_organization_id),
    'requests_accepted',(select count(*)::integer from public.network_connection_requests r
      where r.sender_organization_id=p_organization_id and r.status='accepted'),
    'requests_received_pending',(select count(*)::integer
      from public.network_connection_requests r
      join public.network_inquiries i on i.id=r.inquiry_id
      where i.recipient_organization_id=p_organization_id and r.status='pending')
  );
end $$;
revoke all on function private.netconnect2d_company_progress_impl(uuid)
  from public,anon,authenticated;

create or replace function public.netconnect2d_company_progress(p_organization_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select private.netconnect2d_company_progress_impl(p_organization_id);
$$;
revoke all on function public.netconnect2d_company_progress(uuid) from public,anon;
grant execute on function public.netconnect2d_company_progress(uuid) to authenticated;
