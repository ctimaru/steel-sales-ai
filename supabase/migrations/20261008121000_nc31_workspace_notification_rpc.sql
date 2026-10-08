-- NC3.1 — Workspace notification read and personal lifecycle RPCs.
-- No Platform access, no frontend DML grants, no source mutation or email.
-- Read-side SECURITY INVOKER retains NC2.1 tenant and per-recipient RLS.
create or replace function public.nc31_workspace_notifications_read(
  p_organization_id uuid,
  p_filter text default 'all',
  p_limit integer default 20,
  p_offset integer default 0
) returns jsonb
language plpgsql security invoker set search_path = ''
as $fn$
declare
  v_items jsonb;
  v_total bigint;
  v_unread bigint;
  v_filtered bigint;
  v_user uuid;
begin
  v_user := (select auth.uid());
  if v_user is null or p_organization_id is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception using errcode='42501', message='workspace notifications access denied';
  end if;
  if p_filter is null or p_filter not in ('all','unread','commercial','system','archived')
     or p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset not between 0 and 1000 then
    raise exception using errcode='22023',message='invalid notification list options';
  end if;

  select count(*),count(*) filter(where r.read_at is null and r.archived_at is null)
    into v_total,v_unread
  from public.workspace_notification_recipients r
  join public.workspace_notification_events e
    on e.id=r.event_id and e.organization_id=r.organization_id
  where r.organization_id=p_organization_id and r.recipient_user_id=v_user
    and r.archived_at is null;

  select count(*) into v_filtered
  from public.workspace_notification_recipients r
  join public.workspace_notification_events e
    on e.id=r.event_id and e.organization_id=r.organization_id
  where r.organization_id=p_organization_id and r.recipient_user_id=v_user
    and (
      (p_filter='archived' and r.archived_at is not null)
      or (p_filter<>'archived' and r.archived_at is null
          and (p_filter='all'
            or (p_filter='unread' and r.read_at is null)
            or (p_filter='commercial' and (
               e.event_type like 'workspace.rfq.%'
               or e.event_type like 'workspace.marketplace.%'
            ))
            or (p_filter='system' and e.event_type in (
              'workspace.import.failed','workspace.operations.regression_detected'
            ))
          )
      )
    );

  select coalesce(jsonb_agg(to_jsonb(page_rows) order by page_rows.created_at desc,page_rows.id desc),'[]'::jsonb)
    into v_items
  from (
    select r.id,r.event_id,r.organization_id,r.read_at,r.archived_at,r.created_at,
       e.event_type,e.priority,e.source_table,e.source_event_id,e.occurred_at
    from public.workspace_notification_recipients r
    join public.workspace_notification_events e
      on e.id=r.event_id and e.organization_id=r.organization_id
    where r.organization_id=p_organization_id and r.recipient_user_id=v_user
      and (
        (p_filter='archived' and r.archived_at is not null)
        or (p_filter<>'archived' and r.archived_at is null
          and (p_filter='all'
            or (p_filter='unread' and r.read_at is null)
            or (p_filter='commercial' and (
              e.event_type like 'workspace.rfq.%' or e.event_type like 'workspace.marketplace.%'
            ))
            or (p_filter='system' and e.event_type in (
              'workspace.import.failed','workspace.operations.regression_detected'
            ))
          )
        )
      )
    order by r.created_at desc,r.id desc
    limit p_limit offset p_offset
  ) page_rows;

  return jsonb_build_object(
    'items',v_items,'total_count',v_total,'unread_count',v_unread,
    'filtered_count',v_filtered,'limit',p_limit,'offset',p_offset
  );
end;
$fn$;
revoke all on function public.nc31_workspace_notifications_read(uuid,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.nc31_workspace_notifications_read(uuid,text,integer,integer)
  to authenticated;

-- SECURITY DEFINER required only because NC2.1 intentionally revokes browser
-- UPDATE on recipient rows. The function verifies the JWT uid, exact tenant,
-- own recipient, active membership and valid action before touching one row.
create or replace function public.nc31_workspace_notification_set_state(
  p_recipient_id uuid,p_organization_id uuid,p_action text
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid;
  v_record public.workspace_notification_recipients%rowtype;
begin
  v_actor := (select auth.uid());
  if v_actor is null or p_organization_id is null or p_recipient_id is null
    or not public.is_organization_member(p_organization_id,false) then
    raise exception using errcode='42501',message='notification not accessible';
  end if;
  if p_action is null or p_action not in ('read','unread','archive','restore') then
    raise exception using errcode='22023',message='invalid notification action';
  end if;

  select r.* into v_record
  from public.workspace_notification_recipients r
  join public.workspace_notification_events e
    on e.id=r.event_id and e.organization_id=r.organization_id
  where r.id=p_recipient_id and r.organization_id=p_organization_id
    and r.recipient_user_id=v_actor
  for update of r;

  if not found then
    raise exception using errcode='42501',message='notification not accessible';
  end if;

  if p_action='read' then
    update public.workspace_notification_recipients
    set read_at=coalesce(read_at,now()) where id=v_record.id and archived_at is null;
  elsif p_action='unread' then
    update public.workspace_notification_recipients
    set read_at=null where id=v_record.id and archived_at is null;
  elsif p_action='archive' then
    update public.workspace_notification_recipients
    set read_at=coalesce(read_at,now()),
        archived_at=greatest(coalesce(read_at,now()),now())
    where id=v_record.id and archived_at is null;
  elsif p_action='restore' then
    update public.workspace_notification_recipients
    set archived_at=null where id=v_record.id and archived_at is not null;
  end if;

  return jsonb_build_object('ok',true,'recipient_id',v_record.id,'action',p_action);
end;
$fn$;
revoke all on function public.nc31_workspace_notification_set_state(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.nc31_workspace_notification_set_state(uuid,uuid,text)
  to authenticated;
