-- RFQC1.EMAIL1.D local-only integration: full atomic supplier reply, idempotency,
-- supplier isolation, auth/sender refusal, event collision and rate cap.
-- Run ONLY in throwaway Supabase at localhost:54322, AFTER the DEMOTEST23 /
-- RFQH14.2 synthetic Chrome seed & quotation tests. No provider calls.
-- Entire test is rolled back, including the temporary fake webhook secret.
\set ON_ERROR_STOP on
begin;

do $email1d$
declare
  v_rfq uuid := '00000000-0000-0000-0000-000000023321'::uuid;
  v_a_supplier uuid;
  v_a_dispatch uuid;
  v_b_supplier uuid;
  v_b_dispatch uuid;
  v_first jsonb;
  v_replay jsonb;
  v_b jsonb;
  v_first_message uuid;
  v_a_before integer;
  v_b_before integer;
  v_quote_before integer;
  v_n integer;
  v_fake_secret text := 'local-only-rfqc1-email1d-test-key-2026';
  v_id_a uuid := '55555555-5555-4555-8555-555555550001'::uuid;
  v_id_b uuid := '55555555-5555-4555-8555-555555550002'::uuid;
  v_id_other uuid := '55555555-5555-4555-8555-555555550003'::uuid;
begin
  -- Guard against accidental use on any non-fixture database.
  if not exists (
    select 1 from public.organizations
    where id = '00000000-0000-0000-0000-000000023301'::uuid
      and slug = 'dt23-buyer'
  ) or not exists (
    select 1 from public.buyer_rfq_campaigns c
    where c.id = v_rfq
      and c.title = 'DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219'
      and c.status in ('launched','collecting')
  ) then
    raise exception 'EMAIL1.D requires CI-only DEMOTEST23 fixture';
  end if;

  select s.id, d.id into strict v_a_supplier, v_a_dispatch
  from public.buyer_rfq_suppliers s
  join public.buyer_rfq_dispatches d on d.supplier_id = s.id
  where s.rfq_id = v_rfq
    and s.supplier_email_normalized = 'rfqh14-producer@example.test';
  select s.id, d.id into strict v_b_supplier, v_b_dispatch
  from public.buyer_rfq_suppliers s
  join public.buyer_rfq_dispatches d on d.supplier_id = s.id
  where s.rfq_id = v_rfq
    and s.supplier_email_normalized = 'rfqh14-trader@example.test';

  -- Synthetic browser fixtures can still be queued; mark as sent ONLY inside
  -- this rollback transaction. No Resend API and no outbound notifications.
  update public.buyer_rfq_dispatches
    set status='sent' where id in (v_a_dispatch, v_b_dispatch)
      and status in ('queued','sending');
  update public.buyer_rfq_suppliers
    set status='sent' where id in (v_a_supplier, v_b_supplier)
      and status in ('draft','queued');

  update private.rfqh3_config
  set webhook_db_secret_sha256 =
    encode(extensions.digest(v_fake_secret, 'sha256'), 'hex')
  where singleton = true;
  if not found then
    raise exception 'EMAIL1.D local webhook config absent';
  end if;

  select count(*) into v_a_before
  from public.buyer_rfq_negotiation_messages
  where rfq_id = v_rfq and supplier_id = v_a_supplier;
  select count(*) into v_b_before
  from public.buyer_rfq_negotiation_messages
  where rfq_id = v_rfq and supplier_id = v_b_supplier;
  select count(*) into v_quote_before
  from public.buyer_rfq_quotes where rfq_id = v_rfq;

  -- Email From and signed alias are NOT proof of authentication.
  begin
    perform public.rfqc1_ingest_received_email(
      v_fake_secret, 'email1d-unverified', v_id_a, v_a_dispatch,
      'rfqh14-producer@example.test', false, 'Fake mail'
    );
    raise exception 'EMAIL1.D accepted an unauthenticated sender';
  exception when insufficient_privilege then null;
  end;

  -- A different supplier address cannot send to A's private RFQ.
  begin
    perform public.rfqc1_ingest_received_email(
      v_fake_secret, 'email1d-spoofed', v_id_a, v_a_dispatch,
      'rfqh14-trader@example.test', true, 'Spoofed mail'
    );
    raise exception 'EMAIL1.D accepted a different supplier';
  exception when insufficient_privilege then null;
  end;

  -- Invalid DB secret fails even when every other datum is syntactically valid.
  begin
    perform public.rfqc1_ingest_received_email(
      'incorrect-secret', 'email1d-badsecret', v_id_a, v_a_dispatch,
      'rfqh14-producer@example.test', true, 'Fake mail'
    );
    raise exception 'EMAIL1.D accepted wrong DB secret';
  exception when insufficient_privilege then null;
  end;

  if exists (select 1 from public.buyer_rfq_inbound_email_receipts
      where provider_email_id = v_id_a) then
    raise exception 'EMAIL1.D rejected inputs created a receipt';
  end if;

  -- One valid synthetic email creates one supplier message and one receipt.
  v_first := public.rfqc1_ingest_received_email(
    v_fake_secret, 'email1d-event-a', v_id_a, v_a_dispatch,
    'rfqh14-producer@example.test', true,
    'EMAIL1.D TEST — 780 €/t is unstructured plain text'
  );
  if v_first->>'ok' <> 'true' or v_first->>'duplicate' <> 'false' then
    raise exception 'EMAIL1.D first insert not accepted';
  end if;
  v_first_message := (v_first->>'message_id')::uuid;
  if not exists (
    select 1 from public.buyer_rfq_inbound_email_receipts r
    join public.buyer_rfq_negotiation_messages m on m.id = r.message_id
    where r.provider_email_id = v_id_a
      and r.dispatch_id = v_a_dispatch
      and r.supplier_id = v_a_supplier
      and m.supplier_id = v_a_supplier
      and m.sender_role = 'supplier' and m.message_type = 'message'
      and m.id = v_first_message
  ) then
    raise exception 'EMAIL1.D receipt and RFQH6 message not linked';
  end if;

  -- Another webhook-event ID for the SAME provider email must be a no-op.
  v_replay := public.rfqc1_ingest_received_email(
    v_fake_secret, 'email1d-event-a-retry', v_id_a, v_a_dispatch,
    'rfqh14-producer@example.test', true, 'Changed replay body'
  );
  if v_replay->>'duplicate' <> 'true' then
    raise exception 'EMAIL1.D replay was not deduplicated';
  end if;

  -- Reusing an event ID for a DIFFERENT provider email must fail atomically.
  begin
    perform public.rfqc1_ingest_received_email(
      v_fake_secret, 'email1d-event-a', v_id_other, v_a_dispatch,
      'rfqh14-producer@example.test', true, 'Event ID collision'
    );
    raise exception 'EMAIL1.D reused event id accepted';
  exception when unique_violation then null;
  end;

  select count(*) into v_n
  from public.buyer_rfq_negotiation_messages
  where rfq_id = v_rfq and supplier_id = v_a_supplier;
  if v_n <> v_a_before + 1 then
    raise exception 'EMAIL1.D replay or rejected input created duplicate A message';
  end if;

  -- Other supplier: different dispatch, same RFQ, truly isolated thread.
  v_b := public.rfqc1_ingest_received_email(
    v_fake_secret, 'email1d-event-b', v_id_b, v_b_dispatch,
    'rfqh14-trader@example.test', true, 'EMAIL1.D TRADER independent reply'
  );
  if v_b->>'ok' <> 'true' or v_b->>'duplicate' <> 'false'
    or v_b->>'thread_id' = v_first->>'thread_id' then
    raise exception 'EMAIL1.D supplier thread isolation failed';
  end if;
  select count(*) into v_n
  from public.buyer_rfq_negotiation_messages
  where rfq_id = v_rfq and supplier_id = v_b_supplier;
  if v_n <> v_b_before + 1 then
    raise exception 'EMAIL1.D unexpected messages in B thread';
  end if;
  if (select count(*) from public.buyer_rfq_quotes where rfq_id = v_rfq)
    <> v_quote_before then
    raise exception 'EMAIL1.D plain email must never change structured quotes';
  end if;

  -- New mail after the per-supplier hourly quota must be rejected;
  -- no receipt may survive a rejected insert.
  insert into public.buyer_rfq_negotiation_messages(
    thread_id, rfq_id, supplier_id, owner_user_id, organization_id,
    sender_role, message_type, round_no, body, notification_status
  )
  select t.id, t.rfq_id, t.supplier_id, t.owner_user_id, t.organization_id,
         'supplier', 'message', t.round_no, 'Local quota probe', 'not_required'
  from public.buyer_rfq_negotiation_threads t
  cross join generate_series(1, 10) n
  where t.dispatch_id = v_a_dispatch;

  begin
    perform public.rfqc1_ingest_received_email(
      v_fake_secret, 'email1d-quota', v_id_other, v_a_dispatch,
      'rfqh14-producer@example.test', true, 'Over quota'
    );
    raise exception 'EMAIL1.D exceeded hourly quota';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.buyer_rfq_inbound_email_receipts
      where provider_email_id = v_id_other) then
    raise exception 'EMAIL1.D quota rejection committed a receipt';
  end if;
end;
$email1d$;

rollback;

select 'RFQC1.EMAIL1.D local-only atomic receipts: supplier A/B, dedupe, spoof reject, quota, no quotes, rollback — PASS' as result;
