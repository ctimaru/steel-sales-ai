-- RFQC1.EMAIL1.E — read-only server-side dispatch correlation for inbound email.
-- Development ONLY. Depends on EMAIL1.D atomic ledger (PR #1183).
-- This RPC never appends messages; EMAIL1.D ingest re-validates all fields.
create or replace function rfqh_secure.rfqc1_received_dispatch_context_impl(
  p_db_secret text, p_dispatch_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $rfqc1$
declare
  v_expected_hash text;
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
begin
  select webhook_db_secret_sha256 into v_expected_hash
    from private.rfqh3_config where singleton = true;
  if v_expected_hash is null
    or encode(extensions.digest(coalesce(p_db_secret,''),'sha256'),'hex') <> v_expected_hash
  then
    raise exception 'Invalid webhook database secret' using errcode='42501';
  end if;
  if p_dispatch_id is null then return jsonb_build_object('valid',false); end if;

  select * into v_dispatch from public.buyer_rfq_dispatches d
  where d.id = p_dispatch_id
    and d.provider = 'resend'
    and d.status not in ('queued','sending','cancelled','failed',
                         'bounced','complained','declined');
  if not found then return jsonb_build_object('valid',false); end if;

  select * into v_campaign from public.buyer_rfq_campaigns c
  where c.id = v_dispatch.rfq_id
    and c.organization_id = v_dispatch.organization_id
    and c.owner_user_id = v_dispatch.owner_user_id
    and c.status in ('launched','collecting');
  if not found then return jsonb_build_object('valid',false); end if;

  select * into v_supplier from public.buyer_rfq_suppliers s
  where s.id = v_dispatch.supplier_id
    and s.rfq_id = v_dispatch.rfq_id
    and s.owner_user_id = v_dispatch.owner_user_id
    and s.supplier_email_normalized is not null
    and s.delivery_channel in ('email','both')
    and s.status not in ('draft','queued','cancelled','failed',
                         'bounced','complained','declined','awarded','not_awarded');
  if not found then return jsonb_build_object('valid',false); end if;

  return jsonb_build_object(
    'valid',true,
    'rfqId',v_dispatch.rfq_id,
    'dispatchId',v_dispatch.id,
    'supplierId',v_supplier.id,
    'supplierEmail',v_supplier.supplier_email_normalized
  );
end;
$rfqc1$;

revoke all on function rfqh_secure.rfqc1_received_dispatch_context_impl(text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function rfqh_secure.rfqc1_received_dispatch_context_impl(text,uuid)
  to anon;

create or replace function public.rfqc1_received_dispatch_context(
  p_db_secret text, p_dispatch_id uuid
)
returns jsonb
language sql security invoker
set search_path = ''
as $rfqc1$
  select rfqh_secure.rfqc1_received_dispatch_context_impl(p_db_secret,p_dispatch_id);
$rfqc1$;

revoke all on function public.rfqc1_received_dispatch_context(text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.rfqc1_received_dispatch_context(text,uuid)
  to anon;
