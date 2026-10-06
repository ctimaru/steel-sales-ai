-- RFQH3 — Governed Dispatch Engine
-- One isolated dispatch per supplier with secure token hashing, idempotency,
-- bounce/complaint suppression and verified Resend webhook ingestion.

alter table public.buyer_rfq_suppliers
  drop constraint if exists buyer_rfq_suppliers_status_check;

alter table public.buyer_rfq_suppliers
  add constraint buyer_rfq_suppliers_status_check
  check (status in (
    'draft','queued','sent','delivered','opened','responded','declined',
    'bounced','complained','failed','cancelled','awarded'
  ));

create table if not exists public.buyer_rfq_dispatches (
  id uuid primary key,
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete cascade,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null,
  idempotency_key text not null,
  provider text not null default 'resend',
  provider_message_id text null,
  status text not null default 'queued'
    check (status in (
      'queued','sending','sent','delivered','opened','delivery_delayed',
      'bounced','complained','failed','cancelled'
    )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  reminder_count integer not null default 0 check (reminder_count >= 0),
  last_error text null,
  queued_at timestamptz not null default now(),
  last_attempt_at timestamptz null,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  opened_at timestamptz null,
  bounced_at timestamptz null,
  complained_at timestamptz null,
  last_reminder_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(supplier_id),
  unique(token_hash),
  unique(idempotency_key),
  unique(provider_message_id)
);

create table if not exists public.buyer_rfq_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend',
  provider_event_id text not null unique,
  provider_message_id text null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload)='object' and pg_column_size(payload) <= 65536),
  matched_dispatch_id uuid null references public.buyer_rfq_dispatches(id) on delete set null,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

