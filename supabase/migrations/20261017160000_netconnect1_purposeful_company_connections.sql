-- NET-CONNECT1: purposeful B2B connections, not follows or social feeds.
-- A connection request wraps the existing governed P4 inquiry engine to preserve
-- recipient ownership, participant membership, blocking, rate limits and audit.
-- Never deliver to a provisional/unclaimed company or forge a partner relationship.

create table if not exists public.network_connection_requests (
  inquiry_id uuid primary key references public.network_inquiries(id) on delete restrict,
  sender_organization_id uuid not null references public.organizations(id),
  recipient_network_company_id uuid not null references public.network_companies(id),
  purpose text not null check (purpose in ('offer_products_services','request_products_services','collaboration')),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.network_connection_requests enable row level security;
revoke all on public.network_connection_requests from public, anon, authenticated;
create unique index if not exists netconnect1_one_pending_pair
 on public.network_connection_requests(sender_organization_id,recipient_network_company_id)
 where status='pending';
create index if not exists netconnect1_recent_status_idx
 on public.network_connection_requests(status,created_at desc);

create or replace function private.netconnect1_submit_impl(
 p_sender_organization_id uuid,p_recipient_network_company_id uuid,
 p_purpose text,p_message text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_existing bigint;
 v_subject text;
 v_result jsonb;
 v_inquiry_id uuid;
 v_recipient_org uuid;
begin
 perform private.netux11_require_active_company(p_sender_organization_id);
 if p_purpose not in ('offer_products_services','request_products_services','collaboration') or p_purpose is null
 then raise exception 'Select a valid commercial connection purpose' using errcode='22023'; end if;
 if length(btrim(coalesce(p_message,''))) not between 30 and 2000
 then raise exception 'Describe the commercial purpose (30-2000 characters)' using errcode='22023'; end if;
 -- Existing P4 eligibility / anti-spam / verified recipient / active membership
 -- requirements are enforced again by the submit implementation below.
 select count(*) into v_existing
 from public.network_connection_requests req
 join public.network_inquiries i on i.id=req.inquiry_id
 where i.sender_organization_id=p_sender_organization_id
   and i.recipient_network_company_id=p_recipient_network_company_id
   and req.status='pending';
 if v_existing>0 then
  raise exception 'An unanswered connection request already exists for this company'
    using errcode='22023';
 end if;
 v_subject:=case p_purpose
  when 'offer_products_services' then 'Proposta di fornitura o servizio'
  when 'request_products_services' then 'Richiesta di prodotti o servizi'
  else 'Proposta di collaborazione'
 end;
 v_result:=private.p4_submit_inquiry_impl(
    p_sender_organization_id,p_recipient_network_company_id,v_subject,btrim(p_message));
 v_inquiry_id:=(v_result->>'inquiry_id')::uuid;
 insert into public.network_connection_requests(
  inquiry_id,sender_organization_id,recipient_network_company_id,purpose,status)
 values(v_inquiry_id,p_sender_organization_id,p_recipient_network_company_id,p_purpose,'pending');
 return jsonb_build_object('request_id',v_inquiry_id,'status','pending',
   'purpose',p_purpose,'recipient_organization_id',v_result->>'recipient_organization_id');
end $$;

create or replace function public.netconnect1_submit(
 p_sender_organization_id uuid,p_recipient_network_company_id uuid,
 p_purpose text,p_message text
) returns jsonb language sql volatile security definer set search_path='' as $$
 select private.netconnect1_submit_impl(
  p_sender_organization_id,p_recipient_network_company_id,p_purpose,p_message
 );
$$;

create or replace function private.netconnect1_decide_impl(
 p_request_id uuid,p_actor_organization_id uuid,p_decision text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_req public.network_connection_requests%rowtype;
        v_inq public.network_inquiries%rowtype;
        v_target text;
begin
 perform private.netux11_require_active_company(p_actor_organization_id);
 if p_decision not in ('accepted','declined','withdrawn') or p_decision is null
 then raise exception 'Invalid connection decision' using errcode='22023'; end if;
 select * into v_req from public.network_connection_requests
 where inquiry_id=p_request_id for update;
 if not found then raise exception 'Connection request not found' using errcode='P0002';end if;
 select * into v_inq from public.network_inquiries where id=v_req.inquiry_id for update;
 if not found or v_req.status<>'pending' then
  raise exception 'Connection request is no longer pending' using errcode='22023';
 end if;
 if p_decision='withdrawn' then
   if v_inq.sender_organization_id<>p_actor_organization_id then
    raise exception 'Only sender may withdraw' using errcode='42501';end if;
 else
   if v_inq.recipient_organization_id<>p_actor_organization_id then
    raise exception 'Only recipient may accept or decline' using errcode='42501';end if;
 end if;
 v_target:=case p_decision when 'accepted' then 'responded'
   when 'declined' then 'declined' else 'withdrawn' end;
 -- P4 maintains a full immutable state-change event and validates member roles.
 perform private.p4_transition_inquiry_impl(v_req.inquiry_id,p_actor_organization_id,v_target);
 update public.network_connection_requests
 set status=p_decision,decided_at=now() where inquiry_id=v_req.inquiry_id;
 return jsonb_build_object('request_id',p_request_id,'status',p_decision);
end $$;

create or replace function public.netconnect1_decide(
 p_request_id uuid,p_actor_organization_id uuid,p_decision text
 ) returns jsonb language sql volatile security definer set search_path='' as $$
 select private.netconnect1_decide_impl(p_request_id,p_actor_organization_id,p_decision);
$$;

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
 'inquiry_status',q.inquiry_status,
 'created_at',q.created_at,'decided_at',q.decided_at
 ) order by q.created_at desc,q.inquiry_id),'[]'::jsonb)
 into v_items from (
  select r.inquiry_id,r.purpose,r.status,r.created_at,r.decided_at,
    i.subject,i.body,i.status inquiry_status,i.sender_organization_id,i.recipient_organization_id,
    i.recipient_network_company_id,
    sender.name sender_name,nc.legal_name recipient_name
  from public.network_connection_requests r
  join public.network_inquiries i on i.id=r.inquiry_id
  join public.organizations sender on sender.id=i.sender_organization_id
  join public.network_companies nc on nc.id=i.recipient_network_company_id
  where case when p_box='received' then i.recipient_organization_id=p_organization_id
             else i.sender_organization_id=p_organization_id end
  order by r.created_at desc,r.inquiry_id
  limit least(greatest(coalesce(p_limit,50),1),100)
  offset least(greatest(coalesce(p_offset,0),0),100000)
 )q;
 return jsonb_build_object('items',v_items,'total',v_total,'box',p_box);
end $$;

create or replace function public.netconnect1_list(
 p_organization_id uuid,p_box text default 'received',
 p_limit integer default 50,p_offset integer default 0
 ) returns jsonb language sql stable security definer set search_path='' as $$
 select private.netconnect1_list_impl(p_organization_id,p_box,p_limit,p_offset);
$$;

revoke all on function private.netconnect1_submit_impl(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function private.netconnect1_decide_impl(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.netconnect1_list_impl(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.netconnect1_submit(uuid,uuid,text,text) from public,anon;
revoke all on function public.netconnect1_decide(uuid,uuid,text) from public,anon;
revoke all on function public.netconnect1_list(uuid,text,integer,integer) from public,anon;
grant execute on function public.netconnect1_submit(uuid,uuid,text,text) to authenticated;
grant execute on function public.netconnect1_decide(uuid,uuid,text) to authenticated;
grant execute on function public.netconnect1_list(uuid,text,integer,integer) to authenticated;
