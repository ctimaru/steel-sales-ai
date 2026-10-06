-- RFQH3 reminder closure and message-level delivery ledger.

create table if not exists public.buyer_rfq_dispatch_messages (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.buyer_rfq_dispatches(id) on delete cascade,
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete cascade,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  message_kind text not null check (message_kind in ('invite','reminder')),
  sequence integer not null check (sequence >= 1),
  idempotency_key text not null unique,
  provider_message_id text null unique,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','delivery_delayed','bounced','complained','failed')),
  last_error text null,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  bounced_at timestamptz null,
  complained_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(dispatch_id,message_kind,sequence)
);

alter table public.buyer_rfq_dispatch_messages enable row level security;
revoke all on public.buyer_rfq_dispatch_messages from anon,authenticated;
grant select on public.buyer_rfq_dispatch_messages to authenticated;

drop policy if exists buyer_rfq_dispatch_messages_owner_select on public.buyer_rfq_dispatch_messages;
create policy buyer_rfq_dispatch_messages_owner_select
on public.buyer_rfq_dispatch_messages for select to authenticated
using (owner_user_id=(select auth.uid()));

create index if not exists buyer_rfq_dispatch_messages_dispatch_idx
  on public.buyer_rfq_dispatch_messages(dispatch_id,created_at);
create index if not exists buyer_rfq_dispatch_messages_provider_idx
  on public.buyer_rfq_dispatch_messages(provider_message_id)
  where provider_message_id is not null;
create index if not exists buyer_rfq_dispatch_messages_owner_kind_idx
  on public.buyer_rfq_dispatch_messages(owner_user_id,message_kind,created_at desc);

insert into public.buyer_rfq_dispatch_messages(
  dispatch_id,rfq_id,supplier_id,owner_user_id,message_kind,sequence,
  idempotency_key,provider_message_id,status,last_error,sent_at,delivered_at,
  bounced_at,complained_at,created_at,updated_at
)
select
  d.id,d.rfq_id,d.supplier_id,d.owner_user_id,'invite',
  greatest(d.attempt_count,1),
  d.idempotency_key,d.provider_message_id,
  case
    when d.status in ('delivered','opened') then 'delivered'
    when d.status='bounced' then 'bounced'
    when d.status='complained' then 'complained'
    when d.status='failed' then 'failed'
    when d.status='delivery_delayed' then 'delivery_delayed'
    else 'sent'
  end,
  d.last_error,d.sent_at,d.delivered_at,d.bounced_at,d.complained_at,
  d.created_at,d.updated_at
from public.buyer_rfq_dispatches d
where d.provider_message_id is not null
on conflict (idempotency_key) do nothing;

