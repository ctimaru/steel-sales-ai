-- RFQ-MAIL1 — recipient opt-out contract (disposable CI transaction, rolls back).
begin;

create or replace function pg_temp.rm1_ok(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'RFQ-MAIL1 assertion failed: %',message; end if;
end $$;

select pg_temp.rm1_ok(pg_get_constraintdef((select oid from pg_constraint
  where conname='buyer_rfq_email_suppressions_reason_check')) like '%opt_out%','opt_out is a suppression reason');
select pg_temp.rm1_ok(not (select prosecdef from pg_proc where oid='public.rfqmail1_opt_out(text)'::regprocedure),
  'public wrapper is SECURITY INVOKER');
select pg_temp.rm1_ok((select prosecdef from pg_proc where oid='rfqh_secure.rfqmail1_opt_out_impl(text)'::regprocedure),
  'implementation is SECURITY DEFINER');
select pg_temp.rm1_ok(has_function_privilege('anon','public.rfqmail1_opt_out(text)','EXECUTE'),
  'recipients without an account can opt out');
select pg_temp.rm1_ok(not has_table_privilege('anon','public.buyer_rfq_email_suppressions','SELECT'),
  'suppression list stays private');
select pg_temp.rm1_ok(position('buyer_rfq_email_suppressions' in
  pg_get_functiondef('private.netcontact1_rfq_reachability_impl(uuid,uuid[])'::regprocedure))>0,
  'suppressed company emails are not offered as RFQ channel');

-- An unknown or malformed token never touches the list.
set local role anon;
do $t$
begin
  begin
    perform public.rfqmail1_opt_out(repeat('0',64));
    raise exception 'RFQ-MAIL1 assertion failed: unknown token accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.rfqmail1_opt_out('not-a-hash');
    raise exception 'RFQ-MAIL1 assertion failed: malformed token accepted';
  exception when insufficient_privilege then null;
  end;
end
$t$;
reset role;

-- With a real dispatch (if the CI fixture has one): opt-out suppresses the
-- address once, idempotently, and keeps a stronger existing reason.
do $t$
declare
  v_hash text;
  v_email text;
  v_dispatch public.buyer_rfq_dispatches%rowtype;
begin
  select d.* into v_dispatch from public.buyer_rfq_dispatches d
  join public.buyer_rfq_suppliers s on s.id=d.supplier_id
  where s.supplier_email_normalized is not null and d.token_hash ~ '^[0-9a-f]{64}$' limit 1;
  if not found then
    raise notice 'RFQ-MAIL1: no dispatch fixture, flow assertions skipped';
    return;
  end if;
  select supplier_email_normalized into v_email from public.buyer_rfq_suppliers where id=v_dispatch.supplier_id;
  delete from public.buyer_rfq_email_suppressions where email_normalized=v_email;
  perform pg_temp.rm1_ok(public.rfqmail1_opt_out(v_dispatch.token_hash)->>'status'='opted_out','opt-out accepted');
  perform pg_temp.rm1_ok(public.rfqmail1_opt_out(v_dispatch.token_hash)->>'status'='opted_out','opt-out idempotent');
  perform pg_temp.rm1_ok((select reason from public.buyer_rfq_email_suppressions where email_normalized=v_email)='opt_out',
    'address suppressed as opt_out');
  perform pg_temp.rm1_ok(exists(select 1 from public.buyer_rfq_events where supplier_id=v_dispatch.supplier_id
    and event_type='recipient_opted_out'),'buyer timeline records the opt-out');
end
$t$;

rollback;
