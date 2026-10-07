
create or replace function private.rfqh13_award_fingerprint(
  p_rfq_id uuid,
  p_reason text,
  p_allocations jsonb
)
returns text
language plpgsql
stable
set search_path=''
as $$
declare
  v_allocations jsonb;
  v_payload jsonb;
begin
  if jsonb_typeof(coalesce(p_allocations,'[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_allocations,'[]'::jsonb)) = 0 then
    raise exception 'Award allocations are required';
  end if;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'line_id', item->>'line_id',
        'supplier_id', item->>'supplier_id',
        'awarded_tonnes', round((item->>'awarded_tonnes')::numeric,6)
      )
      order by item->>'line_id', item->>'supplier_id', (item->>'awarded_tonnes')::numeric
    ),
    '[]'::jsonb
  )
  into v_allocations
  from jsonb_array_elements(p_allocations) item;
  v_payload := jsonb_build_object(
    'rfq_id',p_rfq_id,
    'reason',btrim(coalesce(p_reason,'')),
    'allocations',v_allocations
  );
  return encode(extensions.digest(convert_to(v_payload::text,'utf8'),'sha256'),'hex');
end;
$$;

create or replace function private.rfqh13_po_fingerprint(
  p_po_draft_id uuid,
  p_buyer_message text,
  p_confirmation_due_at timestamptz
)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_po public.buyer_purchase_order_drafts%rowtype;
  v_payload jsonb;
begin
  select * into v_po
  from public.buyer_purchase_order_drafts p
  where p.id=p_po_draft_id;
  if not found then raise exception 'PO draft not found'; end if;
  v_payload := jsonb_build_object(
    'po_draft_id',v_po.id,
    'rfq_id',v_po.rfq_id,
    'quote_revision_no',v_po.quote_revision_no,
    'currency_code',v_po.currency_code,
    'total_tonnes',round(v_po.total_tonnes,6),
    'total_eur',round(v_po.total_eur,2),
    'incoterm',v_po.incoterm,
    'payment_terms',v_po.payment_terms,
    'delivery_date',v_po.delivery_date,
    'lead_time_days',v_po.lead_time_days,
    'notes',v_po.notes,
    'buyer_message',nullif(btrim(coalesce(p_buyer_message,'')),''),
    'confirmation_due_at',p_confirmation_due_at
  );
  return encode(extensions.digest(convert_to(v_payload::text,'utf8'),'sha256'),'hex');
end;
$$;

