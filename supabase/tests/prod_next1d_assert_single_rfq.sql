-- PROD-NEXT1.D: read-only SQL proof from ONE browser-created Distinta through PO.
-- Ephemeral localhost 127.0.0.1:54322 only, after both Chrome stages.
\set ON_ERROR_STOP on
begin transaction read only;
select set_config('prod_next1d.rfq_id',(
  select id::text from public.buyer_rfq_campaigns
  where title='BD15 E2E LOCAL 1440'
),true);
select set_config('prod_next1d.buyer_uid',:'buyer_user_id',true);
select set_config('prod_next1d.approver_uid',:'buyerViewer_user_id',true);
do $verify$
declare
  v_rfq uuid:=current_setting('prod_next1d.rfq_id')::uuid;
  v_distinta uuid;
begin
  select source_distinta_id into v_distinta from public.buyer_rfq_campaigns where id=v_rfq;
  if v_distinta is null or (select count(*) from public.buyer_rfq_campaigns where id=v_rfq)<>1
    then raise exception 'Single-RFQ missing original BD15 browser-created campaign'; end if;
  if (select count(*) from public.buyer_distinta_lines where distinta_id=v_distinta)<>2
    then raise exception 'Single-RFQ original bill is not two lines'; end if;
  if (select count(distinct standard_code) from public.buyer_distinta_lines
      where distinta_id=v_distinta and standard_code in ('EN 10219','EN 10210'))<>2
    then raise exception 'Single-RFQ original EN norm lines changed'; end if;
  if (select count(*) from public.buyer_rfq_suppliers where rfq_id=v_rfq)<>2
    then raise exception 'Single-RFQ original two suppliers not retained'; end if;
  if (select count(*) from public.buyer_rfq_quotes
      where rfq_id=v_rfq and status='submitted')<>1
    then raise exception 'Single-RFQ must have one submitted offer'; end if;
  if (select array_agg(l.unit_price order by l.line_position)
      from public.buyer_rfq_quotes q
      join public.buyer_rfq_quote_lines l on l.quote_id=q.id
      where q.rfq_id=v_rfq and q.status='submitted')
      is distinct from array[735::numeric,755::numeric]
    then raise exception 'Single-RFQ prices changed or were not saved (expected 735,755)'; end if;
  if (select count(*) from public.buyer_rfq_quotes q
      join public.buyer_rfq_quote_lines l on l.quote_id=q.id
      where q.rfq_id=v_rfq and q.status='submitted'
        and l.normalized_eur_t>0 and l.normalized_eur_m>0)<>2
    then raise exception 'Single-RFQ supplier normalized prices invalid'; end if;
  if (select count(*) from public.buyer_procurement_approvals
      where rfq_id=v_rfq and action_type='po_issue'
        and status='consumed'
        and requested_by=current_setting('prod_next1d.buyer_uid')::uuid
        and decided_by=current_setting('prod_next1d.approver_uid')::uuid)<>1
    then raise exception 'Single-RFQ requires separate-person PO approval consumed'; end if;
  if (select count(*) from public.buyer_purchase_order_versions
      where rfq_id=v_rfq and version_no=1
        and length(snapshot_sha256)=64 and provider_message_id is null)<>1
    then raise exception 'Single-RFQ expected immutable unsent PO version v1'; end if;
  if (select count(*) from public.buyer_purchase_order_supplier_responses
      where rfq_id=v_rfq and decision='confirmed'
        and supplier_reference='NEXT1D-LOCAL-ONLY')<>1
    then raise exception 'Single-RFQ supplier has not confirmed this PO'; end if;
  if (select count(*) from public.buyer_purchase_order_drafts
      where rfq_id=v_rfq and status='supplier_confirmed')<>1
    then raise exception 'Single-RFQ buyer PO not confirmed'; end if;
  if (select count(*) from public.buyer_rfq_dispatch_messages where rfq_id=v_rfq)<>0
    then raise exception 'Single-RFQ outbound RFQ provider messages forbidden'; end if;
  if (select count(*) from public.buyer_purchase_order_versions
      where rfq_id=v_rfq and provider_message_id is not null)<>0
    then raise exception 'Single-RFQ outbound PO provider messages forbidden'; end if;
end $verify$;
select 'PROD-NEXT1.D SINGLE-RFQ PASS: one BD15 Distinta->RFQ->735/755 quote->approved PO v1->supplier confirmation; zero outbound sends' as result;
rollback;
