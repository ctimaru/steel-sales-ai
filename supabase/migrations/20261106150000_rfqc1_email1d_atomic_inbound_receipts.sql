-- RFQC1.EMAIL1.D — isolated, atomic inbound-email receipt + RFQH6 append.
-- DEVELOPMENT MIGRATION ONLY. Do NOT apply to production without founder approval.
-- Resend webhook receiver, MX/DNS and sender-authentication verification are
-- deliberately outside this migration and MUST remain disabled.
--
-- This follows the existing RFQH3 server-only DB secret boundary. The trusted
-- API server MUST verify Resend raw-body webhook signature, signed recipient
-- alias, and trusted mail transport authentication BEFORE calling this RPC.
-- A correct From header by itself is never evidence of sender authentication.
--
-- Processing is one DB transaction:
-- (1) validate secret/tenant/dispatch/sender,
-- (2) claim UNIQUE provider email id, (3) append RFQH6 message,
-- (4) update thread and receipt. Any error rolls back the entire transaction.

create table public.buyer_rfq_inbound_email_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend'
    check (provider = 'resend'),
  provider_email_id uuid not null,
  provider_event_id text not null
    check (char_length(provider_event_id) between 1 and 200),
  dispatch_id uuid not null
    references public.buyer_rfq_dispatches(id) on delete cascade,
  rfq_id uuid not null
    references public.buyer_rfq_campaigns(id) on delete cascade,
  supplier_id uuid not null
    references public.buyer_rfq_suppliers(id) on delete cascade,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  sender_email_normalized text not null
    check (char_length(sender_email_normalized) between 3 and 320),
  message_id uuid references public.buyer_rfq_negotiation_messages(id)
    on delete set null,
  created_at timestamptz not null default now(),
  constraint rfqc1_inbound_unique_email unique (provider, provider_email_id),
  constraint rfqc1_inbound_unique_event unique (provider, provider_event_id)
);

create index buyer_rfq_inbound_receipts_dispatch_idx
  on public.buyer_rfq_inbound_email_receipts(dispatch_id, created_at desc);

alter table public.buyer_rfq_inbound_email_receipts enable row level security;
-- No RLS policies by design: receipts are server-internal, never a buyer or
-- supplier feed. The negotiation message uses existing tenant-scoped reads.
revoke all on public.buyer_rfq_inbound_email_receipts
  from public, anon, authenticated, service_role;