create or replace function private.rfqh13_set_governance_impl(
  p_organization_id uuid,
  p_require_award_approval boolean,
  p_require_po_approval boolean,
  p_approval_expiry_hours integer,
  p_operational_event_retention_days integer,
  p_webhook_payload_retention_days integer,
  p_commercial_record_retention_days integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.buyer_procurement_governance%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.rfqh13_is_org_admin(p_organization_id,v_user_id) then
    raise exception 'Organization admin role required' using errcode='42501';
  end if;
  insert into public.buyer_procurement_governance(
    organization_id,require_award_approval,require_po_approval,
    approval_expiry_hours,operational_event_retention_days,
    webhook_payload_retention_days,commercial_record_retention_days,
    updated_by,updated_at
  ) values(
    p_organization_id,
    coalesce(p_require_award_approval,false),
    coalesce(p_require_po_approval,false),
    coalesce(p_approval_expiry_hours,168),
    coalesce(p_operational_event_retention_days,730),
    coalesce(p_webhook_payload_retention_days,90),
    p_commercial_record_retention_days,
    v_user_id,now()
  )
  on conflict(organization_id) do update set
    require_award_approval=excluded.require_award_approval,
    require_po_approval=excluded.require_po_approval,
    approval_expiry_hours=excluded.approval_expiry_hours,
    operational_event_retention_days=excluded.operational_event_retention_days,
    webhook_payload_retention_days=excluded.webhook_payload_retention_days,
    commercial_record_retention_days=excluded.commercial_record_retention_days,
    updated_by=v_user_id,
    updated_at=now()
  returning * into v_row;
  return to_jsonb(v_row) || jsonb_build_object(
    'retention_enforcement','policy_only',
    'automatic_commercial_purge',false
  );
end;
$$;

create or replace function private.rfqh13_set_team_member_impl(
  p_rfq_id uuid,
  p_user_id uuid,
  p_role text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_status text := coalesce(p_status,'active');
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.rfqh13_can_manage_team(p_rfq_id,v_actor) then
    raise exception 'RFQ owner or organization admin required' using errcode='42501';
  end if;
  if p_role not in ('collaborator','approver') then raise exception 'Unsupported procurement team role'; end if;
  if v_status not in ('active','revoked') then raise exception 'Unsupported procurement team status'; end if;
  select * into v_campaign from public.buyer_rfq_campaigns r where r.id=p_rfq_id;
  if not found then raise exception 'RFQ not found'; end if;
  if p_user_id=v_campaign.owner_user_id then raise exception 'RFQ owner already has implicit owner access'; end if;
  if not exists(
    select 1 from public.organization_memberships m
    where m.organization_id=v_campaign.organization_id
      and m.user_id=p_user_id
      and m.status='active'
  ) then raise exception 'Target user must be an active organization member'; end if;

  insert into public.buyer_rfq_team_members(
    rfq_id,user_id,organization_id,role,status,added_by,revoked_at,updated_at
  ) values(
    p_rfq_id,p_user_id,v_campaign.organization_id,p_role,v_status,v_actor,
    case when v_status='revoked' then now() else null end,now()
  )
  on conflict(rfq_id,user_id) do update set
    role=excluded.role,status=excluded.status,added_by=v_actor,
    revoked_at=case when excluded.status='revoked' then now() else null end,
    updated_at=now();

  perform private.rfqh3_log_event(
    p_rfq_id,null,v_campaign.owner_user_id,v_campaign.organization_id,
    case when v_status='active' then 'procurement_team_member_set' else 'procurement_team_member_revoked' end,
    jsonb_build_object('user_id',p_user_id,'role',p_role,'status',v_status),
    v_actor
  );
  return jsonb_build_object('rfq_id',p_rfq_id,'user_id',p_user_id,'role',p_role,'status',v_status);
end;
$$;

create or replace function private.rfqh13_request_approval_impl(
  p_rfq_id uuid,
  p_action_type text,
  p_po_draft_id uuid,
  p_reason text,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_governance public.buyer_procurement_governance%rowtype;
  v_required boolean;
  v_hash text;
  v_expiry_hours integer;
  v_existing public.buyer_procurement_approvals%rowtype;
  v_approval public.buyer_procurement_approvals%rowtype;
  v_due timestamptz;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_action_type not in ('award','po_issue') then raise exception 'Unsupported approval action'; end if;
  if not private.rfqh13_can_manage_rfq(p_rfq_id,v_actor) then
    raise exception 'RFQ collaborator access required' using errcode='42501';
  end if;
  select * into v_campaign from public.buyer_rfq_campaigns r where r.id=p_rfq_id;
  if not found then raise exception 'RFQ not found'; end if;
  select * into v_governance from public.buyer_procurement_governance g
  where g.organization_id=v_campaign.organization_id;
  v_expiry_hours:=coalesce(v_governance.approval_expiry_hours,168);
  v_required:=case p_action_type
    when 'award' then coalesce(v_governance.require_award_approval,false)
    else coalesce(v_governance.require_po_approval,false)
  end;
  if not v_required then return jsonb_build_object('required',false,'status','not_required'); end if;

  if p_action_type='award' then
    v_hash:=private.rfqh13_award_fingerprint(
      p_rfq_id,p_reason,coalesce(p_context->'allocations','[]'::jsonb)
    );
  else
    if p_po_draft_id is null then raise exception 'PO draft is required'; end if;
    if not exists(select 1 from public.buyer_purchase_order_drafts p where p.id=p_po_draft_id and p.rfq_id=p_rfq_id)
      then raise exception 'PO draft does not belong to RFQ'; end if;
    begin
      v_due:=nullif(p_context->>'confirmation_due_at','')::timestamptz;
    exception when others then
      raise exception 'Invalid PO confirmation deadline';
    end;
    v_hash:=private.rfqh13_po_fingerprint(p_po_draft_id,p_context->>'buyer_message',v_due);
  end if;

  update public.buyer_procurement_approvals
  set status='expired',updated_at=now()
  where rfq_id=p_rfq_id and action_type=p_action_type
    and coalesce(po_draft_id,'00000000-0000-0000-0000-000000000000'::uuid)
        =coalesce(p_po_draft_id,'00000000-0000-0000-0000-000000000000'::uuid)
    and status in ('pending','approved') and expires_at<=now();

  select * into v_existing
  from public.buyer_procurement_approvals a
  where a.rfq_id=p_rfq_id and a.action_type=p_action_type
    and coalesce(a.po_draft_id,'00000000-0000-0000-0000-000000000000'::uuid)
        =coalesce(p_po_draft_id,'00000000-0000-0000-0000-000000000000'::uuid)
    and a.payload_sha256=v_hash and a.status in ('pending','approved') and a.expires_at>now()
  order by case a.status when 'approved' then 0 else 1 end,a.requested_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'required',true,'approval_id',v_existing.id,'status',v_existing.status,
      'expires_at',v_existing.expires_at,'payload_sha256',v_existing.payload_sha256
    );
  end if;

  insert into public.buyer_procurement_approvals(
    rfq_id,po_draft_id,organization_id,action_type,payload_sha256,status,
    reason,requested_by,expires_at
  ) values(
    p_rfq_id,p_po_draft_id,v_campaign.organization_id,p_action_type,v_hash,'pending',
    nullif(btrim(coalesce(p_reason,'')),''),v_actor,now()+make_interval(hours=>v_expiry_hours)
  )
  returning * into v_approval;

  perform private.rfqh3_log_event(
    p_rfq_id,null,v_campaign.owner_user_id,v_campaign.organization_id,
    'procurement_approval_requested',
    jsonb_build_object(
      'approval_id',v_approval.id,'action_type',p_action_type,
      'po_draft_id',p_po_draft_id,'expires_at',v_approval.expires_at,
      'payload_sha256',v_hash
    ),v_actor
  );
  return jsonb_build_object(
    'required',true,'approval_id',v_approval.id,'status',v_approval.status,
    'expires_at',v_approval.expires_at,'payload_sha256',v_hash
  );
end;
$$;

create or replace function private.rfqh13_decide_approval_impl(
  p_approval_id uuid,
  p_decision text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_approval public.buyer_procurement_approvals%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_status text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into v_approval from public.buyer_procurement_approvals a where a.id=p_approval_id for update;
  if not found then raise exception 'Approval request not found'; end if;
  if not private.rfqh13_can_approve_rfq(v_approval.rfq_id,v_actor) then
    raise exception 'Procurement approver role required' using errcode='42501';
  end if;
  if v_approval.requested_by=v_actor then raise exception 'Requester cannot approve or reject own request'; end if;
  if v_approval.status<>'pending' then raise exception 'Approval request is not pending'; end if;
  select * into v_campaign from public.buyer_rfq_campaigns r where r.id=v_approval.rfq_id;
  if v_approval.expires_at<=now() then
    update public.buyer_procurement_approvals set status='expired',updated_at=now() where id=v_approval.id;
    raise exception 'Approval request has expired';
  end if;
  if p_decision='rejected' and char_length(btrim(coalesce(p_note,'')))<3 then
    raise exception 'Rejection note is required';
  end if;
  v_status:=p_decision;
  update public.buyer_procurement_approvals
  set status=v_status,decided_by=v_actor,decided_at=now(),
      decision_note=nullif(btrim(coalesce(p_note,'')),''),updated_at=now()
  where id=v_approval.id;

  perform private.rfqh3_log_event(
    v_approval.rfq_id,null,v_campaign.owner_user_id,v_approval.organization_id,
    'procurement_approval_'||v_status,
    jsonb_build_object(
      'approval_id',v_approval.id,'action_type',v_approval.action_type,
      'po_draft_id',v_approval.po_draft_id,'decision_note',nullif(btrim(coalesce(p_note,'')),'')
    ),v_actor
  );
  return jsonb_build_object('approval_id',v_approval.id,'status',v_status);
end;
$$;

create or replace function private.rfqh13_assert_award_approval(
  p_rfq_id uuid,p_reason text,p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org_id uuid;
  v_required boolean;
  v_hash text;
  v_approval_id uuid;
begin
  select r.organization_id into v_org_id from public.buyer_rfq_campaigns r where r.id=p_rfq_id;
  select coalesce(g.require_award_approval,false) into v_required
  from public.buyer_procurement_governance g where g.organization_id=v_org_id;
  if not coalesce(v_required,false) then return null; end if;
  v_hash:=private.rfqh13_award_fingerprint(p_rfq_id,p_reason,p_allocations);
  select a.id into v_approval_id
  from public.buyer_procurement_approvals a
  where a.rfq_id=p_rfq_id and a.action_type='award' and a.po_draft_id is null
    and a.payload_sha256=v_hash and a.status='approved' and a.expires_at>now()
  order by a.decided_at desc limit 1;
  if v_approval_id is null then raise exception 'RFQH13 award approval required'; end if;
  return v_approval_id;
end;
$$;

create or replace function private.rfqh13_assert_po_approval(
  p_po_draft_id uuid,p_buyer_message text,p_confirmation_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_rfq_id uuid;
  v_org_id uuid;
  v_required boolean;
  v_hash text;
  v_approval_id uuid;
begin
  select p.rfq_id,p.organization_id into v_rfq_id,v_org_id
  from public.buyer_purchase_order_drafts p where p.id=p_po_draft_id;
  select coalesce(g.require_po_approval,false) into v_required
  from public.buyer_procurement_governance g where g.organization_id=v_org_id;
  if not coalesce(v_required,false) then return null; end if;
  v_hash:=private.rfqh13_po_fingerprint(p_po_draft_id,p_buyer_message,p_confirmation_due_at);
  select a.id into v_approval_id
  from public.buyer_procurement_approvals a
  where a.rfq_id=v_rfq_id and a.po_draft_id=p_po_draft_id and a.action_type='po_issue'
    and a.payload_sha256=v_hash and a.status='approved' and a.expires_at>now()
  order by a.decided_at desc limit 1;
  if v_approval_id is null then raise exception 'RFQH13 PO approval required'; end if;
  return v_approval_id;
end;
$$;

create or replace function private.rfqh13_consume_approval(
  p_approval_id uuid,p_actor uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_approval_id is null then return; end if;
  update public.buyer_procurement_approvals
  set status='consumed',consumed_at=now(),updated_at=now()
  where id=p_approval_id and status='approved' and expires_at>now();
  if not found then raise exception 'RFQH13 approved gate is no longer consumable'; end if;
end;
$$;

create or replace function private.rfqh13_mark_stale_dispatch_failed_impl(
  p_dispatch_id uuid,p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_reason text:=btrim(coalesce(p_reason,'Manual RFQH13 recovery'));
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_dispatch from public.buyer_rfq_dispatches d where d.id=p_dispatch_id for update;
  if not found then raise exception 'Dispatch not found'; end if;
  if not private.rfqh13_can_manage_rfq(v_dispatch.rfq_id,v_actor) then
    raise exception 'RFQ collaborator access required' using errcode='42501';
  end if;
  if v_dispatch.status not in ('queued','sending') then raise exception 'Only queued or sending dispatches can be recovered'; end if;
  if v_dispatch.provider_message_id is not null then raise exception 'Dispatch has provider evidence and cannot be force-failed'; end if;
  if coalesce(v_dispatch.last_attempt_at,v_dispatch.queued_at,v_dispatch.created_at)>now()-interval '15 minutes' then
    raise exception 'Dispatch is not stale yet';
  end if;
  if char_length(v_reason)>1000 then raise exception 'Recovery reason too long'; end if;
  select * into v_campaign from public.buyer_rfq_campaigns r where r.id=v_dispatch.rfq_id;
  update public.buyer_rfq_dispatches
  set status='failed',last_error='RFQH13 recovery: '||v_reason,updated_at=now()
  where id=v_dispatch.id;
  update public.buyer_rfq_suppliers
  set status='failed',last_error='RFQH13 recovery: '||v_reason,updated_at=now()
  where id=v_dispatch.supplier_id and status in ('draft','queued','sending');
  perform private.rfqh3_log_event(
    v_dispatch.rfq_id,v_dispatch.supplier_id,v_campaign.owner_user_id,
    v_dispatch.organization_id,'dispatch_recovery_force_failed',
    jsonb_build_object('dispatch_id',v_dispatch.id,'previous_status',v_dispatch.status,'reason',v_reason),
    v_actor
  );
  return jsonb_build_object('dispatch_id',v_dispatch.id,'previous_status',v_dispatch.status,'status','failed');
end;
$$;

create or replace function private.rfqh13_governance_state_impl(p_rfq_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_role text;
  v_can_manage boolean;
  v_can_manage_team boolean;
  v_can_approve boolean;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.rfqh13_can_view_rfq(p_rfq_id,v_actor) then raise exception 'RFQ not accessible' using errcode='42501'; end if;
  select * into v_campaign from public.buyer_rfq_campaigns r where r.id=p_rfq_id;
  v_can_manage:=private.rfqh13_can_manage_rfq(p_rfq_id,v_actor);
  v_can_manage_team:=private.rfqh13_can_manage_team(p_rfq_id,v_actor);
  v_can_approve:=private.rfqh13_can_approve_rfq(p_rfq_id,v_actor);
  v_role:=case
    when v_campaign.owner_user_id=v_actor then 'owner'
    when private.rfqh13_is_org_admin(v_campaign.organization_id,v_actor) then 'admin'
    when exists(select 1 from public.buyer_rfq_team_members tm where tm.rfq_id=p_rfq_id and tm.user_id=v_actor and tm.status='active' and tm.role='approver') then 'approver'
    when exists(select 1 from public.buyer_rfq_team_members tm where tm.rfq_id=p_rfq_id and tm.user_id=v_actor and tm.status='active' and tm.role='collaborator') then 'collaborator'
    else 'viewer'
  end;

  select jsonb_build_object(
    'contract','RFQH13-governance-v1','rfq_id',p_rfq_id,'organization_id',v_campaign.organization_id,
    'current_user',jsonb_build_object(
      'role',v_role,'can_manage',v_can_manage,'can_manage_team',v_can_manage_team,'can_approve',v_can_approve,
      'is_org_admin',private.rfqh13_is_org_admin(v_campaign.organization_id,v_actor)
    ),
    'governance',coalesce((
      select jsonb_build_object(
        'require_award_approval',g.require_award_approval,'require_po_approval',g.require_po_approval,
        'approval_expiry_hours',g.approval_expiry_hours,
        'operational_event_retention_days',g.operational_event_retention_days,
        'webhook_payload_retention_days',g.webhook_payload_retention_days,
        'commercial_record_retention_days',g.commercial_record_retention_days,
        'retention_enforcement','policy_only','automatic_commercial_purge',false
      )
      from public.buyer_procurement_governance g where g.organization_id=v_campaign.organization_id
    ),jsonb_build_object(
      'require_award_approval',false,'require_po_approval',false,'approval_expiry_hours',168,
      'operational_event_retention_days',730,'webhook_payload_retention_days',90,
      'commercial_record_retention_days',null,'retention_enforcement','policy_only','automatic_commercial_purge',false
    )),
    'team',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',tm.user_id,'email',lower(u.email),'role',tm.role,'status',tm.status,
        'added_by',tm.added_by,'created_at',tm.created_at,'revoked_at',tm.revoked_at
      ) order by case tm.status when 'active' then 0 else 1 end,tm.role,lower(u.email))
      from public.buyer_rfq_team_members tm join auth.users u on u.id=tm.user_id
      where tm.rfq_id=p_rfq_id
    ),'[]'::jsonb),
    'available_members',case when v_can_manage_team then coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',m.user_id,'email',lower(u.email),'organization_role',m.role,'business_role',m.business_role
      ) order by lower(u.email))
      from public.organization_memberships m join auth.users u on u.id=m.user_id
      where m.organization_id=v_campaign.organization_id and m.status='active'
        and m.user_id<>v_campaign.owner_user_id
    ),'[]'::jsonb) else '[]'::jsonb end,
    'approvals',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'action_type',a.action_type,'po_draft_id',a.po_draft_id,
        'status',case when a.status in('pending','approved') and a.expires_at<=now() then 'expired' else a.status end,
        'reason',a.reason,'requested_by',a.requested_by,'requested_at',a.requested_at,
        'expires_at',a.expires_at,'decided_by',a.decided_by,'decided_at',a.decided_at,
        'decision_note',a.decision_note,'consumed_at',a.consumed_at
      ) order by a.requested_at desc)
      from (select * from public.buyer_procurement_approvals where rfq_id=p_rfq_id order by requested_at desc limit 50) a
    ),'[]'::jsonb),
    'health',jsonb_build_object(
      'stale_dispatches',(select count(*) from public.buyer_rfq_dispatches d where d.rfq_id=p_rfq_id and d.status in('queued','sending') and d.provider_message_id is null and coalesce(d.last_attempt_at,d.queued_at,d.created_at)<=now()-interval '15 minutes'),
      'failed_dispatches',(select count(*) from public.buyer_rfq_dispatches d where d.rfq_id=p_rfq_id and d.status='failed'),
      'bounced_or_complained',(select count(*) from public.buyer_rfq_dispatches d where d.rfq_id=p_rfq_id and d.status in('bounced','complained')),
      'suppressed_recipients',(select count(*) from public.buyer_rfq_suppliers s join public.buyer_rfq_email_suppressions x on x.email_normalized=s.supplier_email_normalized where s.rfq_id=p_rfq_id),
      'po_delivery_failures',(select count(*) from public.buyer_purchase_order_versions v where v.rfq_id=p_rfq_id and v.delivery_status='failed'),
      'pending_approvals',(select count(*) from public.buyer_procurement_approvals a where a.rfq_id=p_rfq_id and a.status='pending' and a.expires_at>now()),
      'expired_approvals',(select count(*) from public.buyer_procurement_approvals a where a.rfq_id=p_rfq_id and (a.status='expired' or (a.status in('pending','approved') and a.expires_at<=now())))
    ),
    'stale_dispatches',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',d.id,'supplier_id',d.supplier_id,'status',d.status,
        'queued_at',d.queued_at,'last_attempt_at',d.last_attempt_at,'last_error',d.last_error
      ) order by coalesce(d.last_attempt_at,d.queued_at,d.created_at))
      from public.buyer_rfq_dispatches d
      where d.rfq_id=p_rfq_id and d.status in('queued','sending') and d.provider_message_id is null
        and coalesce(d.last_attempt_at,d.queued_at,d.created_at)<=now()-interval '15 minutes'
    ),'[]'::jsonb),
    'acceptance',jsonb_build_object(
      'supplier_count',(select count(*) from public.buyer_rfq_suppliers s where s.rfq_id=p_rfq_id),
      'submitted_quote_count',(select count(*) from public.buyer_rfq_quotes q where q.rfq_id=p_rfq_id and q.status='submitted'),
      'award_confirmed',exists(select 1 from public.buyer_rfq_awards a where a.rfq_id=p_rfq_id),
      'po_count',(select count(*) from public.buyer_purchase_order_drafts p where p.rfq_id=p_rfq_id),
      'po_confirmed_count',(select count(*) from public.buyer_purchase_order_drafts p where p.rfq_id=p_rfq_id and p.status='supplier_confirmed'),
      'e2e_complete',(
        v_campaign.status='awarded'
        and exists(select 1 from public.buyer_rfq_awards a where a.rfq_id=p_rfq_id)
        and exists(select 1 from public.buyer_purchase_order_drafts p where p.rfq_id=p_rfq_id)
        and not exists(select 1 from public.buyer_purchase_order_drafts p where p.rfq_id=p_rfq_id and p.status<>'supplier_confirmed')
      )
    )
  ) into v_result;
  return v_result;
