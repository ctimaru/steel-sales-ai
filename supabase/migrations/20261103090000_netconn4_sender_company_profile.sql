-- NET-CONN4: link a received connection request to the SENDER's public company
-- profile. Read-model only: no table, column, RLS, grant or data change.
--
-- The connection inbox returned company_id = recipient company, so on received
-- requests the UI linked to the reader's own company. We now also return
-- sender_network_company_id, resolved with the same governed rule used by
-- NET-CONNECT2F: an ACTIVE organization link, backed by an APPROVED claim, to a
-- PUBLISHED, non-archived company. No such company -> null (UI shows no link).

create or replace function private.netconnect1_list_impl(
 p_organization_id uuid,p_box text default 'received',
 p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_total bigint;
begin
 perform private.netux11_require_active_company(p_organization_id);
 if p_box not in ('sent','received') or p_box is null then
  raise exception 'Invalid connection inbox' using errcode='22023';end if;
 if not exists(select 1 from public.organization_memberships m
    where m.organization_id=p_organization_id
      and m.user_id=(select auth.uid()) and m.status='active')
 then raise exception 'Active organization membership required' using errcode='42501';end if;
 select count(*) into v_total
 from public.network_connection_requests r
 join public.network_inquiries i on i.id=r.inquiry_id
 where case when p_box='received' then i.recipient_organization_id=p_organization_id
            else i.sender_organization_id=p_organization_id end;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',q.inquiry_id,'purpose',q.purpose,'status',q.status,
 'subject',q.subject,'message',q.body,
 'sender_organization_id',q.sender_organization_id,
 'recipient_organization_id',q.recipient_organization_id,
 'sender_name',q.sender_name,'recipient_name',q.recipient_name,
 'company_id',q.recipient_network_company_id,
 'sender_network_company_id',q.sender_network_company_id,
 'inquiry_status',q.inquiry_status,
 'created_at',q.created_at,'decided_at',q.decided_at
 ) order by q.created_at desc,q.inquiry_id),'[]'::jsonb)
 into v_items from (
  select r.inquiry_id,r.purpose,r.status,r.created_at,r.decided_at,
    i.subject,i.body,i.status inquiry_status,i.sender_organization_id,i.recipient_organization_id,
    i.recipient_network_company_id,
    sender.name sender_name,nc.legal_name recipient_name,
    sc.network_company_id sender_network_company_id
  from public.network_connection_requests r
  join public.network_inquiries i on i.id=r.inquiry_id
  join public.organizations sender on sender.id=i.sender_organization_id
  join public.network_companies nc on nc.id=i.recipient_network_company_id
  left join lateral (
   select l.network_company_id
   from public.organization_network_company_links l
   join public.network_company_claims cl on cl.organization_id=l.organization_id
     and cl.network_company_id=l.network_company_id and cl.status='approved'
   join public.network_companies c on c.id=l.network_company_id
     and c.publication_status='published' and c.archived_at is null
   where l.organization_id=i.sender_organization_id and l.link_status='active'
   order by l.created_at desc limit 1
  ) sc on true
  where case when p_box='received' then i.recipient_organization_id=p_organization_id
             else i.sender_organization_id=p_organization_id end
  order by r.created_at desc,r.inquiry_id
  limit least(greatest(coalesce(p_limit,50),1),100)
  offset least(greatest(coalesce(p_offset,0),0),100000)
 )q;
 return jsonb_build_object('items',v_items,'total',v_total,'box',p_box);
end $$;

-- create or replace keeps existing privileges; restate them defensively.
revoke all on function private.netconnect1_list_impl(uuid,text,integer,integer) from public,anon,authenticated;