create table if not exists public.buyer_rfq_email_suppressions (
  email_normalized text primary key
    check (email_normalized = lower(btrim(email_normalized))),
  reason text not null check (reason in ('hard_bounce','complaint')),
  provider text not null default 'resend',
  first_event_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.rfqh3_config (
  singleton boolean primary key default true check (singleton),
  webhook_db_secret_sha256 text not null,
  updated_at timestamptz not null default now()
);

insert into private.rfqh3_config(singleton,webhook_db_secret_sha256)
values (true,'012498a202dced520408a69faacbbcd95598b58b8016273b131edbe1d9fddc48')
on conflict (singleton) do update
set webhook_db_secret_sha256=excluded.webhook_db_secret_sha256,
    updated_at=now();

alter table public.buyer_rfq_dispatches enable row level security;
alter table public.buyer_rfq_webhook_events enable row level security;
alter table public.buyer_rfq_email_suppressions enable row level security;

revoke all on public.buyer_rfq_dispatches from anon,authenticated;
revoke all on public.buyer_rfq_webhook_events from anon,authenticated;
revoke all on public.buyer_rfq_email_suppressions from anon,authenticated;
grant select on public.buyer_rfq_dispatches to authenticated;

drop policy if exists buyer_rfq_dispatches_owner_select on public.buyer_rfq_dispatches;
create policy buyer_rfq_dispatches_owner_select
on public.buyer_rfq_dispatches for select to authenticated
using (owner_user_id=(select auth.uid()));

create index if not exists buyer_rfq_dispatches_rfq_idx
  on public.buyer_rfq_dispatches(rfq_id,created_at);
create index if not exists buyer_rfq_dispatches_owner_created_idx
  on public.buyer_rfq_dispatches(owner_user_id,created_at desc);
create index if not exists buyer_rfq_dispatches_status_idx
  on public.buyer_rfq_dispatches(status,updated_at);
create index if not exists buyer_rfq_webhook_message_idx
  on public.buyer_rfq_webhook_events(provider_message_id)
  where provider_message_id is not null;

create or replace function private.rfqh3_log_event(
  p_rfq_id uuid,p_supplier_id uuid,p_owner_user_id uuid,p_organization_id uuid,
  p_event_type text,p_metadata jsonb default '{}'::jsonb,p_actor_user_id uuid default null
)
returns void language sql security definer set search_path='' as $$
  insert into public.buyer_rfq_events(
    rfq_id,supplier_id,owner_user_id,organization_id,actor_user_id,event_type,metadata
  ) values (
    p_rfq_id,p_supplier_id,p_owner_user_id,p_organization_id,p_actor_user_id,
    p_event_type,coalesce(p_metadata,'{}'::jsonb)
  );
$$;
revoke all on function private.rfqh3_log_event(uuid,uuid,uuid,uuid,text,jsonb,uuid)
from public,anon,authenticated;

create or replace function private.rfqh3_launch_campaign_impl(
  p_rfq_id uuid,p_due_at timestamptz,p_buyer_message text,p_dispatches jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_supplier_count integer;
  v_dispatch_count integer;
  v_hourly_launch_count integer;
  v_daily_dispatch_count integer;
  v_row jsonb;
begin
  if v_user_id is null then raise exception 'Authenticated user required' using errcode='42501'; end if;

  select * into v_rfq
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id and r.owner_user_id=v_user_id
  for update;

  if not found then raise exception 'RFQ not found or not owned by caller' using errcode='42501'; end if;
  if v_rfq.status not in ('draft','ready') then raise exception 'RFQ has already been launched'; end if;
  if p_due_at is not null and p_due_at<=now() then raise exception 'RFQ due date must be in the future'; end if;
  if p_buyer_message is not null and char_length(p_buyer_message)>4000 then raise exception 'RFQ message too long'; end if;
  if jsonb_typeof(p_dispatches)<>'array' then raise exception 'Dispatches must be an array'; end if;

  select count(*)::integer into v_supplier_count
  from public.buyer_rfq_suppliers s where s.rfq_id=p_rfq_id;
  v_dispatch_count:=jsonb_array_length(p_dispatches);

  if v_supplier_count<1 then raise exception 'Add at least one supplier before launch'; end if;
  if v_supplier_count>100 or v_dispatch_count<>v_supplier_count then raise exception 'Dispatch set must match all RFQ suppliers'; end if;

  if exists (
    select 1 from public.buyer_rfq_suppliers s
    where s.rfq_id=p_rfq_id
      and (s.status<>'draft' or s.supplier_email_normalized is null)
  ) then
    raise exception 'Every supplier must be draft and have a usable email before launch';
  end if;

  if exists (
    select 1 from public.buyer_rfq_suppliers s
    join public.buyer_rfq_email_suppressions x on x.email_normalized=s.supplier_email_normalized
    where s.rfq_id=p_rfq_id
  ) then raise exception 'One or more supplier emails are suppressed'; end if;

  if (
    select count(distinct (item->>'supplier_id')) from jsonb_array_elements(p_dispatches) item
  )<>v_supplier_count then raise exception 'Dispatch supplier IDs must be unique'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_dispatches) item
    left join public.buyer_rfq_suppliers s
      on s.id=(item->>'supplier_id')::uuid and s.rfq_id=p_rfq_id
    where s.id is null
  ) then raise exception 'Dispatch supplier does not belong to RFQ'; end if;

  select count(*)::integer into v_hourly_launch_count
  from public.buyer_rfq_campaigns r
  where r.owner_user_id=v_user_id and r.launched_at>=now()-interval '1 hour';
  if v_hourly_launch_count>=10 then raise exception 'Hourly RFQ launch limit reached'; end if;

  select count(*)::integer into v_daily_dispatch_count
  from public.buyer_rfq_dispatches d
  where d.owner_user_id=v_user_id and d.created_at>=now()-interval '24 hours';
  if v_daily_dispatch_count+v_dispatch_count>250 then raise exception 'Daily supplier invite limit reached'; end if;

  for v_row in select value from jsonb_array_elements(p_dispatches)
  loop
    if nullif(v_row->>'token_hash','') is null or nullif(v_row->>'idempotency_key','') is null
      then raise exception 'Dispatch security fields are required';
    end if;

    insert into public.buyer_rfq_dispatches(
      id,rfq_id,supplier_id,owner_user_id,organization_id,token_hash,idempotency_key,status
    ) values (
      (v_row->>'dispatch_id')::uuid,p_rfq_id,(v_row->>'supplier_id')::uuid,
      v_user_id,v_rfq.organization_id,v_row->>'token_hash',v_row->>'idempotency_key','queued'
    );
  end loop;

  update public.buyer_rfq_campaigns
  set status='launched',due_at=p_due_at,
      buyer_message=nullif(btrim(coalesce(p_buyer_message,'')),''),
      launched_at=now(),updated_at=now()
  where id=p_rfq_id;

  update public.buyer_rfq_suppliers
  set status='queued',queued_at=now(),updated_at=now()
  where rfq_id=p_rfq_id;

  perform private.rfqh3_log_event(
    p_rfq_id,null,v_user_id,v_rfq.organization_id,'campaign_launched',
    jsonb_build_object('supplier_count',v_supplier_count,'due_at',p_due_at),v_user_id
  );

  return jsonb_build_object('rfq_id',p_rfq_id,'supplier_count',v_supplier_count,'status','launched');
