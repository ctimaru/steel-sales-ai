-- RFQH14.2: local Chrome browser fixtures, persisted ONLY inside throwaway GitHub Actions Supabase.
-- The host MUST be 127.0.0.1:54322. NEVER run this script on remote/staging/production.
\set ON_ERROR_STOP on
begin;

-- Target prices are deliberately present in buyer-only storage to detect accidental disclosure.
update public.buyer_distinta_lines
set target_eur_t=900,target_eur_m=22.5,target_total_eur=2700
where distinta_id='00000000-0000-0000-0000-000000023311'::uuid;
update public.buyer_distintas set target_total_eur=5400
where id='00000000-0000-0000-0000-000000023311'::uuid;

-- Use the normal business RPCs; no provider email and no direct synthetic dispatch INSERT.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'buyer_user_id',true);

select public.rfqh1_add_supplier(
 '00000000-0000-0000-0000-000000023321'::uuid,
 'DEMO Steel Manufacturing','rfqh14-producer@example.test',null,
 '00000000-0000-0000-0000-000000023302'::uuid
);
select public.rfqh1_add_supplier(
 '00000000-0000-0000-0000-000000023321'::uuid,
 'DEMO Tubes Trading','rfqh14-trader@example.test',null,
 '00000000-0000-0000-0000-000000023303'::uuid
);

select public.rfqh3_launch_campaign(
 '00000000-0000-0000-0000-000000023321'::uuid,
 now()+interval '14 days',
 'TEST LOCALE: non inviare messaggi o ordini',
 (
  select jsonb_agg(jsonb_build_object(
    'supplier_id',s.id,
    'dispatch_id',gen_random_uuid(),
    'token_hash',case when s.supplier_organization_id='00000000-0000-0000-0000-000000023302'::uuid
      then :'rfqh14_producer_hash' else :'rfqh14_trader_hash' end,
    'idempotency_key','rfqh14-local-only-'||s.id::text
  ) order by s.id)
  from public.buyer_rfq_suppliers s
  where s.rfq_id='00000000-0000-0000-0000-000000023321'::uuid
 )
);

reset role;

do $verify$
begin
 if (select count(*) from public.buyer_rfq_suppliers
     where rfq_id='00000000-0000-0000-0000-000000023321'::uuid)<>2
 then raise exception 'RFQH14.2 expected 2 distinct supplier targets'; end if;
 if (select count(*) from public.buyer_rfq_dispatches
     where rfq_id='00000000-0000-0000-0000-000000023321'::uuid and
       status='queued' and provider_message_id is null)<>2
 then raise exception 'RFQH14.2 must seed 2 queued LOCAL dispatches and no outbound provider activity'; end if;
 if (select count(*) from public.buyer_rfq_dispatch_messages
     where rfq_id='00000000-0000-0000-0000-000000023321'::uuid)<>0
 then raise exception 'RFQH14.2 must not send emails'; end if;
 if (select count(*) from public.buyer_distinta_lines where
     distinta_id='00000000-0000-0000-0000-000000023311'::uuid and target_eur_t=900)<>2
 then raise exception 'RFQH14.2 expected buyer private target per line'; end if;
end $verify$;
commit;
select 'RFQH14.2 local-only supplier portals ready; 2 queued, no provider sends' as result;
