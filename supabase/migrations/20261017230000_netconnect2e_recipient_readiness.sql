-- NET-CONNECT2E: recipient readiness, scoped to a real active sender.
-- One bounded server read for Free/Pro. It never invents a connection,
-- exposes the cause of a recipient block, or sends any communication.
create or replace function private.netconnect2e_readiness_impl(
 p_organization_id uuid, p_company_ids uuid[]
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_company uuid;
 v_raw jsonb;
 v_status text;
 v_items jsonb:='[]'::jsonb;
 v_count integer:=0;
begin
 perform private.netux11_require_active_company(p_organization_id);
 if p_company_ids is null or coalesce(array_length(p_company_ids,1),0)>24
    or array_position(p_company_ids,null) is not null then
   raise exception 'Invalid recipient batch' using errcode='22023';
 end if;
 -- The actor must be entitled to initiate a purposeful connection.
 -- A viewer can still explore, but does not see misleading actionable labels.
 for v_company in select distinct x from unnest(p_company_ids) as x loop
  v_count:=v_count+1;
  -- Only canonical published identities may be scored.
  if not exists (
   select 1 from public.network_companies c
    where c.id=v_company and c.publication_status='published'
      and c.archived_at is null
  ) then
   v_status:='unavailable';
  elsif exists (
    select 1 from public.network_connection_requests r
    where r.sender_organization_id=p_organization_id
      and r.recipient_network_company_id=v_company and r.status='accepted'
  ) then v_status:='connected';
  elsif exists (
    select 1 from public.network_connection_requests r
    where r.sender_organization_id=p_organization_id
      and r.recipient_network_company_id=v_company and r.status='pending'
  ) then v_status:='pending';
  else
   v_raw:=private.p4_inquiry_eligibility_impl(p_organization_id,v_company);
   v_status:=case when v_raw->>'eligible'='true' then 'available'
                  else 'unavailable' end;
  end if;
  v_items:=v_items||jsonb_build_array(
    jsonb_build_object('company_id',v_company,'status',v_status)
  );
 end loop;
 return jsonb_build_object('contract','netconnect2e-readiness-v1',
  'organization_id',p_organization_id,'items',v_items);
end $$;
revoke all on function private.netconnect2e_readiness_impl(uuid,uuid[]) from public,anon,authenticated;

create or replace function public.netconnect2e_readiness(
 p_organization_id uuid,p_company_ids uuid[]
) returns jsonb language sql stable security definer set search_path='' as $$
 select private.netconnect2e_readiness_impl(p_organization_id,p_company_ids);
$$;
revoke all on function public.netconnect2e_readiness(uuid,uuid[]) from public,anon;
grant execute on function public.netconnect2e_readiness(uuid,uuid[]) to authenticated;