create or replace function rfqh_secure.rfqc1_ingest_received_email_impl(
  p_db_secret text,
  p_provider_event_id text,
  p_provider_email_id uuid,
  p_dispatch_id uuid,
  p_sender_email text,
  p_sender_authenticated boolean,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $rfqc1$
declare
  v_expected_hash text;
  v_event_id text := btrim(coalesce(p_provider_event_id, ''));
  v_sender text := lower(btrim(coalesce(p_sender_email, '')));
  v_body text := btrim(coalesce(p_body, ''));
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_thread public.buyer_rfq_negotiation_threads%rowtype;
  v_message public.buyer_rfq_negotiation_messages%rowtype;
  v_receipt_id uuid;
  v_next_status text;
begin
  -- Same server-only credential used by RFQH3 webhook receipt processing.
  select c.webhook_db_secret_sha256 into v_expected_hash
  from private.rfqh3_config c where c.singleton = true;

  if v_expected_hash is null or
    encode(extensions.digest(coalesce(p_db_secret, ''), 'sha256'), 'hex') <> v_expected_hash
  then
    raise exception 'Invalid webhook database secret' using errcode = '42501';
  end if;

  if p_provider_email_id is null or p_dispatch_id is null
    or char_length(v_event_id) not between 1 and 200
    or v_event_id ~ '[[:cntrl:]]'
    or char_length(v_sender) not between 3 and 320
    or v_sender !~ '^[^[:space:]@,<>]+@[^[:space:]@,<>]+$'
  then
    raise exception 'Inbound email envelope invalid' using errcode = '22023';
  end if;

  -- The caller must supply an independently authenticated transport verdict;
  -- it must NEVER be set from a From header or raw Authentication-Results.
  if p_sender_authenticated is distinct from true then
    raise exception 'Inbound sender unverified' using errcode = '42501';
  end if;

  if char_length(v_body) not between 1 and 4000
    or octet_length(v_body) > 32768 then
    raise exception 'Inbound message body invalid' using errcode = '22023';
  end if;

  -- A replay stays a successful no-op even if an RFQ closed in the meantime.
  if exists (
    select 1 from public.buyer_rfq_inbound_email_receipts r
    where r.provider = 'resend' and r.provider_email_id = p_provider_email_id
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  select * into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.id = p_dispatch_id and d.provider = 'resend'
    and d.status not in ('queued','sending','cancelled','failed',
                         'bounced','complained','declined')
  for update;
  if not found then
    raise exception 'RFQ dispatch unavailable' using errcode = '42501';
  end if;

  -- Serialise the entire supplier negotiation against RFQH6 buyer/supplier
  -- writes (which also lock the campaign before reading the thread).
  select * into v_campaign
  from public.buyer_rfq_campaigns c
  where c.id = v_dispatch.rfq_id
    and c.organization_id = v_dispatch.organization_id
    and c.owner_user_id = v_dispatch.owner_user_id
  for update;
  if not found or v_campaign.status not in ('launched','collecting') then
    raise exception 'RFQ unavailable for negotiation' using errcode = '42501';
  end if;

  select * into v_supplier
  from public.buyer_rfq_suppliers s
  where s.id = v_dispatch.supplier_id
    and s.rfq_id = v_dispatch.rfq_id
    and s.owner_user_id = v_dispatch.owner_user_id
    and s.supplier_email_normalized = v_sender
    and s.delivery_channel in ('email', 'both')
    and s.status not in ('draft','queued','cancelled','failed',
                         'bounced','complained','declined','awarded','not_awarded')
  for share;
  if not found then
    raise exception 'RFQ supplier email mismatch or closed' using errcode = '42501';
  end if;

  select * into v_thread
  from public.buyer_rfq_negotiation_threads t
  where t.dispatch_id = v_dispatch.id
    and t.rfq_id = v_dispatch.rfq_id
    and t.supplier_id = v_dispatch.supplier_id
    and t.organization_id = v_dispatch.organization_id
  for update;

  if not found then
    insert into public.buyer_rfq_negotiation_threads(
      rfq_id, supplier_id, dispatch_id, owner_user_id, organization_id,
      status, last_message_at, last_supplier_message_at
    ) values (
      v_dispatch.rfq_id, v_dispatch.supplier_id, v_dispatch.id,
      v_dispatch.owner_user_id, v_dispatch.organization_id,
      'awaiting_buyer', now(), now()
    )
    returning * into v_thread;
  elsif v_thread.status = 'closed' then
    raise exception 'RFQ negotiation thread closed' using errcode = '42501';
  end if;

  if (
    select count(*) from public.buyer_rfq_negotiation_messages m
    where m.thread_id = v_thread.id
      and m.sender_role = 'supplier'
      and m.created_at >= now() - interval '1 hour'
  ) >= 10 then
    raise exception 'RFQ message rate limit reached' using errcode = '22023';
  end if;

  -- Unique provider EMAIL id (not merely unique webhook-event id) protects
  -- against provider retries AND separate events for the same message.
  -- ON CONFLICT waits for the competing transaction to commit/roll back.
  insert into public.buyer_rfq_inbound_email_receipts(
    provider, provider_email_id, provider_event_id,
    dispatch_id, rfq_id, supplier_id, organization_id,
    sender_email_normalized
  ) values (
    'resend', p_provider_email_id, v_event_id,
    v_dispatch.id, v_dispatch.rfq_id,
    v_dispatch.supplier_id, v_dispatch.organization_id, v_sender
  )
  on conflict (provider, provider_email_id) do nothing
  returning id into v_receipt_id;

  if v_receipt_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  v_next_status := case
    when v_thread.active_request_type = 'bafo' then 'bafo_requested'
    when v_thread.active_request_type in ('revision','counter_target')
      then 'awaiting_supplier'
    else 'awaiting_buyer'
  end;

  insert into public.buyer_rfq_negotiation_messages(
    thread_id, rfq_id, supplier_id, owner_user_id, organization_id,
    sender_role, message_type, round_no, body,
    request_due_at, notification_status
  ) values (
    v_thread.id, v_thread.rfq_id, v_thread.supplier_id,
    v_thread.owner_user_id, v_thread.organization_id,
    'supplier', 'message', v_thread.round_no, v_body,
    v_thread.request_due_at, 'not_required'
  )
  returning * into v_message;

  update public.buyer_rfq_negotiation_threads
  set status = v_next_status, last_message_at = now(),
      last_supplier_message_at = now(), updated_at = now()
  where id = v_thread.id;

  update public.buyer_rfq_inbound_email_receipts
  set message_id = v_message.id
  where id = v_receipt_id;

  perform private.rfqh3_log_event(
    v_thread.rfq_id, v_thread.supplier_id,
    v_thread.owner_user_id, v_thread.organization_id,
    'negotiation_supplier_message',
    jsonb_build_object(
      'thread_id', v_thread.id, 'message_id', v_message.id,
      'round_no', v_thread.round_no,
      'source', 'email', 'receipt_id', v_receipt_id
    ),
    null
  );

  return jsonb_build_object(
    'ok', true, 'duplicate', false,
    'thread_id', v_thread.id, 'message_id', v_message.id
  );
end;
$rfqc1$;

-- Narrow the invoker entry to the same server-to-RFQH3 DB-secret pattern.
-- The implementation function cannot be invoked from the exposed Data API
-- schema directly; no service-role key is sent to clients.
revoke all on function rfqh_secure.rfqc1_ingest_received_email_impl(
  text, text, uuid, uuid, text, boolean, text
) from public, anon, authenticated, service_role;
grant execute on function rfqh_secure.rfqc1_ingest_received_email_impl(
  text, text, uuid, uuid, text, boolean, text
) to anon;

create or replace function public.rfqc1_ingest_received_email(
  p_db_secret text,
  p_provider_event_id text,
  p_provider_email_id uuid,
  p_dispatch_id uuid,
  p_sender_email text,
  p_sender_authenticated boolean,
  p_body text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $rfqc1$
  select rfqh_secure.rfqc1_ingest_received_email_impl(
    p_db_secret, p_provider_event_id, p_provider_email_id,
    p_dispatch_id, p_sender_email, p_sender_authenticated, p_body
  );
$rfqc1$;

revoke all on function public.rfqc1_ingest_received_email(
  text, text, uuid, uuid, text, boolean, text
) from public, anon, authenticated, service_role;
grant execute on function public.rfqc1_ingest_received_email(
  text, text, uuid, uuid, text, boolean, text
) to anon;