end;
$$;

create or replace function private.rfqh13_export_audit_impl(p_rfq_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not private.rfqh13_can_view_rfq(p_rfq_id,v_actor) then raise exception 'RFQ not accessible' using errcode='42501'; end if;
  select * into v_campaign from public.buyer_rfq_campaigns r where r.id=p_rfq_id;
  select jsonb_build_object(
    'contract','RFQH13-audit-export-v1','exported_at',now(),
    'rfq',jsonb_build_object(
      'id',v_campaign.id,'title',v_campaign.title,'status',v_campaign.status,
      'organization_id',v_campaign.organization_id,'owner_user_id',v_campaign.owner_user_id,
      'due_at',v_campaign.due_at,'launched_at',v_campaign.launched_at,
      'awarded_at',v_campaign.awarded_at,'closed_at',v_campaign.closed_at,'created_at',v_campaign.created_at
    ),
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'sequence',e.event_sequence,'event_type',e.event_type,'actor_user_id',e.actor_user_id,
        'supplier_id',e.supplier_id,'created_at',e.created_at,
        'metadata',e.metadata - 'token_hash' - 'idempotency_key' - 'provider_message_id'
          - 'payload' - 'secret' - 'supplier_email' - 'email'
      ) order by e.event_sequence)
      from public.buyer_rfq_events e where e.rfq_id=p_rfq_id
    ),'[]'::jsonb),
    'approvals',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'action_type',a.action_type,'po_draft_id',a.po_draft_id,
        'status',a.status,'reason',a.reason,'requested_by',a.requested_by,
        'requested_at',a.requested_at,'expires_at',a.expires_at,
        'decided_by',a.decided_by,'decided_at',a.decided_at,
        'decision_note',a.decision_note,'consumed_at',a.consumed_at,'payload_sha256',a.payload_sha256
      ) order by a.requested_at)
      from public.buyer_procurement_approvals a where a.rfq_id=p_rfq_id
    ),'[]'::jsonb),
    'award',(select jsonb_build_object(
        'id',a.id,'award_mode',a.award_mode,'reason',a.reason,
        'supplier_count',a.supplier_count,'line_count',a.line_count,
        'total_tonnes',a.total_tonnes,'total_eur',a.total_eur,
        'target_total_eur',a.target_total_eur,'savings_eur',a.savings_eur,
        'savings_pct',a.savings_pct,'confirmed_at',a.confirmed_at
      ) from public.buyer_rfq_awards a where a.rfq_id=p_rfq_id),
    'purchase_orders',coalesce((
      select jsonb_agg(jsonb_build_object(
        'po_draft_id',p.id,'po_draft_ref',p.po_draft_ref,'status',p.status,
        'supplier_id',p.supplier_id,'total_tonnes',p.total_tonnes,'total_eur',p.total_eur,
        'issued_at',p.issued_at,
        'versions',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',v.id,'version_no',v.version_no,'po_number',v.po_number,
            'status',v.status,'delivery_status',v.delivery_status,
            'snapshot_sha256',v.snapshot_sha256,'issued_at',v.issued_at,
            'supplier_responded_at',v.supplier_responded_at
          ) order by v.version_no)
          from public.buyer_purchase_order_versions v where v.po_draft_id=p.id
        ),'[]'::jsonb)
      ) order by p.po_draft_ref)
      from public.buyer_purchase_order_drafts p where p.rfq_id=p_rfq_id
    ),'[]'::jsonb),
    'retention',coalesce((
      select jsonb_build_object(
        'operational_event_retention_days',g.operational_event_retention_days,
        'webhook_payload_retention_days',g.webhook_payload_retention_days,
        'commercial_record_retention_days',g.commercial_record_retention_days,
        'enforcement','policy_only','automatic_commercial_purge',false
      )
      from public.buyer_procurement_governance g where g.organization_id=v_campaign.organization_id
    ),jsonb_build_object(
      'operational_event_retention_days',730,'webhook_payload_retention_days',90,
      'commercial_record_retention_days',null,'enforcement','policy_only','automatic_commercial_purge',false
    ))
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.rfqh13_set_governance(
  p_organization_id uuid,p_require_award_approval boolean default false,
  p_require_po_approval boolean default false,p_approval_expiry_hours integer default 168,
  p_operational_event_retention_days integer default 730,
  p_webhook_payload_retention_days integer default 90,
  p_commercial_record_retention_days integer default null
)
returns jsonb language sql set search_path='' as $$
  select private.rfqh13_set_governance_impl(
    p_organization_id,p_require_award_approval,p_require_po_approval,
    p_approval_expiry_hours,p_operational_event_retention_days,
    p_webhook_payload_retention_days,p_commercial_record_retention_days
  );
