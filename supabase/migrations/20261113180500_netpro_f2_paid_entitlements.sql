-- NET-PRO-CATALOG1.F.2 — Provider-confirmed paid periods, atomic entitlement unlock.
-- This function is callable by service_role ONLY. The browser cannot grant access.
-- Payment validation (signed Stripe webhook + fresh Stripe API readback) happens
-- in the Next.js server before these protected transactional writes.

create or replace function public.netpro_f2_apply_paid_period(
 p_intent_id uuid,p_session_id text,p_subscription_id text,p_customer_id text,
 p_price_id text,p_invoice_id text,p_paid_until timestamptz
)
returns jsonb
language plpgsql volatile security invoker set search_path=''
as $$
declare
 v public.network_pro_checkout_intents%rowtype;
 v_module text;
 v_event_key text;
 v_total integer:=0;
begin
 if coalesce((select auth.role()),'')<>'service_role' then
   raise exception 'Billing service authority required' using errcode='42501';
 end if;
 if p_session_id !~ '^cs_[A-Za-z0-9_]+$'
    or p_subscription_id !~ '^sub_[A-Za-z0-9_]+$'
    or p_customer_id !~ '^cus_[A-Za-z0-9_]+$'
    or p_invoice_id !~ '^in_[A-Za-z0-9_]+$'
    or p_price_id !~ '^price_[A-Za-z0-9]+$'
    or p_paid_until<=now()
    or p_paid_until>now()+interval '370 days' then
   raise exception 'Invalid paid period' using errcode='22023';
 end if;
 select * into v from public.network_pro_checkout_intents
  where id=p_intent_id for update;
 if not found or v.status not in ('pending','paid') or
    v.stripe_checkout_session_id is distinct from p_session_id or
    v.stripe_price_id is distinct from p_price_id or
    (v.stripe_subscription_id is not null and v.stripe_subscription_id<>p_subscription_id) or
    (v.stripe_customer_id is not null and v.stripe_customer_id<>p_customer_id) then
   raise exception 'Checkout/subscription binding not accepted' using errcode='42501';
 end if;
 if v.paid_until is not null and p_paid_until<=v.paid_until then
   return jsonb_build_object('status','already_recorded','contract','netpro-f2-v1');
 end if;

 -- Updating the row and all module entitlements happens in one transaction.
 update public.network_pro_checkout_intents set
   stripe_subscription_id=p_subscription_id,stripe_customer_id=p_customer_id,
   paid_until=p_paid_until,last_paid_invoice_id=p_invoice_id,
   status='paid',updated_at=now()
 where id=v.id;

 foreach v_module in array v.module_keys loop
   v_event_key:='netpro-f2:'||p_invoice_id||':'||v_module;
   insert into public.organization_product_entitlement_events(
      organization_id,product_key,event_type,source_kind,source_reference,
      idempotency_key,effective_at,expires_at,actor_user_id,actor_authority_type,metadata
   ) values (
      v.organization_id,'network_pro_'||v_module||'_'||lower(v.territory),
      'granted','subscription',p_invoice_id,v_event_key,
      now(),p_paid_until,null,'service',
      jsonb_build_object('contract','netpro-f2-v1','intent_id',v.id,
        'subscription_id',p_subscription_id,'territory',v.territory,'module',v_module)
   ) on conflict (idempotency_key) do nothing;
   v_total:=v_total+1;
 end loop;
 return jsonb_build_object('status','active','contract','netpro-f2-v1',
   'modules',v_total,'paid_until',p_paid_until);
end;
$$;
revoke all on function public.netpro_f2_apply_paid_period(uuid,text,text,text,text,text,timestamptz)
 from public,anon,authenticated;
grant execute on function public.netpro_f2_apply_paid_period(uuid,text,text,text,text,text,timestamptz)
 to service_role;

-- On a verified end-of-service event, revoke only this subscription's modules.
-- A delayed or duplicated invoice.paid cannot re-grant after status is canceled.
create or replace function public.netpro_f2_end_subscription(
 p_subscription_id text,p_customer_id text,p_event_id text
)
returns jsonb
language plpgsql volatile security invoker set search_path=''
as $$
declare
 v public.network_pro_checkout_intents%rowtype;
 v_module text;
begin
 if coalesce((select auth.role()),'')<>'service_role' then
   raise exception 'Billing service authority required' using errcode='42501';
 end if;
 if p_subscription_id !~ '^sub_[A-Za-z0-9_]+$'
    or p_customer_id !~ '^cus_[A-Za-z0-9_]+$'
    or p_event_id !~ '^evt_[A-Za-z0-9_]+$' then
   raise exception 'Invalid subscription end' using errcode='22023';
 end if;
 select * into v from public.network_pro_checkout_intents
   where stripe_subscription_id=p_subscription_id and
   stripe_customer_id=p_customer_id for update;
 if not found then
   return jsonb_build_object('status','not_found');
 end if;
 if v.status in ('expired','canceled') then
   return jsonb_build_object('status','already_ended');
 end if;
 if v.status<>'paid' then
   update public.network_pro_checkout_intents
      set status='canceled',updated_at=now() where id=v.id;
   return jsonb_build_object('status','canceled_no_grants');
 end if;
 update public.network_pro_checkout_intents
    set status='canceled',updated_at=now() where id=v.id;
 foreach v_module in array v.module_keys loop
   insert into public.organization_product_entitlement_events(
     organization_id,product_key,event_type,source_kind,source_reference,
     idempotency_key,effective_at,expires_at,actor_user_id,actor_authority_type,metadata
   ) values (
     v.organization_id,'network_pro_'||v_module||'_'||lower(v.territory),
     'revoked','subscription',p_subscription_id,
     'netpro-f2-revoke:'||p_event_id||':'||v_module,now(),null,null,'service',
     jsonb_build_object('contract','netpro-f2-v1','reason','subscription_ended','intent_id',v.id)
   ) on conflict(idempotency_key) do nothing;
 end loop;
 return jsonb_build_object('status','revoked');
end;
$$;
revoke all on function public.netpro_f2_end_subscription(text,text,text)
 from public,anon,authenticated;
grant execute on function public.netpro_f2_end_subscription(text,text,text)
 to service_role;

-- Expired pending Checkout sessions are released for a new attempt. An authenticated
-- browser cannot update their status or create replacement subscriptions.
create or replace function public.netpro_f2_expire_checkout(
 p_session_id text
)
returns jsonb
language plpgsql volatile security invoker set search_path=''
as $$
begin
 if coalesce((select auth.role()),'')<>'service_role' then
   raise exception 'Billing service authority required' using errcode='42501';
 end if;
 update public.network_pro_checkout_intents
   set status='expired',updated_at=now()
 where stripe_checkout_session_id=p_session_id and status='pending';
 return jsonb_build_object('status','processed');
end;
$$;
revoke all on function public.netpro_f2_expire_checkout(text) from public,anon,authenticated;
grant execute on function public.netpro_f2_expire_checkout(text) to service_role;
