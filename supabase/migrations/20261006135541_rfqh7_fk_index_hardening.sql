create index if not exists buyer_rfq_award_allocations_rfq_line_idx
  on public.buyer_rfq_award_allocations(rfq_line_id);

create index if not exists buyer_purchase_order_drafts_supplier_company_idx
  on public.buyer_purchase_order_drafts(supplier_company_id)
  where supplier_company_id is not null;

create index if not exists buyer_purchase_order_drafts_supplier_network_company_idx
  on public.buyer_purchase_order_drafts(supplier_network_company_id)
  where supplier_network_company_id is not null;

create index if not exists buyer_purchase_order_drafts_supplier_organization_idx
  on public.buyer_purchase_order_drafts(supplier_organization_id)
  where supplier_organization_id is not null;
