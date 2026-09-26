create or replace function private.p4_inquiry_eligibility_impl(
  p_sender_organization_id uuid,
  p_recipient_network_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_recipient_org uuid;
  v_enabled boolean := true;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.organization_memberships om
    where om.organization_id=p_sender_organization_id
      and om.user_id=v_user
      and om.status='active'
      and om.role in ('admin','member')
  ) then
    return jsonb_build_object('eligible',false,'reason','sender_not_eligible');
  end if;

  select l.organization_id
  into v_recipient_org
  from public.organization_network_company_links l
  join public.network_companies nc
    on nc.id=l.network_company_id
   and nc.publication_status='published'
  join public.network_company_claims c
    on c.organization_id=l.organization_id
   and c.network_company_id=l.network_company_id
   and c.status='approved'
  where l.network_company_id=p_recipient_network_company_id
    and l.link_status='active'
    and exists (
      select 1
      from public.organization_memberships rom
      where rom.organization_id=l.organization_id
        and rom.status='active'
    )
  limit 1;

  if v_recipient_org is null then
    return jsonb_build_object('eligible',false,'reason','recipient_unavailable');
  end if;

  if v_recipient_org=p_sender_organization_id then
    return jsonb_build_object('eligible',false,'reason','self_inquiry');
  end if;

  select coalesce(p.inquiries_enabled,true)
  into v_enabled
  from (select 1) x
  left join public.network_inquiry_preferences p
    on p.organization_id=v_recipient_org;

  if not coalesce(v_enabled,true) then
    return jsonb_build_object('eligible',false,'reason','recipient_unavailable');
  end if;

  if exists (
    select 1
    from public.network_inquiry_blocks b
    where b.blocking_organization_id=v_recipient_org
      and b.blocked_organization_id=p_sender_organization_id
      and b.status='active'
  ) then
    return jsonb_build_object('eligible',false,'reason','recipient_unavailable');
  end if;

  return jsonb_build_object('eligible',true,'reason','eligible');
end;
$function$;

revoke all on function private.p4_inquiry_eligibility_impl(uuid,uuid)
from public,anon;
grant execute on function private.p4_inquiry_eligibility_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p4_inquiry_eligibility(
  p_sender_organization_id uuid,
  p_recipient_network_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p4_inquiry_eligibility_impl(
    p_sender_organization_id,
    p_recipient_network_company_id
  );
$function$;

revoke all on function public.p4_inquiry_eligibility(uuid,uuid)
from public,anon;
grant execute on function public.p4_inquiry_eligibility(uuid,uuid)
to authenticated,service_role;

create or replace function private.p4_get_inquiry_preferences_impl(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_enabled boolean;
begin
  v_user := (select auth.uid());

  if v_user is null
     or not private.p4_org_admin_controls_claimed_company(p_organization_id,v_user) then
    raise exception 'claimed company organization admin required'
      using errcode='42501';
  end if;

  select coalesce(p.inquiries_enabled,true)
  into v_enabled
  from (select 1) x
  left join public.network_inquiry_preferences p
    on p.organization_id=p_organization_id;

  return jsonb_build_object(
    'organization_id',p_organization_id,
    'inquiries_enabled',coalesce(v_enabled,true)
  );
end;
$function$;

revoke all on function private.p4_get_inquiry_preferences_impl(uuid)
from public,anon;
grant execute on function private.p4_get_inquiry_preferences_impl(uuid)
to authenticated,service_role;

create or replace function public.p4_get_inquiry_preferences(
  p_organization_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p4_get_inquiry_preferences_impl(p_organization_id);
$function$;

revoke all on function public.p4_get_inquiry_preferences(uuid)
from public,anon;
grant execute on function public.p4_get_inquiry_preferences(uuid)
to authenticated,service_role;

create or replace function private.p4_list_inquiries_impl(
  p_organization_id uuid,
  p_box text default 'received',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_items jsonb;
  v_total int;
  v_limit int := least(greatest(coalesce(p_limit,50),1),100);
  v_offset int := greatest(coalesce(p_offset,0),0);
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if p_box not in ('received','sent') then
    raise exception 'box must be received or sent' using errcode='22023';
  end if;

  if not exists (
    select 1
    from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user
      and om.status='active'
  ) then
    raise exception 'active organization membership required'
      using errcode='42501';
  end if;

  select count(*)::int
  into v_total
  from public.network_inquiries i
  where case
    when p_box='received' then i.recipient_organization_id=p_organization_id
    else i.sender_organization_id=p_organization_id
  end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',q.id,
      'sender_organization_id',q.sender_organization_id,
      'sender_organization_name',q.sender_organization_name,
      'sender_user_id',q.sender_user_id,
      'recipient_network_company_id',q.recipient_network_company_id,
      'recipient_organization_id',q.recipient_organization_id,
      'recipient_company_name',q.recipient_company_name,
      'subject',q.subject,
      'body',q.body,
      'status',q.status,
      'submitted_at',q.submitted_at,
      'last_activity_at',q.last_activity_at
    )
    order by q.submitted_at desc,q.id
  ),'[]'::jsonb)
  into v_items
  from (
    select
      i.*,
      so.name as sender_organization_name,
      nc.legal_name as recipient_company_name
    from public.network_inquiries i
    join public.organizations so on so.id=i.sender_organization_id
    join public.network_companies nc on nc.id=i.recipient_network_company_id
    where case
      when p_box='received' then i.recipient_organization_id=p_organization_id
      else i.sender_organization_id=p_organization_id
    end
    order by i.submitted_at desc,i.id
    limit v_limit
    offset v_offset
  ) q;

  return jsonb_build_object(
    'items',v_items,
    'total',v_total,
    'limit',v_limit,
    'offset',v_offset,
    'box',p_box,
    'organization_id',p_organization_id
  );
end;
$function$;

comment on function public.p4_inquiry_eligibility(uuid,uuid) is
  'P4.5 authenticated inquiry CTA eligibility. Recipient opt-out/block returns generic unavailable reason.';
comment on function public.p4_get_inquiry_preferences(uuid) is
  'P4.5 claimed-company Organization Admin read model for inquiry preference settings.';