$$;

create or replace function public.rfqh13_set_team_member(
  p_rfq_id uuid,p_user_id uuid,p_role text,p_status text default 'active'
)
returns jsonb language sql set search_path='' as $$
  select private.rfqh13_set_team_member_impl(p_rfq_id,p_user_id,p_role,p_status);
$$;

create or replace function public.rfqh13_request_approval(
  p_rfq_id uuid,p_action_type text,p_po_draft_id uuid default null,
  p_reason text default null,p_context jsonb default '{}'::jsonb
)
returns jsonb language sql set search_path='' as $$
  select private.rfqh13_request_approval_impl(
    p_rfq_id,p_action_type,p_po_draft_id,p_reason,coalesce(p_context,'{}'::jsonb)
  );
$$;

create or replace function public.rfqh13_decide_approval(
  p_approval_id uuid,p_decision text,p_note text default null
)
returns jsonb language sql set search_path='' as $$
  select private.rfqh13_decide_approval_impl(p_approval_id,p_decision,p_note);
$$;

create or replace function public.rfqh13_mark_stale_dispatch_failed(
  p_dispatch_id uuid,p_reason text default 'Manual RFQH13 recovery'
)
returns jsonb language sql set search_path='' as $$
  select private.rfqh13_mark_stale_dispatch_failed_impl(p_dispatch_id,p_reason);
