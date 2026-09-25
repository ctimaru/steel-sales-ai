create table public.network_inquiries (
  id uuid primary key default gen_random_uuid(),
  sender_organization_id uuid not null references public.organizations(id) on delete restrict,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_network_company_id uuid not null references public.network_companies(id) on delete restrict,
  recipient_organization_id uuid not null references public.organizations(id) on delete restrict,
  subject text not null,
  body text not null,
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint network_inquiries_subject_check
    check (char_length(btrim(subject)) between 1 and 200),
  constraint network_inquiries_body_check
    check (char_length(btrim(body)) between 1 and 5000),
  constraint network_inquiries_status_check
    check (status in ('submitted','read','responded','declined','closed','withdrawn','blocked')),
  constraint network_inquiries_not_self_org_check
    check (sender_organization_id <> recipient_organization_id)
);

create index network_inquiries_sender_org_idx
  on public.network_inquiries (sender_organization_id,status,submitted_at desc);

create index network_inquiries_sender_user_idx
  on public.network_inquiries (sender_user_id,submitted_at desc);

create index network_inquiries_recipient_org_idx
  on public.network_inquiries (recipient_organization_id,status,submitted_at desc);

create index network_inquiries_recipient_company_idx
  on public.network_inquiries (recipient_network_company_id,submitted_at desc);

alter table public.network_inquiries enable row level security;
revoke all on table public.network_inquiries from public,anon,authenticated;
grant select,insert,update,delete on table public.network_inquiries to service_role;

create table public.network_inquiry_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.network_inquiries(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_organization_id uuid null references public.organizations(id) on delete set null,
  previous_status text null,
  new_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint network_inquiry_events_event_type_check
    check (event_type in ('submitted','read','responded','declined','closed','withdrawn','blocked')),
  constraint network_inquiry_events_previous_status_check
    check (previous_status is null or previous_status in ('submitted','read','responded','declined','closed','withdrawn','blocked')),
  constraint network_inquiry_events_new_status_check
    check (new_status in ('submitted','read','responded','declined','closed','withdrawn','blocked')),
  constraint network_inquiry_events_metadata_check
    check (jsonb_typeof(metadata)='object' and pg_column_size(metadata)<=8192)
);

create index network_inquiry_events_inquiry_idx
  on public.network_inquiry_events (inquiry_id,created_at);

alter table public.network_inquiry_events enable row level security;
revoke all on table public.network_inquiry_events from public,anon,authenticated;
grant select,insert,update,delete on table public.network_inquiry_events to service_role;

create or replace function private.p4_inquiry_event_immutable()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'network_inquiry_events is append-only' using errcode='55000';
end;
$function$;

revoke all on function private.p4_inquiry_event_immutable() from public,anon,authenticated;

create trigger network_inquiry_events_immutable
before update or delete on public.network_inquiry_events
for each row execute function private.p4_inquiry_event_immutable();

create or replace function private.p4_touch_inquiry_updated_at()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.p4_touch_inquiry_updated_at() from public,anon,authenticated;

create trigger network_inquiries_touch_updated_at
before update on public.network_inquiries
for each row execute function private.p4_touch_inquiry_updated_at();

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

revoke all on function private.p4_submit_inquiry_impl(uuid,uuid,text,text) from public,anon;
grant execute on function private.p4_submit_inquiry_impl(uuid,uuid,text,text) to authenticated,service_role;

create or replace function public.p4_submit_inquiry(
  p_sender_organization_id uuid,
  p_recipient_network_company_id uuid,
  p_subject text,
  p_body text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_submit_inquiry_impl(
    p_sender_organization_id,
    p_recipient_network_company_id,
    p_subject,
    p_body
  );
$function$;

revoke all on function public.p4_submit_inquiry(uuid,uuid,text,text) from public,anon;
grant execute on function public.p4_submit_inquiry(uuid,uuid,text,text) to authenticated,service_role;

create or replace function private.p4_transition_inquiry_impl(
  p_inquiry_id uuid,
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
  v_actor_org uuid;
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
    v_actor_org := null;
    v_allowed := v_row.status not in ('closed','withdrawn','blocked');
  else
    select om.organization_id
    into v_actor_org
    from public.organization_memberships om
    where om.user_id=v_user
      and om.status='active'
      and om.role in ('admin','member')
      and om.organization_id in (v_row.sender_organization_id,v_row.recipient_organization_id)
    order by (om.organization_id=v_row.recipient_organization_id) desc
    limit 1;

    if v_actor_org is null then
      raise exception 'participating active organization membership required'
        using errcode='42501';
    end if;

    if p_new_status='read' then
      v_allowed :=
        v_actor_org=v_row.recipient_organization_id
        and v_row.status='submitted';
    elsif p_new_status='responded' then
      v_allowed :=
        v_actor_org=v_row.recipient_organization_id
        and v_row.status in ('submitted','read');
    elsif p_new_status='declined' then
      v_allowed :=
        v_actor_org=v_row.recipient_organization_id
        and v_row.status in ('submitted','read');
    elsif p_new_status='withdrawn' then
      v_allowed :=
        v_actor_org=v_row.sender_organization_id
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
    v_row.id,p_new_status,v_user,v_actor_org,
    v_row.status,p_new_status
  );

  return jsonb_build_object(
    'inquiry_id',v_row.id,
    'previous_status',v_row.status,
    'status',p_new_status
  );
end;
$function$;

revoke all on function private.p4_transition_inquiry_impl(uuid,text) from public,anon;
grant execute on function private.p4_transition_inquiry_impl(uuid,text) to authenticated,service_role;

create or replace function public.p4_transition_inquiry(
  p_inquiry_id uuid,
  p_new_status text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p4_transition_inquiry_impl(p_inquiry_id,p_new_status);
$function$;

revoke all on function public.p4_transition_inquiry(uuid,text) from public,anon;
grant execute on function public.p4_transition_inquiry(uuid,text) to authenticated,service_role;

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
      nc.legal_name as recipient_company_name
    from public.network_inquiries i
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

revoke all on function private.p4_list_inquiries_impl(uuid,text,integer,integer) from public,anon;
grant execute on function private.p4_list_inquiries_impl(uuid,text,integer,integer) to authenticated,service_role;

create or replace function public.p4_list_inquiries(
  p_organization_id uuid,
  p_box text default 'received',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p4_list_inquiries_impl(
    p_organization_id,p_box,p_limit,p_offset
  );
$function$;

revoke all on function public.p4_list_inquiries(uuid,text,integer,integer) from public,anon;
grant execute on function public.p4_list_inquiries(uuid,text,integer,integer) to authenticated,service_role;

comment on table public.network_inquiries is
  'P4.3 private B2B inquiry records between active organizations. Not Shared Network Data and never exposed in Network search/profile read models.';
comment on table public.network_inquiry_events is
  'P4.3 append-only inquiry lifecycle audit ledger.';
comment on function public.p4_submit_inquiry(uuid,uuid,text,text) is
  'P4.3 controlled inquiry submission with claimed-recipient validation and anti-abuse rate limits.';
comment on function public.p4_transition_inquiry(uuid,text) is
  'P4.3 controlled inquiry lifecycle transition. No direct authenticated UPDATE grant exists.';
comment on function public.p4_list_inquiries(uuid,text,integer,integer) is
  'P4.3 organization-scoped private inquiry inbox/outbox read model.';