end;
$$;
revoke all on function private.rfqh3_launch_campaign_impl(uuid,timestamptz,text,jsonb) from public,anon;
grant execute on function private.rfqh3_launch_campaign_impl(uuid,timestamptz,text,jsonb) to authenticated;

create or replace function public.rfqh3_launch_campaign(
  p_rfq_id uuid,p_due_at timestamptz default null,p_buyer_message text default null,
  p_dispatches jsonb default '[]'::jsonb
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.rfqh3_launch_campaign_impl(p_rfq_id,p_due_at,p_buyer_message,p_dispatches);
$$;
revoke all on function public.rfqh3_launch_campaign(uuid,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.rfqh3_launch_campaign(uuid,timestamptz,text,jsonb) to authenticated;

create or replace function private.rfqh3_mark_dispatch_result_impl(
  p_dispatch_id uuid,p_success boolean,p_provider_message_id text default null,p_error text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_dispatch public.buyer_rfq_dispatches%rowtype;
begin
  if v_user_id is null then raise exception 'Authenticated user required' using errcode='42501'; end if;
  select * into v_dispatch from public.buyer_rfq_dispatches d
  where d.id=p_dispatch_id and d.owner_user_id=v_user_id for update;
  if not found then raise exception 'Dispatch not found or not owned by caller' using errcode='42501'; end if;

  if p_success then
    if nullif(btrim(coalesce(p_provider_message_id,'')),'') is null
      then raise exception 'Provider message ID required on successful send';
    end if;

    update public.buyer_rfq_dispatches
    set status='sent',provider_message_id=p_provider_message_id,attempt_count=attempt_count+1,
        last_attempt_at=now(),sent_at=coalesce(sent_at,now()),last_error=null,updated_at=now()
    where id=p_dispatch_id;

    update public.buyer_rfq_suppliers
    set status='sent',provider_message_id=p_provider_message_id,sent_at=coalesce(sent_at,now()),
        last_error=null,updated_at=now()
    where id=v_dispatch.supplier_id;

    update public.buyer_rfq_campaigns set status='collecting',updated_at=now()
    where id=v_dispatch.rfq_id and status='launched';

    perform private.rfqh3_log_event(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,v_dispatch.organization_id,
      'email_sent',jsonb_build_object('dispatch_id',v_dispatch.id,'provider_message_id',p_provider_message_id),v_user_id
    );
  else
    update public.buyer_rfq_dispatches
    set status='failed',attempt_count=attempt_count+1,last_attempt_at=now(),
        last_error=left(coalesce(p_error,'Provider email error'),2000),updated_at=now()
    where id=p_dispatch_id;

    update public.buyer_rfq_suppliers
    set status='failed',last_error=left(coalesce(p_error,'Provider email error'),2000),updated_at=now()
    where id=v_dispatch.supplier_id;

    perform private.rfqh3_log_event(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,v_dispatch.organization_id,
      'dispatch_failed',jsonb_build_object('dispatch_id',v_dispatch.id,'error',left(coalesce(p_error,'Provider email error'),500)),v_user_id
    );
  end if;

  return jsonb_build_object('dispatch_id',p_dispatch_id,'status',case when p_success then 'sent' else 'failed' end);
end;
$$;
revoke all on function private.rfqh3_mark_dispatch_result_impl(uuid,boolean,text,text) from public,anon;
grant execute on function private.rfqh3_mark_dispatch_result_impl(uuid,boolean,text,text) to authenticated;

create or replace function public.rfqh3_mark_dispatch_result(
  p_dispatch_id uuid,p_success boolean,p_provider_message_id text default null,p_error text default null
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.rfqh3_mark_dispatch_result_impl(p_dispatch_id,p_success,p_provider_message_id,p_error);
$$;
revoke all on function public.rfqh3_mark_dispatch_result(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.rfqh3_mark_dispatch_result(uuid,boolean,text,text) to authenticated;

create or replace function private.rfqh3_prepare_retry_impl(
  p_dispatch_id uuid,p_token_hash text,p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_email text;
begin
  if v_user_id is null then raise exception 'Authenticated user required' using errcode='42501'; end if;
  select d.* into v_dispatch from public.buyer_rfq_dispatches d
  where d.id=p_dispatch_id and d.owner_user_id=v_user_id for update;
  if not found then raise exception 'Dispatch not found or not owned by caller' using errcode='42501'; end if;
  select s.supplier_email_normalized into v_email from public.buyer_rfq_suppliers s where s.id=v_dispatch.supplier_id;
  if v_dispatch.status<>'failed' then raise exception 'Only failed dispatches can be retried'; end if;
  if exists (select 1 from public.buyer_rfq_email_suppressions x where x.email_normalized=v_email)
    then raise exception 'Supplier email is suppressed';
  end if;

  update public.buyer_rfq_dispatches
  set status='queued',token_hash=p_token_hash,idempotency_key=p_idempotency_key,
      last_error=null,queued_at=now(),updated_at=now()
  where id=p_dispatch_id;

  update public.buyer_rfq_suppliers
  set status='queued',queued_at=now(),last_error=null,updated_at=now()
  where id=v_dispatch.supplier_id;

  perform private.rfqh3_log_event(
    v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,v_dispatch.organization_id,
    'dispatch_retry_queued',jsonb_build_object('dispatch_id',v_dispatch.id),v_user_id
  );

  return jsonb_build_object('dispatch_id',p_dispatch_id,'status','queued');
end;
$$;
revoke all on function private.rfqh3_prepare_retry_impl(uuid,text,text) from public,anon;
grant execute on function private.rfqh3_prepare_retry_impl(uuid,text,text) to authenticated;

create or replace function public.rfqh3_prepare_retry(
  p_dispatch_id uuid,p_token_hash text,p_idempotency_key text
)
returns jsonb language sql security invoker set search_path='' as $$
  select private.rfqh3_prepare_retry_impl(p_dispatch_id,p_token_hash,p_idempotency_key);
$$;
revoke all on function public.rfqh3_prepare_retry(uuid,text,text) from public,anon,authenticated;
grant execute on function public.rfqh3_prepare_retry(uuid,text,text) to authenticated;

create or replace function public.rfqh3_open_invite(p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_org_name text;
  v_distinta public.buyer_distintas%rowtype;
  v_lines jsonb;
  v_first_open boolean:=false;
begin
  select * into v_dispatch from public.buyer_rfq_dispatches d
  where d.token_hash=p_token_hash and d.status not in ('cancelled','failed','bounced','complained')
  for update;
  if not found then return jsonb_build_object('valid',false); end if;

  select * into v_supplier from public.buyer_rfq_suppliers s where s.id=v_dispatch.supplier_id;
  select * into v_rfq from public.buyer_rfq_campaigns r where r.id=v_dispatch.rfq_id;
  if v_rfq.status in ('cancelled','closed') then return jsonb_build_object('valid',false); end if;
  select o.name into v_org_name from public.organizations o where o.id=v_rfq.organization_id;
  select * into v_distinta from public.buyer_distintas d where d.id=v_rfq.source_distinta_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position',l.line_position,'description',l.description,'standard',l.standard_code,
    'grade',l.grade_code,'finish',l.finish_code,'quantity_mode',l.quantity_mode,
    'quantity',l.quantity,'bar_length_m',l.bar_length_m,'weight_kg_m',l.weight_kg_m,
    'line_meters',l.line_meters,'line_tonnes',l.line_tonnes,'note',l.note
  ) order by l.line_position),'[]'::jsonb)
  into v_lines from public.buyer_distinta_lines l where l.distinta_id=v_rfq.source_distinta_id;

  if v_dispatch.opened_at is null then
    v_first_open:=true;
    update public.buyer_rfq_dispatches set status='opened',opened_at=now(),updated_at=now() where id=v_dispatch.id;
    update public.buyer_rfq_suppliers
    set status=case when status in ('sent','delivered') then 'opened' else status end,
        opened_at=coalesce(opened_at,now()),updated_at=now()
    where id=v_supplier.id;
    perform private.rfqh3_log_event(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,v_dispatch.organization_id,
      'invite_opened',jsonb_build_object('dispatch_id',v_dispatch.id),null
    );
  end if;

  return jsonb_build_object(
    'valid',true,'first_open',v_first_open,'title',v_rfq.title,
    'buyer_organization_name',v_org_name,'supplier_name',v_supplier.supplier_name,
    'due_at',v_rfq.due_at,'expired',(v_rfq.due_at is not null and v_rfq.due_at<now()),
    'buyer_message',v_rfq.buyer_message,'delivery_country_code',v_rfq.delivery_country_code,
    'delivery_region',v_rfq.delivery_region,'incoterm',v_rfq.incoterm,
    'payment_terms',v_rfq.payment_terms,'line_count',v_distinta.line_count,
    'total_meters',v_distinta.total_meters,'total_tonnes',v_distinta.total_tonnes,'lines',v_lines
  );
end;
$$;
revoke all on function public.rfqh3_open_invite(text) from public,anon,authenticated;
grant execute on function public.rfqh3_open_invite(text) to anon,authenticated;

create or replace function public.rfqh3_ingest_resend_event(
  p_db_secret text,p_event_id text,p_event_type text,p_provider_message_id text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_expected_hash text;
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_email text;
  v_event_type text:=lower(btrim(coalesce(p_event_type,'')));
  v_inserted_event_id uuid;
begin
  select c.webhook_db_secret_sha256 into v_expected_hash
  from private.rfqh3_config c where c.singleton=true;

  if v_expected_hash is null
     or encode(extensions.digest(coalesce(p_db_secret,''),'sha256'),'hex')<>v_expected_hash
  then raise exception 'Invalid webhook database secret' using errcode='42501'; end if;

  if nullif(btrim(coalesce(p_event_id,'')),'') is null then raise exception 'Webhook event ID required'; end if;

  insert into public.buyer_rfq_webhook_events(
    provider_event_id,provider_message_id,event_type,payload
  ) values (
    p_event_id,nullif(btrim(coalesce(p_provider_message_id,'')),''),v_event_type,coalesce(p_payload,'{}'::jsonb)
  )
  on conflict (provider_event_id) do nothing
  returning id into v_inserted_event_id;

  if v_inserted_event_id is null then return jsonb_build_object('ok',true,'duplicate',true); end if;

  select d.* into v_dispatch from public.buyer_rfq_dispatches d
  where d.provider_message_id=p_provider_message_id limit 1;

  if not found then return jsonb_build_object('ok',true,'matched',false); end if;

  select s.supplier_email_normalized into v_email
  from public.buyer_rfq_suppliers s where s.id=v_dispatch.supplier_id;

  if v_event_type='email.delivered' then
    update public.buyer_rfq_dispatches
    set status=case when status='opened' then status else 'delivered' end,
        delivered_at=coalesce(delivered_at,now()),updated_at=now()
    where id=v_dispatch.id;
    update public.buyer_rfq_suppliers
    set status=case when status='opened' then status else 'delivered' end,
        delivered_at=coalesce(delivered_at,now()),updated_at=now()
    where id=v_dispatch.supplier_id;
  elsif v_event_type='email.delivery_delayed' then
    update public.buyer_rfq_dispatches
    set status=case when status='opened' then status else 'delivery_delayed' end,updated_at=now()
    where id=v_dispatch.id;
  elsif v_event_type='email.bounced' then
    update public.buyer_rfq_dispatches set status='bounced',bounced_at=coalesce(bounced_at,now()),updated_at=now()
    where id=v_dispatch.id;
    update public.buyer_rfq_suppliers set status='bounced',updated_at=now() where id=v_dispatch.supplier_id;
    if v_email is not null then
      insert into public.buyer_rfq_email_suppressions(email_normalized,reason,provider,first_event_id)
      values (v_email,'hard_bounce','resend',p_event_id)
      on conflict (email_normalized) do update set reason='hard_bounce',updated_at=now();
    end if;
  elsif v_event_type='email.complained' then
    update public.buyer_rfq_dispatches
    set status='complained',complained_at=coalesce(complained_at,now()),updated_at=now()
    where id=v_dispatch.id;
    update public.buyer_rfq_suppliers set status='complained',updated_at=now() where id=v_dispatch.supplier_id;
    if v_email is not null then
      insert into public.buyer_rfq_email_suppressions(email_normalized,reason,provider,first_event_id)
      values (v_email,'complaint','resend',p_event_id)
      on conflict (email_normalized) do update set reason='complaint',updated_at=now();
    end if;
  end if;

  update public.buyer_rfq_webhook_events
  set matched_dispatch_id=v_dispatch.id,processed=true,processed_at=now()
  where id=v_inserted_event_id;

  perform private.rfqh3_log_event(
    v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,v_dispatch.organization_id,
    replace(v_event_type,'.','_'),
    jsonb_build_object('dispatch_id',v_dispatch.id,'provider_message_id',p_provider_message_id,'provider_event_id',p_event_id),
    null
  );

  return jsonb_build_object('ok',true,'matched',true,'dispatch_id',v_dispatch.id,'event_type',v_event_type);
end;
$$;
revoke all on function public.rfqh3_ingest_resend_event(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.rfqh3_ingest_resend_event(text,text,text,text,jsonb) to anon;

notify pgrst,'reload schema';
