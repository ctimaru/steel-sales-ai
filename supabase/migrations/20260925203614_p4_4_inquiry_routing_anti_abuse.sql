create table public.network_inquiry_preferences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  inquiries_enabled boolean not null default true,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.network_inquiry_preferences enable row level security;
revoke all on table public.network_inquiry_preferences from public,anon,authenticated;
grant select,insert,update,delete on table public.network_inquiry_preferences to service_role;

create table public.network_inquiry_blocks (
  id uuid primary key default gen_random_uuid(),
  blocking_organization_id uuid not null references public.organizations(id) on delete restrict,
  blocked_organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'active',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_by uuid null references auth.users(id) on delete restrict,
  revoked_at timestamptz null,
  constraint network_inquiry_blocks_not_self_check
    check (blocking_organization_id<>blocked_organization_id),
  constraint network_inquiry_blocks_status_check
    check (status in ('active','revoked')),
  constraint network_inquiry_blocks_revoke_integrity_check
    check (
      (status='active' and revoked_by is null and revoked_at is null)
      or
      (status='revoked' and revoked_by is not null and revoked_at is not null)
    )
);

create unique index network_inquiry_blocks_active_pair_uidx
  on public.network_inquiry_blocks(blocking_organization_id,blocked_organization_id)
  where status='active';

create index network_inquiry_blocks_blocked_org_idx
  on public.network_inquiry_blocks(blocked_organization_id,status);

alter table public.network_inquiry_blocks enable row level security;
revoke all on table public.network_inquiry_blocks from public,anon,authenticated;
grant select,insert,update,delete on table public.network_inquiry_blocks to service_role;

create table public.network_inquiry_reports (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.network_inquiries(id) on delete restrict,
  reporter_organization_id uuid not null references public.organizations(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  details text null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  resolution_note text null,
  constraint network_inquiry_reports_reason_check
    check (reason in ('spam','inappropriate','fraud_suspicious','other')),
  constraint network_inquiry_reports_details_check
    check (details is null or char_length(details)<=2000),
  constraint network_inquiry_reports_status_check
    check (status in ('open','resolved','dismissed')),
  constraint network_inquiry_reports_review_integrity_check
    check (
      (status='open' and reviewed_by is null and reviewed_at is null)
      or
      (status in ('resolved','dismissed') and reviewed_by is not null and reviewed_at is not null)
    ),
  constraint network_inquiry_reports_one_per_org
    unique(inquiry_id,reporter_organization_id)
);

create index network_inquiry_reports_status_idx
  on public.network_inquiry_reports(status,created_at);

alter table public.network_inquiry_reports enable row level security;
revoke all on table public.network_inquiry_reports from public,anon,authenticated;
grant select,insert,update,delete on table public.network_inquiry_reports to service_role;

create table public.network_interaction_control_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_organization_id uuid null references public.organizations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint network_interaction_control_events_entity_type_check
    check (entity_type in ('inquiry_preferences','organization_block','inquiry_report')),
  constraint network_interaction_control_events_event_type_check
    check (event_type in (
      'inquiry_preferences_changed',
      'organization_blocked',
      'organization_unblocked',
      'inquiry_reported',
      'inquiry_report_resolved',
      'inquiry_report_dismissed'
    )),
  constraint network_interaction_control_events_metadata_check
    check (jsonb_typeof(metadata)='object' and pg_column_size(metadata)<=8192)
);

create index network_interaction_control_events_entity_idx
  on public.network_interaction_control_events(entity_type,entity_id,created_at);

alter table public.network_interaction_control_events enable row level security;
revoke all on table public.network_interaction_control_events from public,anon,authenticated;
grant select,insert,update,delete on table public.network_interaction_control_events to service_role;

create or replace function private.p4_interaction_event_immutable()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'network_interaction_control_events is append-only'
    using errcode='55000';
end;
$function$;

revoke all on function private.p4_interaction_event_immutable() from public,anon,authenticated;

