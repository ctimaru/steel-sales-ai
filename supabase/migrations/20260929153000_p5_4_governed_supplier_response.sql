-- P5.4 — Governed Supplier Response
-- Bidirectional Marketplace interaction above P5.3 entitlement/unlock.
-- Response rights are explicit: an active entitlement alone is insufficient.
-- The supplier must also have actually unlocked the request detail, the listing
-- must still be open, and anti-abuse / duplicate guards must pass.

create table public.marketplace_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_requests(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  response_kind text not null default 'interest',
  status text not null default 'draft',
  message text null,
  valid_until date null,
  submitted_at timestamptz null,
  withdrawn_at timestamptz null,
  decided_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(request_id,supplier_organization_id),
  constraint marketplace_responses_kind_check
    check (response_kind in ('interest','quote')),
  constraint marketplace_responses_status_check
    check (status in ('draft','submitted','withdrawn','declined','acknowledged','closed')),
  constraint marketplace_responses_message_check
    check (message is null or char_length(btrim(message)) between 1 and 4000),
  constraint marketplace_responses_valid_until_check
    check (valid_until is null or valid_until>=created_at::date),
  constraint marketplace_responses_lifecycle_check
    check (
      (status='draft'
        and submitted_at is null and withdrawn_at is null
        and decided_at is null and closed_at is null)
      or
      (status='submitted'
        and submitted_at is not null and withdrawn_at is null
        and decided_at is null and closed_at is null)
      or
      (status='withdrawn'
        and withdrawn_at is not null and closed_at is null)
      or
      (status in ('declined','acknowledged')
        and submitted_at is not null and withdrawn_at is null
        and decided_at is not null and closed_at is null)
      or
      (status='closed'
        and submitted_at is not null and withdrawn_at is null
        and closed_at is not null)
    )
);

create index marketplace_responses_request_idx
  on public.marketplace_responses(request_id,status,submitted_at desc,created_at desc);
create index marketplace_responses_supplier_idx
  on public.marketplace_responses(supplier_organization_id,status,created_at desc);
create index marketplace_responses_created_by_idx
  on public.marketplace_responses(created_by_user_id,created_at desc);

alter table public.marketplace_responses enable row level security;
revoke all on table public.marketplace_responses from public,anon,authenticated;
grant select,insert,update on table public.marketplace_responses to service_role;

create table public.marketplace_response_lines (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.marketplace_responses(id) on delete restrict,
  request_line_id uuid not null references public.marketplace_request_lines(id) on delete restrict,
  offered_quantity numeric null,
  quantity_unit text null,
  unit_price numeric null,
  currency_code text null,
  lead_time_days integer null,
  offered_delivery_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(response_id,request_line_id),
  constraint marketplace_response_lines_quantity_check
    check (offered_quantity is null or offered_quantity>0),
  constraint marketplace_response_lines_quantity_unit_check
    check (quantity_unit is null or quantity_unit in ('m','kg','t','pcs')),
  constraint marketplace_response_lines_price_check
    check (unit_price is null or unit_price>=0),
  constraint marketplace_response_lines_currency_check
    check (
      (unit_price is null and currency_code is null)
      or
      (unit_price is not null and currency_code ~ '^[A-Z]{3}$')
    ),
  constraint marketplace_response_lines_lead_time_check
    check (lead_time_days is null or lead_time_days between 0 and 3650),
  constraint marketplace_response_lines_notes_check
    check (notes is null or char_length(btrim(notes)) between 1 and 2000)
);

create index marketplace_response_lines_response_idx
  on public.marketplace_response_lines(response_id,request_line_id);
create index marketplace_response_lines_request_line_idx
  on public.marketplace_response_lines(request_line_id);

alter table public.marketplace_response_lines enable row level security;
revoke all on table public.marketplace_response_lines from public,anon,authenticated;
grant select,insert,update,delete on table public.marketplace_response_lines to service_role;

create table public.marketplace_response_events (
  id uuid primary key default gen_random_uuid(),
  event_sequence bigint generated always as identity,
  response_id uuid not null references public.marketplace_responses(id) on delete restrict,
  request_id uuid not null references public.marketplace_requests(id) on delete restrict,
  supplier_organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_side text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique(event_sequence),
  constraint marketplace_response_events_side_check
    check (actor_side in ('supplier','buyer')),
  constraint marketplace_response_events_type_check
    check (
      event_type in (
        'created','updated','line_upserted','line_removed',
        'submitted','withdrawn','acknowledged','declined','closed'
      )
    ),
  constraint marketplace_response_events_metadata_check
    check (jsonb_typeof(metadata)='object' and pg_column_size(metadata)<=16384)
);

create index marketplace_response_events_response_idx
  on public.marketplace_response_events(response_id,event_sequence);
create index marketplace_response_events_request_idx
  on public.marketplace_response_events(request_id,event_sequence);
create index marketplace_response_events_supplier_idx
  on public.marketplace_response_events(supplier_organization_id,event_sequence);
create index marketplace_response_events_actor_user_idx
  on public.marketplace_response_events(actor_user_id,event_sequence);
create index marketplace_response_events_actor_org_idx
  on public.marketplace_response_events(actor_organization_id,event_sequence);

alter table public.marketplace_response_events enable row level security;
revoke all on table public.marketplace_response_events from public,anon,authenticated;
grant select,insert on table public.marketplace_response_events to service_role;

create trigger marketplace_responses_touch_updated_at
before update on public.marketplace_responses
for each row execute function private.p5_1_touch_updated_at();