create or replace function private.rfqh3_mark_dispatch_result_impl(
  p_dispatch_id uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_sequence integer;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select *
  into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.id=p_dispatch_id
    and d.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'Dispatch not found or not owned by caller' using errcode='42501';
  end if;

  v_sequence := v_dispatch.attempt_count + 1;

  if p_success then
    if nullif(btrim(coalesce(p_provider_message_id,'')),'') is null then
      raise exception 'Provider message ID required on successful send';
    end if;

    insert into public.buyer_rfq_dispatch_messages(
      dispatch_id,rfq_id,supplier_id,owner_user_id,message_kind,sequence,
      idempotency_key,provider_message_id,status,sent_at
    ) values (
      v_dispatch.id,v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,
      'invite',v_sequence,v_dispatch.idempotency_key,p_provider_message_id,'sent',now()
    )
    on conflict (idempotency_key) do update
    set provider_message_id=excluded.provider_message_id,
        status='sent',
        sent_at=coalesce(public.buyer_rfq_dispatch_messages.sent_at,now()),
        last_error=null,
        updated_at=now();

    update public.buyer_rfq_dispatches
    set status='sent',
        provider_message_id=p_provider_message_id,
        attempt_count=attempt_count+1,
        last_attempt_at=now(),
        sent_at=coalesce(sent_at,now()),
        last_error=null,
        updated_at=now()
    where id=p_dispatch_id;

    update public.buyer_rfq_suppliers
    set status='sent',
        provider_message_id=p_provider_message_id,
        sent_at=coalesce(sent_at,now()),
        last_error=null,
        updated_at=now()
    where id=v_dispatch.supplier_id;

    update public.buyer_rfq_campaigns
    set status='collecting',
        updated_at=now()
    where id=v_dispatch.rfq_id
      and status='launched';

    perform private.rfqh3_log_event(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,
      v_dispatch.organization_id,'email_sent',
      jsonb_build_object(
        'dispatch_id',v_dispatch.id,
        'provider_message_id',p_provider_message_id,
        'attempt',v_sequence
      ),
      v_user_id
    );
  else
    insert into public.buyer_rfq_dispatch_messages(
      dispatch_id,rfq_id,supplier_id,owner_user_id,message_kind,sequence,
      idempotency_key,status,last_error
    ) values (
      v_dispatch.id,v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,
      'invite',v_sequence,v_dispatch.idempotency_key,'failed',
      left(coalesce(p_error,'Provider email error'),2000)
    )
    on conflict (idempotency_key) do update
    set status='failed',
        last_error=excluded.last_error,
        updated_at=now();

    update public.buyer_rfq_dispatches
    set status='failed',
        attempt_count=attempt_count+1,
        last_attempt_at=now(),
        last_error=left(coalesce(p_error,'Provider email error'),2000),
        updated_at=now()
    where id=p_dispatch_id;

    update public.buyer_rfq_suppliers
    set status='failed',
        last_error=left(coalesce(p_error,'Provider email error'),2000),
        updated_at=now()
    where id=v_dispatch.supplier_id;

    perform private.rfqh3_log_event(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,
      v_dispatch.organization_id,'dispatch_failed',
      jsonb_build_object(
        'dispatch_id',v_dispatch.id,
        'error',left(coalesce(p_error,'Provider email error'),500),
        'attempt',v_sequence
      ),
      v_user_id
    );
  end if;

  return jsonb_build_object(
    'dispatch_id',p_dispatch_id,
    'status',case when p_success then 'sent' else 'failed' end
  );
end;
$$;

create or replace function private.rfqh3_prepare_reminder_impl(
  p_dispatch_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_sequence integer;
  v_daily_reminders integer;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select * into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.id=p_dispatch_id and d.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'Dispatch not found or not owned by caller' using errcode='42501';
  end if;

  select * into v_supplier
  from public.buyer_rfq_suppliers s
  where s.id=v_dispatch.supplier_id;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=v_dispatch.rfq_id;

  if v_campaign.status not in ('launched','collecting') then
    raise exception 'RFQ is not open for reminders';
  end if;

  if v_campaign.due_at is not null and v_campaign.due_at <= now() then
    raise exception 'RFQ deadline has passed';
  end if;

  if v_supplier.status not in ('sent','delivered','opened') then
    raise exception 'Supplier is not eligible for reminder';
  end if;

  if v_dispatch.status not in ('sent','delivered','opened','delivery_delayed') then
    raise exception 'Dispatch is not eligible for reminder';
  end if;

  if v_dispatch.reminder_count >= 2 then
    raise exception 'Reminder limit reached';
  end if;

  if v_dispatch.sent_at is null or v_dispatch.sent_at > now()-interval '24 hours' then
    raise exception 'First reminder cooldown not reached';
  end if;

  if v_dispatch.last_reminder_at is not null
     and v_dispatch.last_reminder_at > now()-interval '24 hours' then
    raise exception 'Reminder cooldown not reached';
  end if;

  if exists (
    select 1 from public.buyer_rfq_email_suppressions x
    where x.email_normalized=v_supplier.supplier_email_normalized
  ) then
    raise exception 'Supplier email is suppressed';
  end if;

  select count(*)::integer into v_daily_reminders
  from public.buyer_rfq_dispatch_messages m
  where m.owner_user_id=v_user_id
    and m.message_kind='reminder'
    and m.created_at>=now()-interval '24 hours';

  if v_daily_reminders >= 100 then
    raise exception 'Daily reminder limit reached';
  end if;

  v_sequence := v_dispatch.reminder_count + 1;

  insert into public.buyer_rfq_dispatch_messages(
    dispatch_id,rfq_id,supplier_id,owner_user_id,message_kind,sequence,
    idempotency_key,status
  ) values (
    v_dispatch.id,v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,
    'reminder',v_sequence,p_idempotency_key,'queued'
  )
  on conflict (idempotency_key) do update
  set status=case
        when public.buyer_rfq_dispatch_messages.status='failed' then 'queued'
        else public.buyer_rfq_dispatch_messages.status
      end,
      last_error=case
        when public.buyer_rfq_dispatch_messages.status='failed' then null
        else public.buyer_rfq_dispatch_messages.last_error
      end,
      updated_at=now();

  return jsonb_build_object(
    'dispatch_id',v_dispatch.id,
    'supplier_id',v_dispatch.supplier_id,
    'attempt_count',v_dispatch.attempt_count,
    'reminder_sequence',v_sequence,
    'status','queued'
  );
end;
$$;

revoke all on function private.rfqh3_prepare_reminder_impl(uuid,text) from public,anon;
grant execute on function private.rfqh3_prepare_reminder_impl(uuid,text) to authenticated;

create or replace function public.rfqh3_prepare_reminder(
  p_dispatch_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh3_prepare_reminder_impl(p_dispatch_id,p_idempotency_key);
$$;

revoke all on function public.rfqh3_prepare_reminder(uuid,text) from public,anon,authenticated;
grant execute on function public.rfqh3_prepare_reminder(uuid,text) to authenticated;

create or replace function private.rfqh3_mark_reminder_result_impl(
  p_dispatch_id uuid,
  p_idempotency_key text,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_message public.buyer_rfq_dispatch_messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select * into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.id=p_dispatch_id and d.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'Dispatch not found or not owned by caller' using errcode='42501';
  end if;

  select * into v_message
  from public.buyer_rfq_dispatch_messages m
  where m.dispatch_id=p_dispatch_id
    and m.idempotency_key=p_idempotency_key
    and m.message_kind='reminder'
  for update;

  if not found then
    raise exception 'Prepared reminder not found';
  end if;

  if p_success then
    if nullif(btrim(coalesce(p_provider_message_id,'')),'') is null then
      raise exception 'Provider message ID required on successful reminder';
    end if;

    update public.buyer_rfq_dispatch_messages
    set provider_message_id=p_provider_message_id,
        status='sent',
        sent_at=coalesce(sent_at,now()),
        last_error=null,
        updated_at=now()
    where id=v_message.id;

    update public.buyer_rfq_dispatches
    set reminder_count=greatest(reminder_count,v_message.sequence),
        last_reminder_at=now(),
        last_error=null,
        updated_at=now()
    where id=p_dispatch_id;

    perform private.rfqh3_log_event(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,
      v_dispatch.organization_id,'reminder_sent',
      jsonb_build_object(
        'dispatch_id',v_dispatch.id,
        'provider_message_id',p_provider_message_id,
        'reminder_sequence',v_message.sequence
      ),
      v_user_id
    );
  else
    update public.buyer_rfq_dispatch_messages
    set status='failed',
        last_error=left(coalesce(p_error,'Provider email error'),2000),
        updated_at=now()
    where id=v_message.id;

    update public.buyer_rfq_dispatches
    set last_error=left(coalesce(p_error,'Provider email error'),2000),
        updated_at=now()
    where id=p_dispatch_id;

    perform private.rfqh3_log_event(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,
      v_dispatch.organization_id,'reminder_failed',
      jsonb_build_object(
        'dispatch_id',v_dispatch.id,
        'reminder_sequence',v_message.sequence,
        'error',left(coalesce(p_error,'Provider email error'),500)
      ),
      v_user_id
    );
  end if;

  return jsonb_build_object(
    'dispatch_id',p_dispatch_id,
    'reminder_sequence',v_message.sequence,
    'status',case when p_success then 'sent' else 'failed' end
  );
end;
$$;

revoke all on function private.rfqh3_mark_reminder_result_impl(uuid,text,boolean,text,text)
from public,anon;
grant execute on function private.rfqh3_mark_reminder_result_impl(uuid,text,boolean,text,text)
to authenticated;

create or replace function public.rfqh3_mark_reminder_result(
  p_dispatch_id uuid,
  p_idempotency_key text,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh3_mark_reminder_result_impl(
    p_dispatch_id,p_idempotency_key,p_success,p_provider_message_id,p_error
  );
$$;

revoke all on function public.rfqh3_mark_reminder_result(uuid,text,boolean,text,text)
from public,anon,authenticated;
grant execute on function public.rfqh3_mark_reminder_result(uuid,text,boolean,text,text)
to authenticated;

create or replace function rfqh_secure.rfqh3_ingest_resend_event_impl(
  p_db_secret text,p_event_id text,p_event_type text,p_provider_message_id text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_expected_hash text;
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_message public.buyer_rfq_dispatch_messages%rowtype;
  v_email text;
  v_event_type text:=lower(btrim(coalesce(p_event_type,'')));
  v_inserted_event_id uuid;
begin
  select c.webhook_db_secret_sha256 into v_expected_hash
  from private.rfqh3_config c where c.singleton=true;

  if v_expected_hash is null
     or encode(extensions.digest(coalesce(p_db_secret,''),'sha256'),'hex')<>v_expected_hash
  then
    raise exception 'Invalid webhook database secret' using errcode='42501';
  end if;

  if nullif(btrim(coalesce(p_event_id,'')),'') is null then
    raise exception 'Webhook event ID required';
  end if;

  insert into public.buyer_rfq_webhook_events(
    provider_event_id,provider_message_id,event_type,payload
  ) values (
    p_event_id,nullif(btrim(coalesce(p_provider_message_id,'')),''),v_event_type,
    coalesce(p_payload,'{}'::jsonb)
  )
  on conflict (provider_event_id) do nothing
  returning id into v_inserted_event_id;

  if v_inserted_event_id is null then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;

  select * into v_message
  from public.buyer_rfq_dispatch_messages m
  where m.provider_message_id=p_provider_message_id
  limit 1;

  if found then
    select * into v_dispatch
    from public.buyer_rfq_dispatches d
    where d.id=v_message.dispatch_id;
  else
    select * into v_dispatch
    from public.buyer_rfq_dispatches d
    where d.provider_message_id=p_provider_message_id
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('ok',true,'matched',false);
  end if;

  select s.supplier_email_normalized into v_email
  from public.buyer_rfq_suppliers s
  where s.id=v_dispatch.supplier_id;

  if v_event_type='email.sent' then
    if v_message.id is not null then
      update public.buyer_rfq_dispatch_messages
      set status='sent',sent_at=coalesce(sent_at,now()),updated_at=now()
      where id=v_message.id;
    end if;

  elsif v_event_type='email.delivered' then
    if v_message.id is not null then
      update public.buyer_rfq_dispatch_messages
      set status='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now()
      where id=v_message.id;
    end if;

    update public.buyer_rfq_dispatches
    set status=case when status='opened' then status else 'delivered' end,
        delivered_at=coalesce(delivered_at,now()),updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status=case when status='opened' then status else 'delivered' end,
        delivered_at=coalesce(delivered_at,now()),updated_at=now()
    where id=v_dispatch.supplier_id
      and status in ('sent','delivered','opened');

  elsif v_event_type='email.delivery_delayed' then
    if v_message.id is not null then
      update public.buyer_rfq_dispatch_messages
      set status='delivery_delayed',updated_at=now()
      where id=v_message.id;
    end if;

    update public.buyer_rfq_dispatches
    set status=case when status='opened' then status else 'delivery_delayed' end,
        updated_at=now()
    where id=v_dispatch.id;

  elsif v_event_type='email.bounced' then
    if v_message.id is not null then
      update public.buyer_rfq_dispatch_messages
      set status='bounced',bounced_at=coalesce(bounced_at,now()),updated_at=now()
      where id=v_message.id;
    end if;

    update public.buyer_rfq_dispatches
    set status='bounced',bounced_at=coalesce(bounced_at,now()),updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status='bounced',updated_at=now()
    where id=v_dispatch.supplier_id;

    if v_email is not null then
      insert into public.buyer_rfq_email_suppressions(
        email_normalized,reason,provider,first_event_id
      ) values (v_email,'hard_bounce','resend',p_event_id)
      on conflict (email_normalized) do update
      set reason='hard_bounce',updated_at=now();
    end if;

  elsif v_event_type='email.complained' then
    if v_message.id is not null then
      update public.buyer_rfq_dispatch_messages
      set status='complained',complained_at=coalesce(complained_at,now()),updated_at=now()
      where id=v_message.id;
    end if;

    update public.buyer_rfq_dispatches
    set status='complained',complained_at=coalesce(complained_at,now()),updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status='complained',updated_at=now()
    where id=v_dispatch.supplier_id;

    if v_email is not null then
      insert into public.buyer_rfq_email_suppressions(
        email_normalized,reason,provider,first_event_id
      ) values (v_email,'complaint','resend',p_event_id)
      on conflict (email_normalized) do update
      set reason='complaint',updated_at=now();
    end if;

  elsif v_event_type in ('email.failed','email.suppressed') then
    if v_message.id is not null then
      update public.buyer_rfq_dispatch_messages
      set status='failed',last_error=v_event_type,updated_at=now()
      where id=v_message.id;
    end if;

    if v_message.id is null or v_message.message_kind='invite' then
      update public.buyer_rfq_dispatches
      set status='failed',last_error=v_event_type,updated_at=now()
      where id=v_dispatch.id;

      update public.buyer_rfq_suppliers
      set status='failed',last_error=v_event_type,updated_at=now()
      where id=v_dispatch.supplier_id
        and status not in ('responded','declined','awarded');
    else
      update public.buyer_rfq_dispatches
      set last_error=v_event_type,updated_at=now()
      where id=v_dispatch.id;
    end if;
  end if;

  update public.buyer_rfq_webhook_events
  set matched_dispatch_id=v_dispatch.id,processed=true,processed_at=now()
  where id=v_inserted_event_id;

  perform private.rfqh3_log_event(
    v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,v_dispatch.organization_id,
    replace(v_event_type,'.','_'),
    jsonb_build_object(
      'dispatch_id',v_dispatch.id,
      'message_id',v_message.id,
      'message_kind',v_message.message_kind,
      'provider_message_id',p_provider_message_id,
      'provider_event_id',p_event_id
    ),
    null
  );

  return jsonb_build_object(
    'ok',true,'matched',true,'dispatch_id',v_dispatch.id,'event_type',v_event_type
  );
end;
$$;

notify pgrst,'reload schema';
