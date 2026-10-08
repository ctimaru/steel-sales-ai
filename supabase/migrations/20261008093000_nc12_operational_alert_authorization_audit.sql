-- NC1.2: authenticated tenant viewers/members read; only tenant admins mutate.
-- Status transitions trigger an append-only audit log. No Platform/tenant privilege crossover.
create table if not exists public.operational_alert_action_audit (
  id bigint generated always as identity primary key,
  alert_id bigint not null references public.operational_alerts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid,
  action text not null check (action in ('acknowledged','resolved','reopened','status_changed')),
  previous_status text not null check (previous_status in ('open','acknowledged','resolved')),
  new_status text not null check (new_status in ('open','acknowledged','resolved')),
  note text,
  occurred_at timestamptz not null default now(),
  constraint nc12_status_changed check (previous_status <> new_status)
);
create index if not exists nc12_audit_org_recent_idx
  on public.operational_alert_action_audit(organization_id,occurred_at desc,id desc);
create index if not exists nc12_audit_alert_recent_idx
  on public.operational_alert_action_audit(alert_id,occurred_at desc,id desc);
alter table public.operational_alert_action_audit enable row level security;
revoke all on public.operational_alert_action_audit from public, anon, authenticated, service_role;

create or replace function public.nc12_prevent_alert_audit_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
begin
  raise exception using errcode='42501', message='operational alert audit is append-only';
end;
$fn$;
revoke all on function public.nc12_prevent_alert_audit_mutation() from public,anon,authenticated;
drop trigger if exists nc12_prevent_alert_audit_mutation on public.operational_alert_action_audit;
create trigger nc12_prevent_alert_audit_mutation before update or delete
  on public.operational_alert_action_audit for each row
  execute function public.nc12_prevent_alert_audit_mutation();

create or replace function public.nc12_record_alert_status_transition()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if new.status is distinct from old.status then
    insert into public.operational_alert_action_audit
      (alert_id,organization_id,actor_user_id,action,previous_status,new_status,note)
    values
      (new.id,new.organization_id,auth.uid(),
        case new.status when 'acknowledged' then 'acknowledged'
                        when 'resolved' then 'resolved'
                        when 'open' then 'reopened' else 'status_changed' end,
       old.status,new.status,
       case when new.status in ('acknowledged','resolved')
            then new.resolution_note else null end);
  end if;
  return new;
end;
$fn$;
revoke all on function public.nc12_record_alert_status_transition() from public,anon,authenticated;
drop trigger if exists nc12_record_alert_status_transition on public.operational_alerts;
create trigger nc12_record_alert_status_transition after update of status
  on public.operational_alerts for each row
  when (old.status is distinct from new.status)
  execute function public.nc12_record_alert_status_transition();

-- Existing tenant-scoped readers now support viewer read-only access.
CREATE OR REPLACE FUNCTION public.p1_operational_alerts_read(p_organization_id uuid, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, alert_type text, severity text, status text, title text, summary text, occurrence_count integer, first_seen_at timestamp with time zone, last_seen_at timestamp with time zone, acknowledged_at timestamp with time zone, resolved_at timestamp with time zone, is_active boolean, needs_attention boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit,50),1),200);
  v_offset integer := greatest(coalesce(p_offset,0),0);
begin
  if v_actor is null then
    raise exception using errcode='28000', message='authentication required';
  end if;

  if p_organization_id is null then
    raise exception using errcode='22023', message='organization id required';
  end if;

  if not public.is_organization_member(p_organization_id,false) then
    raise exception using errcode='42501', message='active tenant membership required';
  end if;

  if p_status is not null and p_status not in ('open','acknowledged','resolved') then
    raise exception using errcode='22023', message='invalid alert status';
  end if;

  return query
  select
    a.id,
    a.alert_type,
    a.severity,
    a.status,
    a.title,
    a.summary,
    a.occurrence_count,
    a.first_seen_at,
    a.last_seen_at,
    a.acknowledged_at,
    a.resolved_at,
    (a.status in ('open','acknowledged')) as is_active,
    (a.status='open' and a.severity='critical') as needs_attention
  from public.operational_alerts a
  where a.organization_id=p_organization_id
    and (p_status is null or a.status=p_status)
  order by
    case a.status when 'open' then 0 when 'acknowledged' then 1 else 2 end,
    case a.severity when 'critical' then 0 else 1 end,
    a.last_seen_at desc,
    a.id desc
  limit v_limit
  offset v_offset;
end;
$function$


