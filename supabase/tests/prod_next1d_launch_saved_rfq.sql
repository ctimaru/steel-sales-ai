-- PROD-NEXT1.D: launch exactly the RFQ created by BD15's 1440px real Chrome flow.
-- ONLY 127.0.0.1:54322 in disposable GitHub Actions PostgreSQL. Never remote.
\set ON_ERROR_STOP on
begin;
do $guard$
declare
  v_rfq uuid;
  v_distinta uuid;
  v_bad int;
begin
  if (select count(*) from public.buyer_rfq_campaigns
      where title='BD15 E2E LOCAL 1440')<>1
    then raise exception 'Single-RFQ: expected exactly one browser-created BD15 1440 campaign'; end if;
  select id,source_distinta_id into v_rfq,v_distinta
    from public.buyer_rfq_campaigns where title='BD15 E2E LOCAL 1440';
  if v_distinta is null then
    raise exception 'Single-RFQ must originate from persisted buyer Distinta'; end if;
  if (select count(*) from public.buyer_distinta_lines
      where distinta_id=v_distinta)<>2 then
    raise exception 'Single-RFQ requires exactly two actual BD15 lines'; end if;
  if (select count(distinct standard_code) from public.buyer_distinta_lines
      where distinta_id=v_distinta
        and standard_code in ('EN 10219','EN 10210'))<>2 then
    raise exception 'Single-RFQ mixed norms missing'; end if;
  if (select count(*) from public.buyer_rfq_suppliers where rfq_id=v_rfq)<>2
    then raise exception 'Single-RFQ must retain 2 suppliers picked in BD15 Chrome'; end if;
  if (select count(*) from public.buyer_rfq_suppliers
      where rfq_id=v_rfq and supplier_organization_id in
       ('00000000-0000-0000-0000-000000023302'::uuid,
        '00000000-0000-0000-0000-000000023303'::uuid))<>2
    then raise exception 'Single-RFQ supplier identities differ from UI selection'; end if;
  if (select count(*) from public.buyer_rfq_dispatches where rfq_id=v_rfq)<>0
    then raise exception 'Single-RFQ unexpected preexisting dispatch'; end if;
  if (select count(*) from public.buyer_rfq_dispatch_messages where rfq_id=v_rfq)<>0
    then raise exception 'Single-RFQ must never send provider email'; end if;
end $guard$;

select id as next1d_rfq_id,source_distinta_id as next1d_distinta_id
  from public.buyer_rfq_campaigns where title='BD15 E2E LOCAL 1440'
\gset

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'buyer_user_id',true);

-- Application's existing business RPC; the dispatch rows remain LOCAL queued,
-- with random hashes. No email provider configured and no SMTP invoked.
select public.rfqh3_launch_campaign(
  :'next1d_rfq_id'::uuid,
  now()+interval '14 days',
  'TEST LOCALE PROD-NEXT1.D — nessun messaggio esterno',
  (
    select jsonb_agg(jsonb_build_object(
      'supplier_id',s.id,
      'dispatch_id',gen_random_uuid(),
      'token_hash',case
        when s.supplier_organization_id='00000000-0000-0000-0000-000000023302'::uuid
          then :'next1d_producer_hash'
        when s.supplier_organization_id='00000000-0000-0000-0000-000000023303'::uuid
          then :'next1d_trader_hash' end,
      'idempotency_key','prod-next1d-local-'||s.id::text
    ) order by s.id)
    from public.buyer_rfq_suppliers s where s.rfq_id=:'next1d_rfq_id'::uuid
  )
);
reset role;

do $verify$
declare v_id uuid := :'next1d_rfq_id'::uuid;
begin
  if (select count(*) from public.buyer_rfq_dispatches
      where rfq_id=v_id and status='queued' and provider_message_id is null)<>2
    then raise exception 'Single-RFQ expected two local queued supplier capabilities'; end if;
  if (select count(*) from public.buyer_rfq_dispatch_messages where rfq_id=v_id)<>0
    then raise exception 'Single-RFQ external dispatch must stay zero'; end if;
end $verify$;
commit;
select 'PROD-NEXT1.D PASS: same browser-created RFQ launched only inside local Supabase' as result;