$$;

create or replace function public.rfqh13_governance_state(p_rfq_id uuid)
returns jsonb language sql stable set search_path='' as $$
  select private.rfqh13_governance_state_impl(p_rfq_id);
$$;

create or replace function public.rfqh13_export_audit(p_rfq_id uuid)
returns jsonb language sql stable set search_path='' as $$
  select private.rfqh13_export_audit_impl(p_rfq_id);
$$;

revoke all on function public.rfqh13_set_governance(uuid,boolean,boolean,integer,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.rfqh13_set_team_member(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.rfqh13_request_approval(uuid,text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.rfqh13_decide_approval(uuid,text,text) from public,anon,authenticated;
revoke all on function public.rfqh13_mark_stale_dispatch_failed(uuid,text) from public,anon,authenticated;
revoke all on function public.rfqh13_governance_state(uuid) from public,anon,authenticated;
revoke all on function public.rfqh13_export_audit(uuid) from public,anon,authenticated;

grant execute on function public.rfqh13_set_governance(uuid,boolean,boolean,integer,integer,integer,integer) to authenticated;
grant execute on function public.rfqh13_set_team_member(uuid,uuid,text,text) to authenticated;
grant execute on function public.rfqh13_request_approval(uuid,text,uuid,text,jsonb) to authenticated;
grant execute on function public.rfqh13_decide_approval(uuid,text,text) to authenticated;
grant execute on function public.rfqh13_mark_stale_dispatch_failed(uuid,text) to authenticated;
grant execute on function public.rfqh13_governance_state(uuid) to authenticated;
grant execute on function public.rfqh13_export_audit(uuid) to authenticated;

notify pgrst,'reload schema';
