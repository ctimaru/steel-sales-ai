-- NC3.2 — private Platform notification center.
-- Read uses SECURITY INVOKER + NC2.1 RLS. Mutations use narrow
-- SECURITY DEFINER because direct browser DML is intentionally revoked.
create or replace function public.nc32_platform_notifications_read(
  p_filter text default 'all', p_limit integer default 20, p_offset integer default 0
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_user uuid := (select auth.uid());
v_total bigint; v_unread bigint; v_filtered bigint; v_items jsonb;
begin
  if v_user is null or not public.has_platform_permission('platform.console.access') then
    raise exception using errcode='42501',message='Platform notification access denied';
  end if;
  if p_filter is null or p_filter not in
      ('all','unread','registrations','claims','incidents','archived')
     or p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset not between 0 and 1000 then
    raise exception using errcode='22023',message='invalid Platform notification list options';
  end if;

  select count(*),count(*) filter(where r.read_at is null)
    into v_total,v_unread
  from public.platform_notification_recipients r
  join public.platform_notification_events e on e.id=r.event_id
    and e.required_permission_key=r.required_permission_key
  where r.recipient_user_id=v_user and r.archived_at is null
    and public.has_platform_permission(e.required_permission_key);

  select count(*) into v_filtered
  from public.platform_notification_recipients r
  join public.platform_notification_events e on e.id=r.event_id
    and e.required_permission_key=r.required_permission_key
  where r.recipient_user_id=v_user
    and public.has_platform_permission(e.required_permission_key)
    and (
      (p_filter='archived' and r.archived_at is not null)
      or (p_filter<>'archived' and r.archived_at is null and
       (p_filter='all' or (p_filter='unread' and r.read_at is null)
        or (p_filter='registrations' and e.event_type like 'platform.registration.%')
        or (p_filter='claims' and e.event_type='platform.claim.requested')
        or (p_filter='incidents' and e.event_type='platform.infrastructure.critical_incident')))
    );

  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.created_at desc, rows.id desc),'[]'::jsonb)
    into v_items from (
      select r.id,r.event_id,r.read_at,r.archived_at,r.created_at,
       e.event_type,e.priority,e.source_table,e.source_event_id,
       e.required_permission_key,e.occurred_at
      from public.platform_notification_recipients r
      join public.platform_notification_events e on e.id=r.event_id
       and e.required_permission_key=r.required_permission_key
      where r.recipient_user_id=v_user
       and public.has_platform_permission(e.required_permission_key)
       and (
        (p_filter='archived' and r.archived_at is not null)
        or (p_filter<>'archived' and r.archived_at is null and
         (p_filter='all' or (p_filter='unread' and r.read_at is null)
          or (p_filter='registrations' and e.event_type like 'platform.registration.%')
          or (p_filter='claims' and e.event_type='platform.claim.requested')
          or (p_filter='incidents' and e.event_type='platform.infrastructure.critical_incident')))
       )
      order by r.created_at desc,r.id desc
      limit p_limit offset p_offset
    ) rows;

  return jsonb_build_object('items',v_items,'total_count',v_total,
    'unread_count',v_unread,'filtered_count',v_filtered,
    'limit',p_limit,'offset',p_offset);
end;
$fn$;
revoke all on function public.nc32_platform_notifications_read(text,integer,integer)
 from public,anon,authenticated;
grant execute on function public.nc32_platform_notifications_read(text,integer,integer)
 to authenticated;

