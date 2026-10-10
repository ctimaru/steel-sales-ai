-- RFQH14.2b: read-only final assertions on ephemeral localhost database.
-- NEVER against remote Supabase; workflow pins 127.0.0.1:54322.
\set ON_ERROR_STOP on
begin transaction read only;
do $verify$
begin
  if (select count(*) from public.buyer_purchase_order_versions
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid
        and version_no=1
        and length(snapshot_sha256)=64
        and provider_message_id is null)<>1
    then raise exception 'RFQH14.2b expected exactly one immutable PO v1 without provider message'; end if;
  if (select count(*) from public.buyer_procurement_approvals
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid
        and action_type='po_issue'
        and status='consumed'
        and requested_by=:'buyer_user_id'::uuid
        and decided_by=:'buyerViewer_user_id'::uuid
        and consumed_at is not null)<>1
    then raise exception 'RFQH14.2b requires a distinct second-person UI approval consumed by PO issuance'; end if;
  if (select count(*) from public.buyer_procurement_approvals
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid
        and action_type='po_issue')<>1
    then raise exception 'RFQH14.2b approval retry created duplicate records'; end if;
  if (select count(*) from public.buyer_purchase_order_supplier_responses
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid
        and decision='confirmed'
        and supplier_reference='RFQH14-LOCAL-ONLY')<>1
    then raise exception 'RFQH14.2b requires exactly one browser supplier confirmation'; end if;
  if (select count(*) from public.buyer_purchase_order_drafts
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid
        and status='supplier_confirmed')<>1
    then raise exception 'RFQH14.2b buyer PO does not reflect supplier confirmation'; end if;
  if (select count(*) from public.buyer_rfq_dispatch_messages
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid)<>0
    then raise exception 'RFQH14.2b unexpectedly sent an RFQ provider message'; end if;
  if (select count(*) from public.buyer_purchase_order_versions
      where rfq_id='00000000-0000-0000-0000-000000023321'::uuid
        and provider_message_id is not null)<>0
    then raise exception 'RFQH14.2b unexpectedly sent a PO provider message'; end if;
end $verify$;
select 'RFQH14.2b PASS: independent browser approval consumed, immutable PO v1, one supplier confirmation, zero provider messages' as result;
rollback;
