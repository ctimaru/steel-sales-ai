-- NC3.1: deep-link resolver never trusts the event's source ID as a URL.
-- It looks up the source against current tenant membership and domain rights.
create or replace function public.nc31_workspace_notification_destination(
  p_recipient_id uuid,
  p_organization_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid;
  v_event public.workspace_notification_events%rowtype;
  v_target uuid;
  v_owner uuid;
  v_rfq uuid;
begin
  v_actor:=(select auth.uid());
  if v_actor is null or p_recipient_id is null or p_organization_id is null
    or not public.is_organization_member(p_organization_id,false) then
    raise exception using errcode='42501',message='notification not accessible';
  end if;

  select e.* into v_event
  from public.workspace_notification_recipients r
  join public.workspace_notification_events e
    on e.id=r.event_id and e.organization_id=r.organization_id
  where r.id=p_recipient_id and r.recipient_user_id=v_actor
    and r.organization_id=p_organization_id;

  if not found then
    raise exception using errcode='42501',message='notification not accessible';
  end if;

  if v_event.event_type like 'workspace.rfq.%' then
    select ev.rfq_id,ev.owner_user_id into v_rfq,v_owner
    from public.buyer_rfq_events ev
    join public.buyer_rfq_campaigns c
      on c.id=ev.rfq_id and c.organization_id=ev.organization_id
    where ev.id=v_event.source_event_id::uuid
      and ev.organization_id=p_organization_id
      and ev.owner_user_id=c.owner_user_id;
    if v_rfq is null then return jsonb_build_object('type','unavailable'); end if;
    if v_owner=v_actor or exists (
      select 1 from public.buyer_rfq_team_members t
      where t.rfq_id=v_rfq and t.user_id=v_actor
        and t.organization_id=p_organization_id and t.status='active'
    ) then
      return jsonb_build_object('type','rfq','id',v_rfq);
    end if;
    return jsonb_build_object('type','unavailable');

  elsif v_event.event_type='workspace.marketplace.opportunity_matched' then
    select n.request_id into v_target
    from public.marketplace_notifications n
    join public.marketplace_matches m
      on m.id=n.match_id and m.request_id=n.request_id
      and m.supplier_organization_id=p_organization_id
    where n.id=v_event.source_event_id::uuid
      and n.recipient_organization_id=p_organization_id
      and n.notification_kind='opportunity_match'
      and m.status='active'
      and exists (
        select 1 from public.marketplace_unlocks u
        where u.request_id=n.request_id and u.supplier_organization_id=p_organization_id
      );
    if v_target is null then return jsonb_build_object('type','unavailable'); end if;
    return jsonb_build_object('type','marketplace','id',v_target);

  elsif v_event.event_type='workspace.import.failed' then
    if exists (
      select 1 from public.worker_jobs j
      join public.organization_memberships m
        on m.organization_id=j.organization_id and m.user_id=v_actor
        and m.status='active'
      where j.id=v_event.source_event_id::uuid
        and j.organization_id=p_organization_id and j.status='failed'
        and (j.owner_id=v_actor or m.role='admin')
    ) then
      return jsonb_build_object('type','uploads');
    end if;
    return jsonb_build_object('type','unavailable');

  elsif v_event.event_type='workspace.operations.regression_detected' then
    if exists (
      select 1 from public.operational_alerts a
      where a.id=v_event.source_event_id::bigint and a.organization_id=p_organization_id
    ) then
      return jsonb_build_object('type','alerts');
    end if;
  end if;

  return jsonb_build_object('type','unavailable');
end;
$fn$;
revoke all on function public.nc31_workspace_notification_destination(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.nc31_workspace_notification_destination(uuid,uuid)
  to authenticated;
