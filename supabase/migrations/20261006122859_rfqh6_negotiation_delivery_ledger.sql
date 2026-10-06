
alter table public.buyer_rfq_dispatch_messages
  drop constraint if exists buyer_rfq_dispatch_messages_message_kind_check;

alter table public.buyer_rfq_dispatch_messages
  add constraint buyer_rfq_dispatch_messages_message_kind_check
  check(message_kind in('invite','reminder','negotiation'));

create or replace function private.rfqh6_queue_notification_ledger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_dispatch_id uuid;
  v_sequence integer;
  v_dispatch public.buyer_rfq_dispatches%rowtype;
begin
  if new.sender_role<>'buyer' or new.notification_status<>'pending' then
    return new;
  end if;

  select t.dispatch_id into v_dispatch_id
  from public.buyer_rfq_negotiation_threads t
  where t.id=new.thread_id;

  if v_dispatch_id is null then
    return new;
  end if;

  select * into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.id=v_dispatch_id
  for update;

  if not found then
    return new;
  end if;

  select coalesce(max(m.sequence),0)+1
  into v_sequence
  from public.buyer_rfq_dispatch_messages m
  where m.dispatch_id=v_dispatch_id
    and m.message_kind='negotiation';

  insert into public.buyer_rfq_dispatch_messages(
    dispatch_id,rfq_id,supplier_id,owner_user_id,
    message_kind,sequence,idempotency_key,status
  ) values(
    v_dispatch.id,new.rfq_id,new.supplier_id,new.owner_user_id,
    'negotiation',v_sequence,'rfqh6-'||new.id::text,'queued'
  )
  on conflict(idempotency_key) do nothing;

  return new;
end;
$$;

drop trigger if exists rfqh6_queue_notification_ledger
on public.buyer_rfq_negotiation_messages;

create trigger rfqh6_queue_notification_ledger
after insert on public.buyer_rfq_negotiation_messages
for each row
when (new.sender_role='buyer' and new.notification_status='pending')
execute function private.rfqh6_queue_notification_ledger();

create or replace function private.rfqh6_sync_notification_ledger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.sender_role<>'buyer'
    or new.notification_status is not distinct from old.notification_status then
    return new;
  end if;

  if new.notification_status='sent' then
    update public.buyer_rfq_dispatch_messages
    set provider_message_id=new.notification_provider_message_id,
        status='sent',
        last_error=null,
        sent_at=coalesce(sent_at,now()),
        updated_at=now()
    where idempotency_key='rfqh6-'||new.id::text;

  elsif new.notification_status='failed' then
    update public.buyer_rfq_dispatch_messages
    set status='failed',
        last_error=left(coalesce(new.notification_error,'Negotiation notification failed'),1000),
        updated_at=now()
    where idempotency_key='rfqh6-'||new.id::text;

  elsif new.notification_status='skipped' then
    delete from public.buyer_rfq_dispatch_messages
    where idempotency_key='rfqh6-'||new.id::text
      and provider_message_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists rfqh6_sync_notification_ledger
on public.buyer_rfq_negotiation_messages;

create trigger rfqh6_sync_notification_ledger
after update of notification_status,notification_provider_message_id,notification_error
on public.buyer_rfq_negotiation_messages
for each row
execute function private.rfqh6_sync_notification_ledger();

create or replace function rfqh_secure.rfqh3_ingest_resend_event_impl(
  p_db_secret text,
  p_event_id text,
  p_event_type text,
  p_provider_message_id text,
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
  v_is_negotiation boolean:=false;
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
    v_is_negotiation:=v_message.message_kind='negotiation';
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

    if not v_is_negotiation then
      update public.buyer_rfq_dispatches
      set status=case when status='opened' then status else 'delivered' end,
          delivered_at=coalesce(delivered_at,now()),updated_at=now()
      where id=v_dispatch.id;

      update public.buyer_rfq_suppliers
      set status=case when status='opened' then status else 'delivered' end,
          delivered_at=coalesce(delivered_at,now()),updated_at=now()
      where id=v_dispatch.supplier_id
        and status in ('sent','delivered','opened');
    end if;

  elsif v_event_type='email.delivery_delayed' then
    if v_message.id is not null then
      update public.buyer_rfq_dispatch_messages
      set status='delivery_delayed',updated_at=now()
      where id=v_message.id;
    end if;

    if not v_is_negotiation then
      update public.buyer_rfq_dispatches
      set status=case when status='opened' then status else 'delivery_delayed' end,
          updated_at=now()
      where id=v_dispatch.id;
    else
      update public.buyer_rfq_dispatches
      set last_error='email.delivery_delayed',updated_at=now()
      where id=v_dispatch.id;
    end if;

  elsif v_event_type='email.bounced' then
    if v_message.id is not null then
      update public.buyer_rfq_dispatch_messages
      set status='bounced',bounced_at=coalesce(bounced_at,now()),updated_at=now()
      where id=v_message.id;
    end if;

    update public.buyer_rfq_dispatches
    set status=case
          when v_is_negotiation and status in('responded','declined') then status
          else 'bounced'
        end,
        bounced_at=coalesce(bounced_at,now()),
        last_error=case when v_is_negotiation then 'email.bounced' else last_error end,
        updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status=case
          when v_is_negotiation and status in('responded','declined','awarded') then status
          else 'bounced'
        end,
        last_error=case when v_is_negotiation then 'email.bounced' else last_error end,
        updated_at=now()
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
    set status=case
          when v_is_negotiation and status in('responded','declined') then status
          else 'complained'
        end,
        complained_at=coalesce(complained_at,now()),
        last_error=case when v_is_negotiation then 'email.complained' else last_error end,
        updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status=case
          when v_is_negotiation and status in('responded','declined','awarded') then status
          else 'complained'
        end,
        last_error=case when v_is_negotiation then 'email.complained' else last_error end,
        updated_at=now()
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