CREATE OR REPLACE FUNCTION public.p1_operational_alerts_summary(p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='28000', message='authentication required';
  end if;

  if p_organization_id is null then
    raise exception using errcode='22023', message='organization id required';
  end if;

  if not public.is_organization_member(p_organization_id,false) then
    raise exception using errcode='42501', message='active tenant membership required';
  end if;

  select jsonb_build_object(
    'contract','PA2.30.26-v1',
    'organization_id',p_organization_id,
    'open_count',count(*) filter (where status='open'),
    'acknowledged_count',count(*) filter (where status='acknowledged'),
    'resolved_count',count(*) filter (where status='resolved'),
    'critical_open_count',count(*) filter (where status='open' and severity='critical'),
    'active_count',count(*) filter (where status in ('open','acknowledged')),
    'needs_attention',(count(*) filter (where status='open' and severity='critical') > 0),
    'last_alert_at',max(last_seen_at),
    'generated_at',now()
  )
  into v_result
  from public.operational_alerts
  where organization_id=p_organization_id;

  return v_result;
end;
$function$


-- Do not leak existence of cross-tenant alert IDs: same denial for absent/inaccessible rows.
create or replace function public.p1_acknowledge_operational_alert(
  p_alert_id bigint, p_note text default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid := auth.uid(); v_alert public.operational_alerts%rowtype;
begin
  if v_actor is null then raise exception using errcode='28000',message='authentication required'; end if;
  if p_alert_id is null or p_alert_id < 1 then
    raise exception using errcode='22023',message='valid alert id required';
  end if;
  if length(coalesce(p_note,'')) > 2000 then
    raise exception using errcode='22023',message='note too long';
  end if;
  select a.* into v_alert
  from public.operational_alerts a
  where a.id=p_alert_id and exists (
    select 1 from public.organization_memberships m
    where m.organization_id=a.organization_id
      and m.user_id=v_actor and m.status='active' and m.role='admin'
  ) for update of a;
  if v_alert.id is null then
    raise exception using errcode='42501',message='alert unavailable or insufficient privileges';
  end if;
  if v_alert.status='resolved' then
    raise exception using errcode='55000',message='resolved alert cannot be acknowledged';
  end if;
  if v_alert.status='acknowledged' then
    return jsonb_build_object('alert_id',p_alert_id,'status','acknowledged');
  end if;
  update public.operational_alerts set
    status='acknowledged',
    acknowledged_at=now(), acknowledged_by=v_actor,
    resolution_note=coalesce(nullif(btrim(p_note),''),resolution_note),
    updated_at=now()
  where id=p_alert_id and status='open';
  return jsonb_build_object('alert_id',p_alert_id,'status','acknowledged');
end;
$fn$;

create or replace function public.p1_resolve_operational_alert(
  p_alert_id bigint,p_note text
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid := auth.uid(); v_alert public.operational_alerts%rowtype;
begin
  if v_actor is null then raise exception using errcode='28000',message='authentication required'; end if;
  if p_alert_id is null or p_alert_id < 1 then
    raise exception using errcode='22023',message='valid alert id required';
  end if;
  if nullif(btrim(p_note),'') is null then
    raise exception using errcode='22023',message='resolution note required';
  end if;
  if length(p_note) > 2000 then
    raise exception using errcode='22023',message='note too long';
  end if;
  select a.* into v_alert
  from public.operational_alerts a
  where a.id=p_alert_id and exists (
    select 1 from public.organization_memberships m
    where m.organization_id=a.organization_id
      and m.user_id=v_actor and m.status='active' and m.role='admin'
  ) for update of a;
  if v_alert.id is null then
    raise exception using errcode='42501',message='alert unavailable or insufficient privileges';
  end if;
  if v_alert.status='resolved' then
    return jsonb_build_object('alert_id',p_alert_id,'status','resolved');
  end if;
  update public.operational_alerts set
    status='resolved', resolved_at=now(), resolved_by=v_actor,
    resolution_note=btrim(p_note), updated_at=now()
  where id=p_alert_id and status in ('open','acknowledged');
  return jsonb_build_object('alert_id',p_alert_id,'status','resolved');
end;
$fn$;

create or replace function public.p1_operational_alert_audit_read(
  p_organization_id uuid,p_alert_id bigint default null,
  p_limit integer default 100,p_offset integer default 0
) returns table(
  id bigint,alert_id bigint,action text,previous_status text,new_status text,
  actor_user_id uuid,note text,occurred_at timestamptz
) language plpgsql stable security definer set search_path=''
as $fn$
begin
  if auth.uid() is null then raise exception using errcode='28000',message='authentication required'; end if;
  if p_organization_id is null or not exists (
    select 1 from public.organization_memberships m
    where m.organization_id=p_organization_id and m.user_id=auth.uid()
      and m.status='active' and m.role='admin'
  ) then
    raise exception using errcode='42501',message='active organization admin required';
  end if;
  return query
    select e.id,e.alert_id,e.action,e.previous_status,e.new_status,
           e.actor_user_id,e.note,e.occurred_at
    from public.operational_alert_action_audit e
    where e.organization_id=p_organization_id
      and (p_alert_id is null or e.alert_id=p_alert_id)
    order by e.occurred_at desc,e.id desc
    limit least(greatest(coalesce(p_limit,100),1),200)
    offset greatest(coalesce(p_offset,0),0);
end;
$fn$;
revoke all on function public.p1_operational_alert_audit_read(uuid,bigint,integer,integer)
  from public,anon;
revoke all on function public.p1_acknowledge_operational_alert(bigint,text) from public,anon;
revoke all on function public.p1_resolve_operational_alert(bigint,text) from public,anon;
revoke all on function public.p1_operational_alerts_read(uuid,text,integer,integer) from public,anon;
revoke all on function public.p1_operational_alerts_summary(uuid) from public,anon;
grant execute on function public.p1_operational_alert_audit_read(uuid,bigint,integer,integer)
  to authenticated,service_role;
grant execute on function public.p1_acknowledge_operational_alert(bigint,text)
  to authenticated,service_role;
grant execute on function public.p1_resolve_operational_alert(bigint,text)
  to authenticated,service_role;
grant execute on function public.p1_operational_alerts_read(uuid,text,integer,integer)
  to authenticated,service_role;
grant execute on function public.p1_operational_alerts_summary(uuid)
  to authenticated,service_role;
