-- NC2.3 — Source-verified extensions to the guarded NC2.2 router.
-- RFQ maps only source-confirmed immutable labels to typed event kinds.
-- Existing service-only grant and source guards remain unchanged.
create or replace function public.nc22_route_notification(
  p_event_type text,
  p_source_event_id text,
  p_source_revision integer,
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_scope text;
  v_source_table text;
  v_priority text;
  v_permission text;
  v_event_id uuid;
  v_created uuid;
  v_occurred timestamptz;
  v_recipient_count integer;
  v_source_uuid uuid;
  v_source_bigint bigint;
begin
  if current_user <> 'service_role' then
    raise exception using errcode='42501',message='service-only notification router';
  end if;
  if p_event_type is null
    or p_source_revision is null or p_source_revision < 1
    or p_source_event_id is null
    or char_length(p_source_event_id) not between 1 and 128
    or p_source_event_id !~ '^[A-Za-z0-9:_-]+$' then
    raise exception using errcode='22023',message='invalid notification reference envelope';
  end if;

  -- Explicit event catalogue, hard-coded to NC1.3 and NC2.1 constraints.
  case p_event_type
    when 'workspace.rfq.response_received',
         'workspace.rfq.award_confirmed' then
      v_scope:='workspace';v_source_table:='buyer_rfq_events';v_priority:='action_required';
    when 'workspace.rfq.clarification_requested',
         'workspace.rfq.supplier_confirmation_received' then
      raise exception using errcode='0A000',message='RFQ subtype not yet source-verified';
    when 'workspace.marketplace.opportunity_matched' then
      v_scope:='workspace';v_source_table:='marketplace_notifications';v_priority:='informational';
    when 'workspace.import.failed' then
      v_scope:='workspace';v_source_table:='worker_jobs';v_priority:='action_required';
    when 'workspace.operations.regression_detected' then
      v_scope:='workspace';v_source_table:='operational_alerts';v_priority:='critical';
    when 'platform.registration.submitted' then
      v_scope:='platform';v_source_table:='platform_registration_events';v_priority:='action_required';
      v_permission:='registrations.review';
    when 'platform.registration.information_provided' then
      v_scope:='platform';v_source_table:='platform_registration_events';v_priority:='action_required';
      v_permission:='registrations.review';
    when 'platform.claim.requested' then
      v_scope:='platform';v_source_table:='network_company_claims';v_priority:='action_required';
      v_permission:='claims.read';
    when 'platform.infrastructure.critical_incident' then
      v_scope:='platform';v_source_table:='observability_events';v_priority:='critical';
      v_permission:='platform.audit.read';
    else
      raise exception using errcode='22023',message='unknown notification event type';
  end case;

  if (v_scope='workspace' and p_organization_id is null)
     or (v_scope='platform' and p_organization_id is not null) then
    raise exception using errcode='42501',message='notification scope boundary rejected';
  end if;

  -- Source verification is explicit and does not trust a caller-supplied tenant.
  -- UUID cast only after a strict check; BIGINT alerts require decimal-only ID.
  if v_source_table = 'operational_alerts' then
    if p_source_event_id !~ '^[0-9]{1,18}$' then
      raise exception using errcode='22023',message='invalid alert source ID';
    end if;
    v_source_bigint := p_source_event_id::bigint;
    if p_source_event_id <> v_source_bigint::text then
      raise exception using errcode='22023',message='non-canonical source ID';
    end if;
    select a.last_seen_at into v_occurred from public.operational_alerts a
    where a.id=v_source_bigint and a.organization_id=p_organization_id
      and a.status='open' and a.severity='critical'
      and a.occurrence_count=p_source_revision;
  else
    if p_source_event_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode='22023',message='source ID must be UUID';
    end if;
    v_source_uuid := p_source_event_id::uuid;
    if p_source_event_id <> v_source_uuid::text then
      raise exception using errcode='22023',message='non-canonical source ID';
    end if;

    case p_event_type
      when 'workspace.rfq.response_received','workspace.rfq.award_confirmed' then
        -- Verified immutable RFQ ledger labels: quote_submitted and rfq_award_confirmed.
        -- The same campaign, owner and tenant must own the event.
        select e.created_at into v_occurred
        from public.buyer_rfq_events e
        join public.buyer_rfq_campaigns c on c.id=e.rfq_id
        where e.id=v_source_uuid
          and e.organization_id=p_organization_id
          and c.organization_id=p_organization_id
          and e.owner_user_id=c.owner_user_id
          and e.event_type=case when p_event_type='workspace.rfq.response_received'
             then 'quote_submitted' else 'rfq_award_confirmed' end
          and p_source_revision=1;
      when 'workspace.import.failed' then
        select j.completed_at into v_occurred from public.worker_jobs j
        where j.id=v_source_uuid and j.organization_id=p_organization_id
          and j.status='failed' and j.completed_at is not null
          and j.attempt_number=p_source_revision;
      when 'workspace.marketplace.opportunity_matched' then
        select n.created_at into v_occurred from public.marketplace_notifications n
        join public.marketplace_matches m on m.id=n.match_id
        where n.id=v_source_uuid and n.recipient_organization_id=p_organization_id
          and n.notification_kind='opportunity_match'
          and m.supplier_organization_id=p_organization_id
          and m.request_id=n.request_id and m.status='active'
          and p_source_revision=1
          and exists (
            select 1 from public.marketplace_unlocks u
            where u.request_id=n.request_id and u.supplier_organization_id=p_organization_id
          );
      when 'platform.registration.submitted',
           'platform.registration.information_provided' then
        select e.occurred_at into v_occurred from public.platform_registration_events e
        where e.id=v_source_uuid
          and e.event_type=case when p_event_type='platform.registration.submitted'
               then 'application_submitted' else 'information_provided' end
          and p_source_revision=1;
      when 'platform.claim.requested' then
        select c.created_at into v_occurred from public.network_company_claims c
        where c.id=v_source_uuid and c.status='requested' and p_source_revision=1;
      when 'platform.infrastructure.critical_incident' then
        select e.occurred_at into v_occurred from public.observability_events e
        where e.id=v_source_uuid and e.event_type='system' and e.status='error'
          and e.environment='production' and e.organization_id is null
          and e.owner_id is null and e.operation in ('security_incident','infrastructure_critical')
          and p_source_revision=1;
      else
        raise exception using errcode='0A000',message='source adapter disabled';
    end case;
  end if;

  if v_occurred is null then
    raise exception using errcode='42501',message='source unavailable, stale or not eligible';
  end if;

  if v_scope='workspace' then
    -- No arbitrary broadcast: each branch has its own business recipient rule.
    if p_event_type='workspace.import.failed' then
      select count(*) into v_recipient_count
      from public.organization_memberships m
      join public.worker_jobs j on j.id=v_source_uuid
      where m.organization_id=p_organization_id and m.status='active'
        and (m.role='admin' or m.user_id=j.owner_id);
    elsif p_event_type='workspace.operations.regression_detected' then
      select count(*) into v_recipient_count from public.organization_memberships m
      where m.organization_id=p_organization_id and m.status='active' and m.role='admin';
    elsif p_event_type in ('workspace.rfq.response_received','workspace.rfq.award_confirmed') then
      select count(*) into v_recipient_count from (
        select m.user_id from public.buyer_rfq_events e
        join public.organization_memberships m on m.organization_id=e.organization_id
          and m.user_id=e.owner_user_id and m.status='active'
        where e.id=v_source_uuid and e.organization_id=p_organization_id
        union
        select t.user_id from public.buyer_rfq_events e
        join public.buyer_rfq_team_members t on t.rfq_id=e.rfq_id
          and t.organization_id=e.organization_id and t.status='active'
        join public.organization_memberships m on m.user_id=t.user_id
          and m.organization_id=e.organization_id and m.status='active'
        where e.id=v_source_uuid and e.organization_id=p_organization_id
      ) recipients;
    elsif p_event_type='workspace.marketplace.opportunity_matched' then
      select count(*) into v_recipient_count from public.organization_memberships m
      where m.organization_id=p_organization_id and m.status='active' and m.role in ('admin','member');
    end if;

    if coalesce(v_recipient_count,0) < 1 then
      raise exception using errcode='42501',message='no eligible tenant recipients';
    end if;

    insert into public.workspace_notification_events (
      organization_id,event_type,source_table,source_event_id,source_revision,priority,occurred_at
    ) values (
      p_organization_id,p_event_type,v_source_table,p_source_event_id,p_source_revision,v_priority,v_occurred
    ) on conflict on constraint nc21_workspace_dedupe do nothing
    returning id into v_created;
    if v_created is null then
      select e.id into v_event_id from public.workspace_notification_events e
      where e.organization_id=p_organization_id and e.event_type=p_event_type
        and e.source_table=v_source_table and e.source_event_id=p_source_event_id
        and e.source_revision=p_source_revision;
      return jsonb_build_object('scope','workspace','event_id',v_event_id,
        'created',false,'recipient_count',0,'email_dispatched',false);
    end if;
    v_event_id:=v_created;

    if p_event_type='workspace.import.failed' then
      insert into public.workspace_notification_recipients(event_id,organization_id,recipient_user_id)
      select v_event_id,p_organization_id,m.user_id from public.organization_memberships m
      join public.worker_jobs j on j.id=v_source_uuid
      where m.organization_id=p_organization_id and m.status='active'
        and (m.role='admin' or m.user_id=j.owner_id)
      on conflict on constraint nc21_workspace_one_recipient do nothing;
    elsif p_event_type in ('workspace.rfq.response_received','workspace.rfq.award_confirmed') then
      insert into public.workspace_notification_recipients(event_id,organization_id,recipient_user_id)
      select v_event_id,p_organization_id,user_id from (
        select m.user_id from public.buyer_rfq_events e
        join public.organization_memberships m on m.organization_id=e.organization_id
          and m.user_id=e.owner_user_id and m.status='active'
        where e.id=v_source_uuid and e.organization_id=p_organization_id
        union
        select t.user_id from public.buyer_rfq_events e
        join public.buyer_rfq_team_members t on t.rfq_id=e.rfq_id
          and t.organization_id=e.organization_id and t.status='active'
        join public.organization_memberships m on m.user_id=t.user_id
          and m.organization_id=e.organization_id and m.status='active'
        where e.id=v_source_uuid and e.organization_id=p_organization_id
      ) recipients
      on conflict on constraint nc21_workspace_one_recipient do nothing;
    elsif p_event_type='workspace.operations.regression_detected' then
      insert into public.workspace_notification_recipients(event_id,organization_id,recipient_user_id)
      select v_event_id,p_organization_id,m.user_id from public.organization_memberships m
      where m.organization_id=p_organization_id and m.status='active' and m.role='admin'
      on conflict on constraint nc21_workspace_one_recipient do nothing;
    else
      insert into public.workspace_notification_recipients(event_id,organization_id,recipient_user_id)
      select v_event_id,p_organization_id,m.user_id from public.organization_memberships m
      where m.organization_id=p_organization_id and m.status='active' and m.role in ('admin','member')
      on conflict on constraint nc21_workspace_one_recipient do nothing;
    end if;

    insert into public.workspace_notification_outbox(recipient_id,channel,status,delivered_at)
    select r.id,'in_app','delivered',now()
    from public.workspace_notification_recipients r where r.event_id=v_event_id
    on conflict on constraint nc22_workspace_outbox_unique do nothing;

    select count(*) into v_recipient_count
    from public.workspace_notification_recipients r where r.event_id=v_event_id;
  else
    -- Resolve Platform Owner and explicitly permissioned, ACTIVE Platform staff.
    -- A Platform identity does not grant tenant notifications or source access.
    select count(distinct users.user_id) into v_recipient_count from (
      select pur.user_id from public.platform_user_roles pur
      where pur.role='platform_superadmin' and pur.status='active'
      union
      select ps.user_id from public.platform_staff ps
      join public.platform_staff_roles psr on psr.user_id=ps.user_id and psr.status='active'
      join public.platform_roles pr on pr.role_key=psr.role_key and pr.status='active'
      join public.platform_role_permissions pp on pp.role_key=pr.role_key
      where ps.status='active' and pp.permission_key=v_permission
    ) users;
    if coalesce(v_recipient_count,0) < 1 then
      raise exception using errcode='42501',message='no eligible Platform recipients';
    end if;

    insert into public.platform_notification_events (
      event_type,source_table,source_event_id,source_revision,priority,required_permission_key,occurred_at
    ) values (
      p_event_type,v_source_table,p_source_event_id,p_source_revision,v_priority,v_permission,v_occurred
    ) on conflict on constraint nc21_platform_dedupe do nothing
    returning id into v_created;
    if v_created is null then
      select e.id into v_event_id from public.platform_notification_events e
      where e.event_type=p_event_type and e.source_table=v_source_table
        and e.source_event_id=p_source_event_id and e.source_revision=p_source_revision;
      return jsonb_build_object('scope','platform','event_id',v_event_id,
        'created',false,'recipient_count',0,'email_dispatched',false);
    end if;
    v_event_id:=v_created;

    insert into public.platform_notification_recipients (
      event_id,required_permission_key,recipient_user_id
    )
    select v_event_id,v_permission,users.user_id from (
      select pur.user_id from public.platform_user_roles pur
      where pur.role='platform_superadmin' and pur.status='active'
      union
      select ps.user_id from public.platform_staff ps
      join public.platform_staff_roles psr on psr.user_id=ps.user_id and psr.status='active'
      join public.platform_roles pr on pr.role_key=psr.role_key and pr.status='active'
      join public.platform_role_permissions pp on pp.role_key=pr.role_key
      where ps.status='active' and pp.permission_key=v_permission
    ) users on conflict on constraint nc21_platform_one_recipient do nothing;

    insert into public.platform_notification_outbox(recipient_id,channel,status,delivered_at)
    select r.id,'in_app','delivered',now() from public.platform_notification_recipients r
    where r.event_id=v_event_id
    on conflict on constraint nc22_platform_outbox_unique do nothing;

    select count(*) into v_recipient_count
    from public.platform_notification_recipients r where r.event_id=v_event_id;
  end if;

  if v_recipient_count < 1 then
    raise exception using errcode='42501',message='recipient eligibility changed; transaction aborted';
  end if;
  return jsonb_build_object('scope',v_scope,'event_id',v_event_id,
    'created',true,'recipient_count',v_recipient_count,'email_dispatched',false);
end;
$function$;

revoke all on function public.nc22_route_notification(text,text,integer,uuid)
  from public,anon,authenticated;
grant execute on function public.nc22_route_notification(text,text,integer,uuid)
  to service_role;