create or replace function public.nc32_platform_notification_set_state(
 p_recipient_id uuid,p_action text
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_user uuid := (select auth.uid());
v_recipient public.platform_notification_recipients%rowtype;
begin
  if v_user is null or p_recipient_id is null or
    not public.has_platform_permission('platform.console.access') then
    raise exception using errcode='42501',message='Platform notification not accessible';
  end if;
  if p_action is null or p_action not in ('read','unread','archive','restore') then
    raise exception using errcode='22023',message='invalid notification action';
  end if;
  select r.* into v_recipient
  from public.platform_notification_recipients r
  join public.platform_notification_events e on e.id=r.event_id
    and e.required_permission_key=r.required_permission_key
  where r.id=p_recipient_id and r.recipient_user_id=v_user
    and public.has_platform_permission(e.required_permission_key)
  for update of r;
  if not found then
    raise exception using errcode='42501',message='Platform notification not accessible';
  end if;
  if p_action='read' then
    update public.platform_notification_recipients
      set read_at=coalesce(read_at,now())
      where id=v_recipient.id and archived_at is null;
  elsif p_action='unread' then
    update public.platform_notification_recipients
      set read_at=null where id=v_recipient.id and archived_at is null;
  elsif p_action='archive' then
    update public.platform_notification_recipients
      set read_at=coalesce(read_at,now()),
      archived_at=greatest(coalesce(read_at,now()),now())
      where id=v_recipient.id and archived_at is null;
  elsif p_action='restore' then
    update public.platform_notification_recipients
      set archived_at=null where id=v_recipient.id and archived_at is not null;
  end if;
  return jsonb_build_object('ok',true,'recipient_id',v_recipient.id,'action',p_action);
end;
$fn$;
revoke all on function public.nc32_platform_notification_set_state(uuid,text)
 from public,anon,authenticated;
grant execute on function public.nc32_platform_notification_set_state(uuid,text)
 to authenticated;

-- Resolve destinations only from own assigned reference with CURRENT permission.
-- Never accept URLs, source IDs, or another user's recipient as input.
create or replace function public.nc32_platform_notification_destination(
  p_recipient_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_user uuid := (select auth.uid());
 v_event public.platform_notification_events%rowtype;
 v_application uuid;
begin
  if v_user is null or p_recipient_id is null
    or not public.has_platform_permission('platform.console.access') then
    raise exception using errcode='42501',message='Platform notification not accessible';
  end if;
  select e.* into v_event from public.platform_notification_recipients r
  join public.platform_notification_events e on e.id=r.event_id
    and e.required_permission_key=r.required_permission_key
  where r.id=p_recipient_id and r.recipient_user_id=v_user
    and public.has_platform_permission(e.required_permission_key);
  if not found then
    raise exception using errcode='42501',message='Platform notification not accessible';
  end if;
  if v_event.event_type in (
     'platform.registration.submitted','platform.registration.information_provided'
    ) and public.has_platform_permission('registrations.read') then
    select re.application_id into v_application
    from public.platform_registration_events re
    join public.company_registration_applications a on a.id=re.application_id
    where re.id=v_event.source_event_id::uuid
      and re.event_type=case when v_event.event_type='platform.registration.submitted'
        then 'application_submitted' else 'information_provided' end;
    if v_application is not null then
      return jsonb_build_object('type','registration','id',v_application);
    end if;
  elsif v_event.event_type='platform.claim.requested'
    and public.has_platform_permission('claims.read') then
    if exists(select 1 from public.network_company_claims c
       where c.id=v_event.source_event_id::uuid and c.status='requested') then
      return jsonb_build_object('type','claims');
    end if;
  elsif v_event.event_type='platform.infrastructure.critical_incident'
    and public.has_platform_permission('platform.audit.read') then
    if exists(select 1 from public.observability_events o
       where o.id=v_event.source_event_id::uuid and o.event_type='system'
         and o.status='error' and o.environment='production'
         and o.organization_id is null and o.owner_id is null
         and o.operation in ('security_incident','infrastructure_critical')) then
      return jsonb_build_object('type','platform');
    end if;
  end if;
  return jsonb_build_object('type','unavailable');
end;
$fn$;
revoke all on function public.nc32_platform_notification_destination(uuid)
 from public,anon,authenticated;
grant execute on function public.nc32_platform_notification_destination(uuid)
 to authenticated;