create trigger marketplace_response_lines_touch_updated_at
before update on public.marketplace_response_lines
for each row execute function private.p5_1_touch_updated_at();

create or replace function private.p5_4_response_event_immutable()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'marketplace_response_events is append-only'
    using errcode='55000';
end;
$function$;

revoke all on function private.p5_4_response_event_immutable()
from public,anon,authenticated;

create trigger marketplace_response_events_immutable
before update or delete on public.marketplace_response_events
for each row execute function private.p5_4_response_event_immutable();

create or replace function private.p5_4_record_event(
  p_response_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_actor_organization_id uuid,
  p_actor_side text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_response public.marketplace_responses%rowtype;
  v_event_id uuid;
  v_metadata jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if jsonb_typeof(v_metadata)<>'object' or pg_column_size(v_metadata)>16384 then
    raise exception 'Marketplace response event metadata must be a JSON object <= 16KB'
      using errcode='22023';
  end if;

  select * into v_response
  from public.marketplace_responses
  where id=p_response_id;

  if not found then
    raise exception 'Marketplace response not found' using errcode='P0002';
  end if;

  insert into public.marketplace_response_events(
    response_id,
    request_id,
    supplier_organization_id,
    actor_user_id,
    actor_organization_id,
    actor_side,
    event_type,
    metadata
  )
  values(
    v_response.id,
    v_response.request_id,
    v_response.supplier_organization_id,
    p_actor_user_id,
    p_actor_organization_id,
    p_actor_side,
    p_event_type,
    v_metadata
  )
  returning id into v_event_id;

  return v_event_id;
end;
$function$;

revoke all on function private.p5_4_record_event(uuid,text,uuid,uuid,text,jsonb)
from public,anon,authenticated;

create or replace function private.p5_4_response_rights_impl(
  p_supplier_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_request public.marketplace_requests%rowtype;
  v_entitlement jsonb;
  v_response public.marketplace_responses%rowtype;
  v_unlocked boolean := false;
  v_org_24h integer := 0;
  v_user_1h integer := 0;
begin
  v_user := private.p5_1_require_actor(p_supplier_organization_id,true);

  select * into v_request
  from public.marketplace_requests
  where id=p_request_id;

  if not found or v_request.organization_id=p_supplier_organization_id then
    return null;
  end if;

  select * into v_response
  from public.marketplace_responses
  where request_id=p_request_id
    and supplier_organization_id=p_supplier_organization_id;

  if found then
    return jsonb_build_object(
      'contract','P5.4-response-rights-v1',
      'request_id',p_request_id,
      'state',v_response.status,
      'reason','existing_response',
      'can_create',false,
      'can_edit',v_response.status='draft',
      'can_submit',v_response.status='draft',
      'can_withdraw',v_response.status in ('draft','submitted','acknowledged'),
      'response_id',v_response.id,
      'response_status',v_response.status
    );
  end if;

  if v_request.status<>'published'
     or v_request.opens_at>now()
     or v_request.closes_at<=now() then
    return jsonb_build_object(
      'contract','P5.4-response-rights-v1',
      'request_id',p_request_id,
      'state','ineligible',
      'reason','request_not_open',
      'can_create',false,
      'can_edit',false,
      'can_submit',false,
      'can_withdraw',false,
      'response_id',null,
      'response_status',null
    );
  end if;

  v_entitlement := private.p5_3_resolve_entitlement_impl(
    p_supplier_organization_id,p_request_id
  );

  if v_entitlement is null or v_entitlement->>'state'<>'entitled' then
    return jsonb_build_object(
      'contract','P5.4-response-rights-v1',
      'request_id',p_request_id,
      'state','ineligible',
      'reason','entitlement_required',
      'can_create',false,
      'can_edit',false,
      'can_submit',false,
      'can_withdraw',false,
      'response_id',null,
      'response_status',null
    );
  end if;

  select exists(
    select 1
    from public.marketplace_unlocks u
    where u.request_id=p_request_id
      and u.supplier_organization_id=p_supplier_organization_id
  ) into v_unlocked;

  if not v_unlocked then
    return jsonb_build_object(
      'contract','P5.4-response-rights-v1',
      'request_id',p_request_id,
      'state','ineligible',
      'reason','unlock_required',
      'can_create',false,
      'can_edit',false,
      'can_submit',false,
      'can_withdraw',false,
      'response_id',null,
      'response_status',null
    );
  end if;

  select count(*)::int into v_org_24h
  from public.marketplace_responses r
  where r.supplier_organization_id=p_supplier_organization_id
    and r.created_at>=now()-interval '24 hours';

  select count(*)::int into v_user_1h
  from public.marketplace_responses r
  where r.created_by_user_id=v_user
    and r.created_at>=now()-interval '1 hour';

  if v_org_24h>=40 or v_user_1h>=15 then
    return jsonb_build_object(
      'contract','P5.4-response-rights-v1',
      'request_id',p_request_id,
      'state','ineligible',
      'reason','rate_limited',
      'can_create',false,
      'can_edit',false,
      'can_submit',false,
      'can_withdraw',false,
      'response_id',null,
      'response_status',null
    );
  end if;

  return jsonb_build_object(
    'contract','P5.4-response-rights-v1',
    'request_id',p_request_id,
    'state','eligible',
    'reason','eligible_after_unlock',
    'can_create',true,
    'can_edit',false,
    'can_submit',false,
    'can_withdraw',false,
    'response_id',null,
    'response_status',null,
    'entitlement_key',v_entitlement->>'entitlement_key',
    'entitlement_source',v_entitlement->>'source_kind'
  );
end;
$function$;

revoke all on function private.p5_4_response_rights_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_4_response_rights_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_4_response_rights(
  p_supplier_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_4_response_rights_impl(
    p_supplier_organization_id,p_request_id
  );
$function$;

revoke all on function public.p5_4_response_rights(uuid,uuid)
from public,anon;
grant execute on function public.p5_4_response_rights(uuid,uuid)
to authenticated,service_role;

create or replace function private.p5_4_require_supplier_response(
  p_response_id uuid,
  p_supplier_organization_id uuid,
  p_require_draft boolean default false
)
returns public.marketplace_responses
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_response public.marketplace_responses%rowtype;
begin
  perform private.p5_1_require_actor(p_supplier_organization_id,true);

  select * into v_response
  from public.marketplace_responses
  where id=p_response_id
    and supplier_organization_id=p_supplier_organization_id;

  if not found then
    raise exception 'Marketplace response not found' using errcode='P0002';
  end if;

  if p_require_draft and v_response.status<>'draft' then
    raise exception 'Marketplace response is no longer editable'
      using errcode='22023';
  end if;

  return v_response;
end;
$function$;

revoke all on function private.p5_4_require_supplier_response(uuid,uuid,boolean)
from public,anon,authenticated;

create or replace function private.p5_4_create_response_impl(
  p_supplier_organization_id uuid,
  p_request_id uuid,
  p_response_kind text,
  p_message text,
  p_valid_until date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_rights jsonb;
  v_kind text := lower(btrim(coalesce(p_response_kind,'')));
  v_message text := nullif(btrim(coalesce(p_message,'')),'');
  v_response public.marketplace_responses%rowtype;
begin
  v_user := private.p5_1_require_actor(p_supplier_organization_id,true);
  v_rights := private.p5_4_response_rights_impl(
    p_supplier_organization_id,p_request_id
  );

  if v_rights is null then
    raise exception 'Marketplace response target not found' using errcode='P0002';
  end if;

  if coalesce((v_rights->>'can_create')::boolean,false)=false then
    raise exception 'Marketplace response right not available: %',
      coalesce(v_rights->>'reason','ineligible')
      using errcode='42501';
  end if;

  if v_kind not in ('interest','quote') then
    raise exception 'Marketplace response kind must be interest or quote'
      using errcode='22023';
  end if;

  if v_message is not null and char_length(v_message)>4000 then
    raise exception 'Marketplace response message cannot exceed 4000 characters'
      using errcode='22023';
  end if;

  if p_valid_until is not null and p_valid_until<current_date then
    raise exception 'Marketplace response validity cannot be in the past'
      using errcode='22023';
  end if;

  insert into public.marketplace_responses(
    request_id,
    supplier_organization_id,
    created_by_user_id,
    response_kind,
    status,
    message,
    valid_until
  )
  values(
    p_request_id,
    p_supplier_organization_id,
    v_user,
    v_kind,
    'draft',
    v_message,
    p_valid_until
  )
  returning * into v_response;

  perform private.p5_4_record_event(
    v_response.id,
    'created',
    v_user,
    p_supplier_organization_id,
    'supplier',
    jsonb_build_object(
      'response_kind',v_kind,
      'has_message',v_message is not null
    )
  );

  return jsonb_build_object(
    'response_id',v_response.id,
    'request_id',v_response.request_id,
    'status',v_response.status,
    'response_kind',v_response.response_kind
  );
exception
  when unique_violation then
    raise exception 'Supplier organization already has a Marketplace response for this request'
      using errcode='23505';
end;
$function$;

revoke all on function private.p5_4_create_response_impl(uuid,uuid,text,text,date)
from public,anon;
grant execute on function private.p5_4_create_response_impl(uuid,uuid,text,text,date)
to authenticated,service_role;

create or replace function public.p5_4_create_response(
  p_supplier_organization_id uuid,
  p_request_id uuid,
  p_response_kind text default 'interest',
  p_message text default null,
  p_valid_until date default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_4_create_response_impl(
    p_supplier_organization_id,
    p_request_id,
    p_response_kind,
    p_message,
    p_valid_until
  );
$function$;

revoke all on function public.p5_4_create_response(uuid,uuid,text,text,date)
from public,anon;
grant execute on function public.p5_4_create_response(uuid,uuid,text,text,date)
to authenticated,service_role;

create or replace function private.p5_4_update_response_impl(
  p_supplier_organization_id uuid,
  p_response_id uuid,
  p_response_kind text,
  p_message text,
  p_valid_until date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_response public.marketplace_responses%rowtype;
  v_kind text := lower(btrim(coalesce(p_response_kind,'')));
  v_message text := nullif(btrim(coalesce(p_message,'')),'');
begin
  v_response := private.p5_4_require_supplier_response(
    p_response_id,p_supplier_organization_id,true
  );
  v_user := (select auth.uid());

  if v_kind not in ('interest','quote') then
    raise exception 'Marketplace response kind must be interest or quote'
      using errcode='22023';
  end if;

  if v_message is not null and char_length(v_message)>4000 then
    raise exception 'Marketplace response message cannot exceed 4000 characters'
      using errcode='22023';
  end if;

  if p_valid_until is not null and p_valid_until<current_date then
    raise exception 'Marketplace response validity cannot be in the past'
      using errcode='22023';
  end if;

  update public.marketplace_responses
  set
    response_kind=v_kind,
    message=v_message,
    valid_until=p_valid_until
  where id=p_response_id
  returning * into v_response;

  perform private.p5_4_record_event(
    p_response_id,
    'updated',
    v_user,
    p_supplier_organization_id,
    'supplier',
    jsonb_build_object('response_kind',v_kind)
  );

  return jsonb_build_object(
    'response_id',v_response.id,
    'status',v_response.status,
    'response_kind',v_response.response_kind
  );
end;
$function$;

revoke all on function private.p5_4_update_response_impl(uuid,uuid,text,text,date)
from public,anon;
grant execute on function private.p5_4_update_response_impl(uuid,uuid,text,text,date)
to authenticated,service_role;

create or replace function public.p5_4_update_response(
  p_supplier_organization_id uuid,
  p_response_id uuid,
  p_response_kind text,
  p_message text default null,
  p_valid_until date default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_4_update_response_impl(
    p_supplier_organization_id,
    p_response_id,
    p_response_kind,
    p_message,
    p_valid_until
  );
$function$;

revoke all on function public.p5_4_update_response(uuid,uuid,text,text,date)
from public,anon;
grant execute on function public.p5_4_update_response(uuid,uuid,text,text,date)
to authenticated,service_role;

create or replace function private.p5_4_upsert_response_line_impl(
  p_supplier_organization_id uuid,
  p_response_id uuid,
  p_request_line_id uuid,
  p_offered_quantity numeric,
  p_quantity_unit text,
  p_unit_price numeric,
  p_currency_code text,
  p_lead_time_days integer,
  p_offered_delivery_date date,
  p_notes text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_response public.marketplace_responses%rowtype;
  v_request_line public.marketplace_request_lines%rowtype;
  v_quantity_unit text := nullif(lower(btrim(coalesce(p_quantity_unit,''))),'');
  v_currency text := nullif(upper(btrim(coalesce(p_currency_code,''))),'');
  v_notes text := nullif(btrim(coalesce(p_notes,'')),'');
  v_line public.marketplace_response_lines%rowtype;
begin
  v_response := private.p5_4_require_supplier_response(
    p_response_id,p_supplier_organization_id,true
  );
  v_user := (select auth.uid());

  select * into v_request_line
  from public.marketplace_request_lines
  where id=p_request_line_id
    and request_id=v_response.request_id;

  if not found then
    raise exception 'Marketplace request line does not belong to response request'
      using errcode='22023';
  end if;

  if p_offered_quantity is not null and p_offered_quantity<=0 then
    raise exception 'offered quantity must be greater than zero'
      using errcode='22023';
  end if;

  if v_quantity_unit is not null
     and v_quantity_unit not in ('m','kg','t','pcs') then
    raise exception 'quantity unit must be m, kg, t or pcs'
      using errcode='22023';
  end if;

  if p_offered_quantity is not null and v_quantity_unit is null then
    v_quantity_unit := v_request_line.quantity_unit;
  end if;

  if p_unit_price is not null and p_unit_price<0 then
    raise exception 'unit price cannot be negative'
      using errcode='22023';
  end if;

  if p_unit_price is null then
    v_currency := null;
  elsif v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'priced response line requires a three-letter currency code'
      using errcode='22023';
  end if;

  if p_lead_time_days is not null
     and (p_lead_time_days<0 or p_lead_time_days>3650) then
    raise exception 'lead time must be between 0 and 3650 days'
      using errcode='22023';
  end if;

  if p_offered_delivery_date is not null
     and p_offered_delivery_date<current_date then
    raise exception 'offered delivery date cannot be in the past'
      using errcode='22023';
  end if;

  if v_notes is not null and char_length(v_notes)>2000 then
    raise exception 'response line notes cannot exceed 2000 characters'
      using errcode='22023';
  end if;

  insert into public.marketplace_response_lines(
    response_id,
    request_line_id,
    offered_quantity,
    quantity_unit,
    unit_price,
    currency_code,
    lead_time_days,
    offered_delivery_date,
    notes
  )
  values(
    p_response_id,
    p_request_line_id,
    p_offered_quantity,
    v_quantity_unit,
    p_unit_price,
    v_currency,
    p_lead_time_days,
    p_offered_delivery_date,
    v_notes
  )
  on conflict(response_id,request_line_id)
  do update set
    offered_quantity=excluded.offered_quantity,
    quantity_unit=excluded.quantity_unit,
    unit_price=excluded.unit_price,
    currency_code=excluded.currency_code,
    lead_time_days=excluded.lead_time_days,
    offered_delivery_date=excluded.offered_delivery_date,
    notes=excluded.notes
  returning * into v_line;

  perform private.p5_4_record_event(
    p_response_id,
    'line_upserted',
    v_user,
    p_supplier_organization_id,
    'supplier',
    jsonb_build_object(
      'request_line_id',p_request_line_id,
      'has_price',p_unit_price is not null
    )
  );

  return jsonb_build_object(
    'response_id',p_response_id,
    'response_line_id',v_line.id,
    'request_line_id',p_request_line_id
  );
end;
$function$;

revoke all on function private.p5_4_upsert_response_line_impl(uuid,uuid,uuid,numeric,text,numeric,text,integer,date,text)
from public,anon;
grant execute on function private.p5_4_upsert_response_line_impl(uuid,uuid,uuid,numeric,text,numeric,text,integer,date,text)
to authenticated,service_role;

create or replace function public.p5_4_upsert_response_line(
  p_supplier_organization_id uuid,
  p_response_id uuid,
  p_request_line_id uuid,
  p_offered_quantity numeric default null,
  p_quantity_unit text default null,
  p_unit_price numeric default null,
  p_currency_code text default null,
  p_lead_time_days integer default null,
  p_offered_delivery_date date default null,
  p_notes text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_4_upsert_response_line_impl(
    p_supplier_organization_id,
    p_response_id,
    p_request_line_id,
    p_offered_quantity,
    p_quantity_unit,
    p_unit_price,
    p_currency_code,
    p_lead_time_days,
    p_offered_delivery_date,
    p_notes
  );
$function$;

revoke all on function public.p5_4_upsert_response_line(uuid,uuid,uuid,numeric,text,numeric,text,integer,date,text)
from public,anon;
grant execute on function public.p5_4_upsert_response_line(uuid,uuid,uuid,numeric,text,numeric,text,integer,date,text)
to authenticated,service_role;

create or replace function private.p5_4_remove_response_line_impl(
  p_supplier_organization_id uuid,
  p_response_id uuid,
  p_request_line_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_response public.marketplace_responses%rowtype;
begin
  v_response := private.p5_4_require_supplier_response(
    p_response_id,p_supplier_organization_id,true
  );
  v_user := (select auth.uid());

  delete from public.marketplace_response_lines
  where response_id=p_response_id
    and request_line_id=p_request_line_id;

  if not found then
    raise exception 'Marketplace response line not found' using errcode='P0002';
  end if;

  perform private.p5_4_record_event(
    p_response_id,
    'line_removed',
    v_user,
    p_supplier_organization_id,
    'supplier',
    jsonb_build_object('request_line_id',p_request_line_id)
  );

  return jsonb_build_object(
    'response_id',p_response_id,
    'request_line_id',p_request_line_id,
    'removed',true
  );
end;
$function$;

revoke all on function private.p5_4_remove_response_line_impl(uuid,uuid,uuid)
from public,anon;
grant execute on function private.p5_4_remove_response_line_impl(uuid,uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_4_remove_response_line(
  p_supplier_organization_id uuid,
  p_response_id uuid,
  p_request_line_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_4_remove_response_line_impl(
    p_supplier_organization_id,
    p_response_id,
    p_request_line_id
  );
$function$;

revoke all on function public.p5_4_remove_response_line(uuid,uuid,uuid)
from public,anon;
grant execute on function public.p5_4_remove_response_line(uuid,uuid,uuid)
to authenticated,service_role;

create or replace function private.p5_4_supplier_response_json(
  p_response_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
select jsonb_build_object(
  'response_id',r.id,
  'request_id',r.request_id,
  'response_kind',r.response_kind,
  'status',r.status,
  'message',r.message,
  'valid_until',r.valid_until,
  'submitted_at',r.submitted_at,
  'withdrawn_at',r.withdrawn_at,
  'decided_at',r.decided_at,
  'closed_at',r.closed_at,
  'created_at',r.created_at,
  'updated_at',r.updated_at,
  'buyer_visibility_mode',req.visibility_mode,
  'lines',coalesce((
    select jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'request_line_id',rl.request_line_id,
        'line_number',mrl.line_number,
        'offered_quantity',rl.offered_quantity,
        'quantity_unit',rl.quantity_unit,
        'unit_price',rl.unit_price,
        'currency_code',rl.currency_code,
        'lead_time_days',rl.lead_time_days,
        'offered_delivery_date',rl.offered_delivery_date,
        'notes',rl.notes
      ))
      order by mrl.line_number
    )
    from public.marketplace_response_lines rl
    join public.marketplace_request_lines mrl on mrl.id=rl.request_line_id
    where rl.response_id=r.id
  ),'[]'::jsonb)
)
from public.marketplace_responses r
join public.marketplace_requests req on req.id=r.request_id
where r.id=p_response_id;
$function$;

revoke all on function private.p5_4_supplier_response_json(uuid)
from public,anon,authenticated;

create or replace function private.p5_4_supplier_workspace_impl(
  p_supplier_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_rights jsonb;
  v_response_id uuid;
  v_request_lines jsonb := '[]'::jsonb;
  v_can_compose boolean := false;
begin
  v_rights := private.p5_4_response_rights_impl(
    p_supplier_organization_id,p_request_id
  );

  if v_rights is null then
    return null;
  end if;

  v_response_id := nullif(v_rights->>'response_id','')::uuid;
  v_can_compose :=
    coalesce((v_rights->>'can_create')::boolean,false)
    or v_response_id is not null;

  if v_can_compose then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'request_line_id',l.id,
        'line_number',l.line_number,
        'quantity',l.quantity,
        'quantity_unit',l.quantity_unit
      )
      order by l.line_number
    ),'[]'::jsonb)
    into v_request_lines
    from public.marketplace_request_lines l
    where l.request_id=p_request_id;
  end if;

  return jsonb_build_object(
    'contract','P5.4-supplier-workspace-v1',
    'request_id',p_request_id,
    'rights',v_rights,
    'request_lines',v_request_lines,
    'response',case
      when v_response_id is null then null
      else private.p5_4_supplier_response_json(v_response_id)
    end
  );
end;
$function$;

revoke all on function private.p5_4_supplier_workspace_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_4_supplier_workspace_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_4_supplier_workspace(
  p_supplier_organization_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_4_supplier_workspace_impl(
    p_supplier_organization_id,p_request_id
  );
$function$;

revoke all on function public.p5_4_supplier_workspace(uuid,uuid)
from public,anon;
grant execute on function public.p5_4_supplier_workspace(uuid,uuid)
to authenticated,service_role;

create or replace function private.p5_4_submit_response_impl(
  p_supplier_organization_id uuid,
  p_response_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_response public.marketplace_responses%rowtype;
  v_request public.marketplace_requests%rowtype;
  v_entitlement jsonb;
  v_line_count integer;
  v_priced_line_count integer;
begin
  select * into v_response
  from public.marketplace_responses
  where id=p_response_id
    and supplier_organization_id=p_supplier_organization_id
  for update;

  if not found then
    raise exception 'Marketplace response not found' using errcode='P0002';
  end if;

  v_user := private.p5_1_require_actor(p_supplier_organization_id,true);

  if v_response.status<>'draft' then
    raise exception 'Only draft Marketplace responses can be submitted'
      using errcode='22023';
  end if;

  select * into v_request
  from public.marketplace_requests
  where id=v_response.request_id;

  if v_request.status<>'published'
     or v_request.opens_at>now()
     or v_request.closes_at<=now() then
    raise exception 'Marketplace request is no longer open'
      using errcode='22023';
  end if;

  v_entitlement := private.p5_3_resolve_entitlement_impl(
    p_supplier_organization_id,v_response.request_id
  );

  if v_entitlement is null or v_entitlement->>'state'<>'entitled' then
    raise exception 'Active Marketplace entitlement required at submission'
      using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.marketplace_unlocks u
    where u.request_id=v_response.request_id
      and u.supplier_organization_id=p_supplier_organization_id
  ) then
    raise exception 'Marketplace detail unlock required before submission'
      using errcode='42501';
  end if;

  select
    count(*)::int,
    count(*) filter(where rl.unit_price is not null)::int
  into v_line_count,v_priced_line_count
  from public.marketplace_response_lines rl
  where rl.response_id=p_response_id;

  if v_response.response_kind='quote' and (v_line_count=0 or v_priced_line_count=0) then
    raise exception 'Quote response requires at least one priced response line'
      using errcode='22023';
  end if;

  if v_response.response_kind='interest'
     and nullif(btrim(coalesce(v_response.message,'')),'') is null
     and v_line_count=0 then
    raise exception 'Interest response requires a message or structured response line'
      using errcode='22023';
  end if;

  update public.marketplace_responses
  set status='submitted',submitted_at=now()
  where id=p_response_id
  returning * into v_response;

  perform private.p5_4_record_event(
    p_response_id,
    'submitted',
    v_user,
    p_supplier_organization_id,
    'supplier',
    jsonb_build_object(
      'response_kind',v_response.response_kind,
      'line_count',v_line_count,
      'priced_line_count',v_priced_line_count
    )
  );

  return jsonb_build_object(
    'response_id',v_response.id,
    'request_id',v_response.request_id,
    'status',v_response.status,
    'submitted_at',v_response.submitted_at
  );
end;
$function$;

revoke all on function private.p5_4_submit_response_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_4_submit_response_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_4_submit_response(
  p_supplier_organization_id uuid,
  p_response_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_4_submit_response_impl(
    p_supplier_organization_id,p_response_id
  );
$function$;

revoke all on function public.p5_4_submit_response(uuid,uuid)
from public,anon;
grant execute on function public.p5_4_submit_response(uuid,uuid)
to authenticated,service_role;

create or replace function private.p5_4_withdraw_response_impl(
  p_supplier_organization_id uuid,
  p_response_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_response public.marketplace_responses%rowtype;
begin
  select * into v_response
  from public.marketplace_responses
  where id=p_response_id
    and supplier_organization_id=p_supplier_organization_id
  for update;

  if not found then
    raise exception 'Marketplace response not found' using errcode='P0002';
  end if;

  v_user := private.p5_1_require_actor(p_supplier_organization_id,true);

  if v_response.status not in ('draft','submitted','acknowledged') then
    raise exception 'Marketplace response cannot be withdrawn from current state'
      using errcode='22023';
  end if;

  update public.marketplace_responses
  set
    status='withdrawn',
    withdrawn_at=now(),
    decided_at=case when decided_at is null then null else decided_at end
  where id=p_response_id
  returning * into v_response;

  perform private.p5_4_record_event(
    p_response_id,
    'withdrawn',
    v_user,
    p_supplier_organization_id,
    'supplier',
    '{}'::jsonb
  );

  return jsonb_build_object(
    'response_id',v_response.id,
    'status',v_response.status,
    'withdrawn_at',v_response.withdrawn_at
  );
end;
$function$;

revoke all on function private.p5_4_withdraw_response_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_4_withdraw_response_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_4_withdraw_response(
  p_supplier_organization_id uuid,
  p_response_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_4_withdraw_response_impl(
    p_supplier_organization_id,p_response_id
  );
$function$;

revoke all on function public.p5_4_withdraw_response(uuid,uuid)
from public,anon;
grant execute on function public.p5_4_withdraw_response(uuid,uuid)
to authenticated,service_role;

create or replace function private.p5_4_supplier_identity(
  p_supplier_organization_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
select coalesce((
  select jsonb_build_object(
    'network_company_id',c.id,
    'display_name',coalesce(nullif(btrim(c.trading_name),''),c.legal_name),
    'country_code',c.country_code,
    'verification_status',c.verification_status,
    'claimed_status',c.claimed_status,
    'profile_available',true
  )
  from public.organization_network_company_links l
  join public.network_companies c on c.id=l.network_company_id
  where l.organization_id=p_supplier_organization_id
    and l.link_status='active'
    and c.publication_status='published'
  limit 1
),(
  select jsonb_build_object(
    'display_name',o.name,
    'country_code',o.country_code,
    'profile_available',false
  )
  from public.organizations o
  where o.id=p_supplier_organization_id
));
$function$;

revoke all on function private.p5_4_supplier_identity(uuid)
from public,anon,authenticated;

create or replace function private.p5_4_buyer_inbox_impl(
  p_buyer_organization_id uuid,
  p_request_id uuid default null,
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
  v_limit integer;
  v_offset integer;
  v_items jsonb;
  v_total integer;
begin
  perform private.p5_1_require_actor(p_buyer_organization_id,false);

  if p_request_id is not null
     and not exists (
       select 1
       from public.marketplace_requests r
       where r.id=p_request_id
         and r.organization_id=p_buyer_organization_id
     ) then
    raise exception 'Marketplace buyer request not found' using errcode='P0002';
  end if;

  v_limit := least(greatest(coalesce(p_limit,50),1),100);
  v_offset := greatest(coalesce(p_offset,0),0);

  with base as (
    select
      mr.id as response_id,
      mr.request_id,
      req.title as request_title,
      req.visibility_mode,
      mr.response_kind,
      mr.status,
      mr.submitted_at,
      mr.created_at,
      mr.updated_at,
      mr.supplier_organization_id,
      (
        select count(*)::int
        from public.marketplace_response_lines rl
        where rl.response_id=mr.id
      ) as line_count
    from public.marketplace_responses mr
    join public.marketplace_requests req on req.id=mr.request_id
    where req.organization_id=p_buyer_organization_id
      and (p_request_id is null or req.id=p_request_id)
      and mr.status<>'draft'
  ),
  counted as (
    select count(*)::int as total from base
  ),
  paged as (
    select *
    from base
    order by
      case when status='submitted' then 0
           when status='acknowledged' then 1
           else 2 end,
      coalesce(submitted_at,created_at) desc,
      response_id
    limit v_limit offset v_offset
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'response_id',p.response_id,
        'request_id',p.request_id,
        'request_title',p.request_title,
        'request_visibility_mode',p.visibility_mode,
        'response_kind',p.response_kind,
        'status',p.status,
        'submitted_at',p.submitted_at,
        'created_at',p.created_at,
        'updated_at',p.updated_at,
        'line_count',p.line_count,
        'supplier',private.p5_4_supplier_identity(p.supplier_organization_id)
      )
      order by
        case when p.status='submitted' then 0
             when p.status='acknowledged' then 1
             else 2 end,
        coalesce(p.submitted_at,p.created_at) desc,
        p.response_id
    ),'[]'::jsonb),
    (select total from counted)
  into v_items,v_total
  from paged p;

  return jsonb_build_object(
    'contract','P5.4-buyer-inbox-v1',
    'items',coalesce(v_items,'[]'::jsonb),
    'total',coalesce(v_total,0),
    'limit',v_limit,
    'offset',v_offset
  );
end;
$function$;

revoke all on function private.p5_4_buyer_inbox_impl(uuid,uuid,integer,integer)
from public,anon;
grant execute on function private.p5_4_buyer_inbox_impl(uuid,uuid,integer,integer)
to authenticated,service_role;

create or replace function public.p5_4_buyer_inbox(
  p_buyer_organization_id uuid,
  p_request_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_4_buyer_inbox_impl(
    p_buyer_organization_id,
    p_request_id,
    p_limit,
    p_offset
  );
$function$;

revoke all on function public.p5_4_buyer_inbox(uuid,uuid,integer,integer)
from public,anon;
grant execute on function public.p5_4_buyer_inbox(uuid,uuid,integer,integer)
to authenticated,service_role;

create or replace function private.p5_4_buyer_response_detail_impl(
  p_buyer_organization_id uuid,
  p_response_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_response public.marketplace_responses%rowtype;
  v_request public.marketplace_requests%rowtype;
  v_lines jsonb;
begin
  perform private.p5_1_require_actor(p_buyer_organization_id,false);

  select mr.*
  into v_response
  from public.marketplace_responses mr
  join public.marketplace_requests req on req.id=mr.request_id
  where mr.id=p_response_id
    and req.organization_id=p_buyer_organization_id
    and mr.status<>'draft';

  if not found then
    return null;
  end if;

  select req.*
  into v_request
  from public.marketplace_requests req
  where req.id=v_response.request_id
    and req.organization_id=p_buyer_organization_id;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'request_line_id',rl.request_line_id,
      'line_number',mrl.line_number,
      'product_family_key',pf.canonical_key,
      'product_family_name',pf.display_name,
      'request_quantity',mrl.quantity,
      'request_quantity_unit',mrl.quantity_unit,
      'offered_quantity',rl.offered_quantity,
      'quantity_unit',rl.quantity_unit,
      'unit_price',rl.unit_price,
      'currency_code',rl.currency_code,
      'lead_time_days',rl.lead_time_days,
      'offered_delivery_date',rl.offered_delivery_date,
      'notes',rl.notes
    ))
    order by mrl.line_number
  ),'[]'::jsonb)
  into v_lines
  from public.marketplace_response_lines rl
  join public.marketplace_request_lines mrl on mrl.id=rl.request_line_id
  join public.network_product_families pf on pf.id=mrl.product_family_id
  where rl.response_id=p_response_id;

  return jsonb_build_object(
    'contract','P5.4-buyer-response-detail-v1',
    'response',jsonb_build_object(
      'response_id',v_response.id,
      'request_id',v_response.request_id,
      'response_kind',v_response.response_kind,
      'status',v_response.status,
      'message',v_response.message,
      'valid_until',v_response.valid_until,
      'submitted_at',v_response.submitted_at,
      'withdrawn_at',v_response.withdrawn_at,
      'decided_at',v_response.decided_at,
      'closed_at',v_response.closed_at,
      'created_at',v_response.created_at,
      'updated_at',v_response.updated_at
    ),
    'request',jsonb_build_object(
      'request_id',v_request.id,
      'title',v_request.title,
      'visibility_mode',v_request.visibility_mode,
      'status',v_request.status,
      'closes_at',v_request.closes_at
    ),
    'supplier',private.p5_4_supplier_identity(v_response.supplier_organization_id),
    'lines',v_lines
  );
end;
$function$;

revoke all on function private.p5_4_buyer_response_detail_impl(uuid,uuid)
from public,anon;
grant execute on function private.p5_4_buyer_response_detail_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p5_4_buyer_response_detail(
  p_buyer_organization_id uuid,
  p_response_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p5_4_buyer_response_detail_impl(
    p_buyer_organization_id,p_response_id
  );
$function$;

revoke all on function public.p5_4_buyer_response_detail(uuid,uuid)
from public,anon;
grant execute on function public.p5_4_buyer_response_detail(uuid,uuid)
to authenticated,service_role;

create or replace function private.p5_4_buyer_transition_impl(
  p_buyer_organization_id uuid,
  p_response_id uuid,
  p_action text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_response public.marketplace_responses%rowtype;
  v_action text := lower(btrim(coalesce(p_action,'')));
  v_new_status text;
begin
  v_user := private.p5_1_require_actor(p_buyer_organization_id,true);

  select mr.*
  into v_response
  from public.marketplace_responses mr
  join public.marketplace_requests req on req.id=mr.request_id
  where mr.id=p_response_id
    and req.organization_id=p_buyer_organization_id
  for update of mr;

  if not found then
    raise exception 'Marketplace response not found' using errcode='P0002';
  end if;

  if v_action='acknowledge' then
    if v_response.status<>'submitted' then
      raise exception 'Only submitted responses can be acknowledged'
        using errcode='22023';
    end if;
    v_new_status := 'acknowledged';
  elsif v_action='decline' then
    if v_response.status not in ('submitted','acknowledged') then
      raise exception 'Only submitted or acknowledged responses can be declined'
        using errcode='22023';
    end if;
    v_new_status := 'declined';
  elsif v_action='close' then
    if v_response.status<>'acknowledged' then
      raise exception 'Only acknowledged responses can be closed'
        using errcode='22023';
    end if;
    v_new_status := 'closed';
  else
    raise exception 'Unsupported Marketplace buyer response action'
      using errcode='22023';
  end if;

  update public.marketplace_responses
  set
    status=v_new_status,
    decided_at=case
      when v_new_status in ('acknowledged','declined') then now()
      else decided_at
    end,
    closed_at=case when v_new_status='closed' then now() else null end
  where id=p_response_id
  returning * into v_response;

  perform private.p5_4_record_event(
    p_response_id,
    case
      when v_action='acknowledge' then 'acknowledged'
      when v_action='decline' then 'declined'
      else 'closed'
    end,
    v_user,
    p_buyer_organization_id,
    'buyer',
    '{}'::jsonb
  );

  return jsonb_build_object(
    'response_id',v_response.id,
    'status',v_response.status,
    'decided_at',v_response.decided_at,
    'closed_at',v_response.closed_at
  );
end;
$function$;

revoke all on function private.p5_4_buyer_transition_impl(uuid,uuid,text)
from public,anon;
grant execute on function private.p5_4_buyer_transition_impl(uuid,uuid,text)
to authenticated,service_role;

create or replace function public.p5_4_buyer_transition(
  p_buyer_organization_id uuid,
  p_response_id uuid,
  p_action text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p5_4_buyer_transition_impl(
    p_buyer_organization_id,p_response_id,p_action
  );
$function$;

revoke all on function public.p5_4_buyer_transition(uuid,uuid,text)
from public,anon;
grant execute on function public.p5_4_buyer_transition(uuid,uuid,text)
to authenticated,service_role;

comment on table public.marketplace_responses is
  'P5.4 governed supplier responses in the shared Marketplace domain. Separate from private Commercial Memory offers.';
comment on table public.marketplace_response_lines is
  'P5.4 structured line-level supplier response data bound only to Marketplace request lines.';
comment on table public.marketplace_response_events is
  'P5.4 append-only response lifecycle audit ledger with deterministic event_sequence ordering.';
comment on function public.p5_4_response_rights(uuid,uuid) is
  'P5.4 explicit supplier response-right read model. Entitlement alone is insufficient: open request, actual P5.3 unlock, write membership, duplicate guard and rate limits are required.';
comment on function public.p5_4_supplier_workspace(uuid,uuid) is
  'P5.4 supplier-side response workspace. Anonymous buyer organization identity is never returned.';
comment on function public.p5_4_buyer_inbox(uuid,uuid,integer,integer) is
  'P5.4 buyer organization inbox for submitted and later-state supplier responses to its own Marketplace requests.';
comment on function public.p5_4_buyer_response_detail(uuid,uuid) is
  'P5.4 buyer-only response detail with supplier identity and structured commercial response lines.';
