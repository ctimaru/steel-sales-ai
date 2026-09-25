drop function if exists public.p4_transition_inquiry(uuid,text);
drop function if exists private.p4_transition_inquiry_impl(uuid,text);

create or replace function private.p4_transition_inquiry_impl(
  p_inquiry_id uuid,
  p_actor_organization_id uuid,
  p_new_status text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_row public.network_inquiries%rowtype;
  v_allowed boolean := false;
begin
  v_user := (select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if p_new_status not in ('read','responded','declined','closed','withdrawn','blocked') then
    raise exception 'invalid inquiry transition target' using errcode='22023';
  end if;

  select * into v_row
  from public.network_inquiries
  where id=p_inquiry_id
  for update;

  if not found then
    raise exception 'inquiry not found' using errcode='P0002';
  end if;

  if p_new_status='blocked' then
    if not private.is_platform_superadmin() then
      raise exception 'platform superadmin required' using errcode='42501';
    end if;
    if p_actor_organization_id is not null then
      raise exception 'platform block transition must not impersonate an organization'
        using errcode='22023';
    end if;
    v_allowed := v_row.status not in ('closed','withdrawn','blocked');
  else
    if p_actor_organization_id is null then
      raise exception 'actor organization required' using errcode='22023';
    end if;

    if p_actor_organization_id not in (
      v_row.sender_organization_id,
      v_row.recipient_organization_id
    ) then
      raise exception 'actor organization is not a participant'
        using errcode='42501';
    end if;

    if not exists (
      select 1
      from public.organization_memberships om
      where om.organization_id=p_actor_organization_id
        and om.user_id=v_user
        and om.status='active'
        and om.role in ('admin','member')
    ) then
      raise exception 'active organization admin/member membership required'
        using errcode='42501';
    end if;

    if p_new_status='read' then
      v_allowed :=
        p_actor_organization_id=v_row.recipient_organization_id
        and v_row.status='submitted';
    elsif p_new_status='responded' then
      v_allowed :=
        p_actor_organization_id=v_row.recipient_organization_id
        and v_row.status in ('submitted','read');
    elsif p_new_status='declined' then
      v_allowed :=
        p_actor_organization_id=v_row.recipient_organization_id
        and v_row.status in ('submitted','read');
    elsif p_new_status='withdrawn' then
      v_allowed :=
        p_actor_organization_id=v_row.sender_organization_id
        and v_row.status='submitted';
    elsif p_new_status='closed' then
      v_allowed :=
        v_row.status in ('submitted','read','responded','declined');
    end if;
  end if;

  if not v_allowed then
    raise exception 'inquiry state transition not allowed'
      using errcode='22023';
  end if;

  update public.network_inquiries
  set
    status=p_new_status,
    last_activity_at=now()
  where id=v_row.id;

  insert into public.network_inquiry_events(
    inquiry_id,event_type,actor_user_id,actor_organization_id,
    previous_status,new_status
  )
  values(
    v_row.id,p_new_status,v_user,p_actor_organization_id,
    v_row.status,p_new_status
  );

  return jsonb_build_object(
    'inquiry_id',v_row.id,
    'previous_status',v_row.status,
    'status',p_new_status,
    'actor_organization_id',p_actor_organization_id
  );
end;
$function$;

revoke all on function private.p4_transition_inquiry_impl(uuid,uuid,text) from public,anon;
grant execute on function private.p4_transition_inquiry_impl(uuid,uuid,text) to authenticated,service_role;

create or replace function public.p4_transition_inquiry(
  p_inquiry_id uuid,
  p_actor_organization_id uuid,
  p_new_status text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_transition_inquiry_impl(
    p_inquiry_id,p_actor_organization_id,p_new_status
  );
$function$;

revoke all on function public.p4_transition_inquiry(uuid,uuid,text) from public,anon;
grant execute on function public.p4_transition_inquiry(uuid,uuid,text) to authenticated,service_role;

comment on function public.p4_transition_inquiry(uuid,uuid,text) is
  'P4.3 controlled inquiry lifecycle transition with explicit participant organization context. No direct authenticated UPDATE grant exists.';