create trigger network_interaction_control_events_immutable
before update or delete on public.network_interaction_control_events
for each row execute function private.p4_interaction_event_immutable();

create or replace function private.p4_touch_inquiry_preferences()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  new.updated_at:=now();
  return new;
end;
$function$;

revoke all on function private.p4_touch_inquiry_preferences() from public,anon,authenticated;

create trigger network_inquiry_preferences_touch_updated_at
before update on public.network_inquiry_preferences
for each row execute function private.p4_touch_inquiry_preferences();

create or replace function private.p4_org_admin_controls_claimed_company(
  p_organization_id uuid,
  p_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1
    from public.organization_memberships om
    join public.organization_network_company_links l
      on l.organization_id=om.organization_id
     and l.link_status='active'
    join public.network_company_claims c
      on c.organization_id=l.organization_id
     and c.network_company_id=l.network_company_id
     and c.status='approved'
    where om.organization_id=p_organization_id
      and om.user_id=coalesce(p_user_id,(select auth.uid()))
      and om.status='active'
      and om.role='admin'
  );
$function$;

revoke all on function private.p4_org_admin_controls_claimed_company(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.p4_org_admin_controls_claimed_company(uuid,uuid)
to service_role;

create or replace function private.p4_set_inquiry_preferences_impl(
  p_organization_id uuid,
  p_inquiries_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
begin
  v_user:=(select auth.uid());
  if v_user is null or not private.p4_org_admin_controls_claimed_company(p_organization_id,v_user) then
    raise exception 'claimed company organization admin required'
      using errcode='42501';
  end if;

  insert into public.network_inquiry_preferences(
    organization_id,inquiries_enabled,updated_by
  )
  values(p_organization_id,p_inquiries_enabled,v_user)
  on conflict(organization_id)
  do update set
    inquiries_enabled=excluded.inquiries_enabled,
    updated_by=excluded.updated_by;

  insert into public.network_interaction_control_events(
    entity_type,entity_id,event_type,actor_user_id,actor_organization_id,metadata
  )
  values(
    'inquiry_preferences',
    p_organization_id,
    'inquiry_preferences_changed',
    v_user,
    p_organization_id,
    jsonb_build_object('inquiries_enabled',p_inquiries_enabled)
  );

  return jsonb_build_object(
    'organization_id',p_organization_id,
    'inquiries_enabled',p_inquiries_enabled
  );
end;
$function$;

revoke all on function private.p4_set_inquiry_preferences_impl(uuid,boolean)
from public,anon;
grant execute on function private.p4_set_inquiry_preferences_impl(uuid,boolean)
to authenticated,service_role;

create or replace function public.p4_set_inquiry_preferences(
  p_organization_id uuid,
  p_inquiries_enabled boolean
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_set_inquiry_preferences_impl(
    p_organization_id,p_inquiries_enabled
  );
$function$;

revoke all on function public.p4_set_inquiry_preferences(uuid,boolean)
from public,anon;
grant execute on function public.p4_set_inquiry_preferences(uuid,boolean)
to authenticated,service_role;

create or replace function private.p4_block_organization_impl(
  p_blocking_organization_id uuid,
  p_blocked_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_block_id uuid;
begin
  v_user:=(select auth.uid());
  if v_user is null or not private.p4_org_admin_controls_claimed_company(p_blocking_organization_id,v_user) then
    raise exception 'claimed company organization admin required'
      using errcode='42501';
  end if;

  if p_blocking_organization_id=p_blocked_organization_id then
    raise exception 'organization cannot block itself' using errcode='22023';
  end if;

  if not exists(select 1 from public.organizations where id=p_blocked_organization_id) then
    raise exception 'blocked organization not found' using errcode='P0002';
  end if;

  select id into v_block_id
  from public.network_inquiry_blocks
  where blocking_organization_id=p_blocking_organization_id
    and blocked_organization_id=p_blocked_organization_id
    and status='active';

  if v_block_id is null then
    insert into public.network_inquiry_blocks(
      blocking_organization_id,blocked_organization_id,status,created_by
    )
    values(
      p_blocking_organization_id,p_blocked_organization_id,'active',v_user
    )
    returning id into v_block_id;

    insert into public.network_interaction_control_events(
      entity_type,entity_id,event_type,actor_user_id,actor_organization_id,metadata
    )
    values(
      'organization_block',v_block_id,'organization_blocked',
      v_user,p_blocking_organization_id,
      jsonb_build_object('blocked_organization_id',p_blocked_organization_id)
    );
  end if;

  return jsonb_build_object(
    'block_id',v_block_id,
    'blocking_organization_id',p_blocking_organization_id,
    'blocked_organization_id',p_blocked_organization_id,
    'status','active'
  );
end;
$function$;

revoke all on function private.p4_block_organization_impl(uuid,uuid)
from public,anon;
grant execute on function private.p4_block_organization_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p4_block_organization(
  p_blocking_organization_id uuid,
  p_blocked_organization_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_block_organization_impl(
    p_blocking_organization_id,p_blocked_organization_id
  );
$function$;

revoke all on function public.p4_block_organization(uuid,uuid)
from public,anon;
grant execute on function public.p4_block_organization(uuid,uuid)
to authenticated,service_role;

create or replace function private.p4_unblock_organization_impl(
  p_blocking_organization_id uuid,
  p_blocked_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_block_id uuid;
begin
  v_user:=(select auth.uid());
  if v_user is null or not private.p4_org_admin_controls_claimed_company(p_blocking_organization_id,v_user) then
    raise exception 'claimed company organization admin required'
      using errcode='42501';
  end if;

  select id into v_block_id
  from public.network_inquiry_blocks
  where blocking_organization_id=p_blocking_organization_id
    and blocked_organization_id=p_blocked_organization_id
    and status='active'
  for update;

  if v_block_id is null then
    return jsonb_build_object(
      'blocking_organization_id',p_blocking_organization_id,
      'blocked_organization_id',p_blocked_organization_id,
      'status','not_blocked'
    );
  end if;

  update public.network_inquiry_blocks
  set status='revoked',revoked_by=v_user,revoked_at=now()
  where id=v_block_id;

  insert into public.network_interaction_control_events(
    entity_type,entity_id,event_type,actor_user_id,actor_organization_id,metadata
  )
  values(
    'organization_block',v_block_id,'organization_unblocked',
    v_user,p_blocking_organization_id,
    jsonb_build_object('blocked_organization_id',p_blocked_organization_id)
  );

  return jsonb_build_object(
    'block_id',v_block_id,
    'blocking_organization_id',p_blocking_organization_id,
    'blocked_organization_id',p_blocked_organization_id,
    'status','revoked'
  );
end;
$function$;

revoke all on function private.p4_unblock_organization_impl(uuid,uuid)
from public,anon;
grant execute on function private.p4_unblock_organization_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p4_unblock_organization(
  p_blocking_organization_id uuid,
  p_blocked_organization_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_unblock_organization_impl(
    p_blocking_organization_id,p_blocked_organization_id
  );
$function$;

revoke all on function public.p4_unblock_organization(uuid,uuid)
from public,anon;
grant execute on function public.p4_unblock_organization(uuid,uuid)
to authenticated,service_role;

create or replace function private.p4_report_inquiry_impl(
  p_inquiry_id uuid,
  p_reporter_organization_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_inquiry public.network_inquiries%rowtype;
  v_report_id uuid;
  v_details text;
begin
  v_user:=(select auth.uid());
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select * into v_inquiry
  from public.network_inquiries
  where id=p_inquiry_id;

  if not found then
    raise exception 'inquiry not found' using errcode='P0002';
  end if;

  if p_reporter_organization_id not in (
    v_inquiry.sender_organization_id,
    v_inquiry.recipient_organization_id
  ) then
    raise exception 'reporter organization is not an inquiry participant'
      using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.organization_memberships om
    where om.organization_id=p_reporter_organization_id
      and om.user_id=v_user
      and om.status='active'
  ) then
    raise exception 'active participant membership required'
      using errcode='42501';
  end if;

  if p_reason not in ('spam','inappropriate','fraud_suspicious','other') then
    raise exception 'invalid report reason' using errcode='22023';
  end if;

  v_details:=nullif(btrim(p_details),'');
  if v_details is not null and char_length(v_details)>2000 then
    raise exception 'report details exceed 2000 characters'
      using errcode='22023';
  end if;

  insert into public.network_inquiry_reports(
    inquiry_id,reporter_organization_id,reporter_user_id,reason,details,status
  )
  values(
    p_inquiry_id,p_reporter_organization_id,v_user,p_reason,v_details,'open'
  )
  returning id into v_report_id;

  insert into public.network_interaction_control_events(
    entity_type,entity_id,event_type,actor_user_id,actor_organization_id,metadata
  )
  values(
    'inquiry_report',v_report_id,'inquiry_reported',
    v_user,p_reporter_organization_id,
    jsonb_build_object('inquiry_id',p_inquiry_id,'reason',p_reason)
  );

  return jsonb_build_object(
    'report_id',v_report_id,
    'inquiry_id',p_inquiry_id,
    'status','open'
  );
end;
$function$;

revoke all on function private.p4_report_inquiry_impl(uuid,uuid,text,text)
from public,anon;
grant execute on function private.p4_report_inquiry_impl(uuid,uuid,text,text)
to authenticated,service_role;

create or replace function public.p4_report_inquiry(
  p_inquiry_id uuid,
  p_reporter_organization_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_report_inquiry_impl(
    p_inquiry_id,p_reporter_organization_id,p_reason,p_details
  );
$function$;

revoke all on function public.p4_report_inquiry(uuid,uuid,text,text)
from public,anon;
grant execute on function public.p4_report_inquiry(uuid,uuid,text,text)
to authenticated,service_role;

create or replace function private.p4_review_inquiry_report_impl(
  p_report_id uuid,
  p_decision text,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_report public.network_inquiry_reports%rowtype;
  v_status text;
  v_note text;
begin
  v_user:=(select auth.uid());
  if v_user is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  if p_decision not in ('resolve','dismiss','block') then
    raise exception 'invalid report decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(p_resolution_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'resolution note exceeds 2000 characters'
      using errcode='22023';
  end if;

  select * into v_report
  from public.network_inquiry_reports
  where id=p_report_id
  for update;

  if not found then
    raise exception 'inquiry report not found' using errcode='P0002';
  end if;

  if v_report.status<>'open' then
    raise exception 'only open inquiry reports can be reviewed'
      using errcode='22023';
  end if;

  if p_decision='dismiss' then
    v_status:='dismissed';
  else
    v_status:='resolved';
  end if;

  update public.network_inquiry_reports
  set
    status=v_status,
    reviewed_by=v_user,
    reviewed_at=now(),
    resolution_note=v_note
  where id=v_report.id;

  if p_decision='block' then
    perform private.p4_transition_inquiry_impl(
      v_report.inquiry_id,
      null,
      'blocked'
    );
  end if;

  insert into public.network_interaction_control_events(
    entity_type,entity_id,event_type,actor_user_id,actor_organization_id,metadata
  )
  values(
    'inquiry_report',
    v_report.id,
    case when v_status='dismissed'
      then 'inquiry_report_dismissed'
      else 'inquiry_report_resolved'
    end,
    v_user,
    null,
    jsonb_build_object(
      'decision',p_decision,
      'inquiry_id',v_report.inquiry_id
    )
  );

  return jsonb_build_object(
    'report_id',v_report.id,
    'inquiry_id',v_report.inquiry_id,
    'status',v_status,
    'decision',p_decision
  );
end;
$function$;

revoke all on function private.p4_review_inquiry_report_impl(uuid,text,text)
from public,anon;
grant execute on function private.p4_review_inquiry_report_impl(uuid,text,text)
to authenticated,service_role;

create or replace function public.p4_review_inquiry_report(
  p_report_id uuid,
  p_decision text,
  p_resolution_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_review_inquiry_report_impl(
    p_report_id,p_decision,p_resolution_note
  );
$function$;

revoke all on function public.p4_review_inquiry_report(uuid,text,text)
from public,anon;
grant execute on function public.p4_review_inquiry_report(uuid,text,text)
to authenticated,service_role;

create or replace function private.p4_submit_inquiry_impl(
  p_sender_organization_id uuid,
  p_recipient_network_company_id uuid,
  p_subject text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_recipient_org uuid;
  v_inquiry uuid;
  v_subject text;
  v_body text;
  v_count int;
  v_enabled boolean;
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
    raise exception 'active organization admin/member membership required'
      using errcode='42501';
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
    raise exception 'recipient company is not eligible for in-platform inquiry'
      using errcode='22023';
  end if;

  if v_recipient_org=p_sender_organization_id then
    raise exception 'self-inquiry is not allowed' using errcode='22023';
  end if;

  select coalesce(p.inquiries_enabled,true)
  into v_enabled
  from (select 1) x
  left join public.network_inquiry_preferences p
    on p.organization_id=v_recipient_org;

  if not coalesce(v_enabled,true) then
    raise exception 'recipient organization is not accepting inquiries'
      using errcode='22023';
  end if;

  if exists(
    select 1
    from public.network_inquiry_blocks b
    where b.blocking_organization_id=v_recipient_org
      and b.blocked_organization_id=p_sender_organization_id
      and b.status='active'
  ) then
    raise exception 'sender organization is blocked by recipient'
      using errcode='42501';
  end if;

  v_subject := btrim(p_subject);
  v_body := btrim(p_body);

  if char_length(v_subject) not between 1 and 200 then
    raise exception 'subject must contain 1-200 characters' using errcode='22023';
  end if;

  if char_length(v_body) not between 1 and 5000 then
    raise exception 'body must contain 1-5000 characters' using errcode='22023';
  end if;

  select count(*) into v_count
  from public.network_inquiries i
  where i.sender_user_id=v_user
    and i.submitted_at >= now()-interval '24 hours';

  if v_count>=10 then
    raise exception 'user inquiry rate limit exceeded'
      using errcode='P0001';
  end if;

  select count(*) into v_count
  from public.network_inquiries i
  where i.sender_organization_id=p_sender_organization_id
    and i.recipient_network_company_id=p_recipient_network_company_id
    and i.submitted_at >= now()-interval '24 hours';

  if v_count>=3 then
    raise exception 'recipient inquiry rate limit exceeded'
      using errcode='P0001';
  end if;

  insert into public.network_inquiries(
    sender_organization_id,
    sender_user_id,
    recipient_network_company_id,
    recipient_organization_id,
    subject,
    body,
    status
  )
  values(
    p_sender_organization_id,
    v_user,
    p_recipient_network_company_id,
    v_recipient_org,
    v_subject,
    v_body,
    'submitted'
  )
  returning id into v_inquiry;

  insert into public.network_inquiry_events(
    inquiry_id,event_type,actor_user_id,actor_organization_id,
    previous_status,new_status
  )
  values(
    v_inquiry,'submitted',v_user,p_sender_organization_id,
    null,'submitted'
  );

  return jsonb_build_object(
    'inquiry_id',v_inquiry,
    'status','submitted',
    'sender_organization_id',p_sender_organization_id,
    'recipient_organization_id',v_recipient_org,
    'recipient_network_company_id',p_recipient_network_company_id
  );
end;
$function$;

comment on table public.network_inquiry_preferences is
  'P4.4 private recipient organization controls for in-platform inquiries.';
comment on table public.network_inquiry_blocks is
  'P4.4 private organization-level inquiry blocks. Blocks are not public reputation signals.';
comment on table public.network_inquiry_reports is
  'P4.4 private participant reports reviewed by Platform Superadmin.';
comment on table public.network_interaction_control_events is
  'P4.4 append-only audit for inquiry preferences, organization blocks and report moderation.';
