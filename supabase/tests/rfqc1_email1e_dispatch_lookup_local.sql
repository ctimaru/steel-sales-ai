-- RFQC1.EMAIL1.E isolated local SQL acceptance, AFTER DEMOTEST23/RFQH14.2.
-- Uses a transient synthetic webhook key, no real email and no durable writes.
\set ON_ERROR_STOP on
begin;
do $email1e$
declare
  v_rfq uuid := '00000000-0000-0000-0000-000000023321'::uuid;
  v_dispatch_a uuid;
  v_dispatch_b uuid;
  v_supplier_a uuid;
  v_supplier_b uuid;
  v_good_a jsonb;
  v_good_b jsonb;
  v_denied jsonb;
  v_key text := 'synthetic-only-email1e-2026-11-06-database';
begin
  if not exists (
    select 1 from public.organizations
    where id='00000000-0000-0000-0000-000000023301'::uuid
      and slug='dt23-buyer'
  ) or not exists (
    select 1 from public.buyer_rfq_campaigns
    where id=v_rfq and status in ('launched','collecting')
      and title='DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219'
  ) then
    raise exception 'EMAIL1.E tests must use disposable DEMOTEST23/RFQH14.2 fixture only';
  end if;
  select d.id,s.id into strict v_dispatch_a,v_supplier_a
    from public.buyer_rfq_dispatches d
    join public.buyer_rfq_suppliers s on s.id=d.supplier_id
    where d.rfq_id=v_rfq
      and s.supplier_email_normalized='rfqh14-producer@example.test';
  select d.id,s.id into strict v_dispatch_b,v_supplier_b
    from public.buyer_rfq_dispatches d
    join public.buyer_rfq_suppliers s on s.id=d.supplier_id
    where d.rfq_id=v_rfq
      and s.supplier_email_normalized='rfqh14-trader@example.test';
  update public.buyer_rfq_dispatches set status='sent'
    where id in (v_dispatch_a,v_dispatch_b) and status in ('queued','sending');
  update public.buyer_rfq_suppliers set status='sent'
    where id in (v_supplier_a,v_supplier_b) and status in ('queued','draft');
  update private.rfqh3_config
    set webhook_db_secret_sha256=encode(extensions.digest(v_key,'sha256'),'hex')
    where singleton=true;
  if not found then raise exception 'EMAIL1.E local webhook key unavailable'; end if;

  v_good_a:=public.rfqc1_received_dispatch_context(v_key,v_dispatch_a);
  v_good_b:=public.rfqc1_received_dispatch_context(v_key,v_dispatch_b);
  if coalesce((v_good_a->>'valid')::boolean,false)<>true
    or coalesce((v_good_b->>'valid')::boolean,false)<>true
    or v_good_a->>'rfqId'<>v_rfq::text
    or v_good_a->>'supplierId'<>v_supplier_a::text
    or v_good_a->>'dispatchId'<>v_dispatch_a::text
    or v_good_a->>'supplierEmail'<>'rfqh14-producer@example.test'
    or v_good_b->>'supplierId'<>v_supplier_b::text
    or v_good_b->>'supplierEmail'<>'rfqh14-trader@example.test'
  then raise exception 'EMAIL1.E lookup failed or crossed tenant/supplier'; end if;
  if v_good_a->>'supplierId'=v_good_b->>'supplierId' then
    raise exception 'EMAIL1.E cross-supplier lookup leaked same identity'; end if;

  -- Arbitrary dispatch ID or cancelled dispatch MUST return no private data.
  v_denied:=public.rfqc1_received_dispatch_context(
    v_key,'55555555-5555-4555-8555-555555551234'::uuid
  );
  if v_denied->>'valid'<>'false' then
    raise exception 'EMAIL1.E unknown dispatch accepted'; end if;
  update public.buyer_rfq_dispatches set status='cancelled'
    where id=v_dispatch_a;
  v_denied:=public.rfqc1_received_dispatch_context(v_key,v_dispatch_a);
  if v_denied->>'valid'<>'false' then
    raise exception 'EMAIL1.E cancelled dispatch accepted'; end if;

  -- Credential gate: even a real dispatch cannot be enumerated without key.
  begin
    perform public.rfqc1_received_dispatch_context('invalid',v_dispatch_b);
    raise exception 'EMAIL1.E lookup accepted wrong webhook credential';
  exception when insufficient_privilege then null;
  end;
end;
$email1e$;
rollback;
select 'RFQC1.EMAIL1.E local-only dispatch lookup, isolation, revoked dispatch, invalid credential: PASS' as result;
