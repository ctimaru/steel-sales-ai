create index if not exists buyer_rfq_campaigns_marketplace_request_idx
  on public.buyer_rfq_campaigns(marketplace_request_id)
  where marketplace_request_id is not null;

create index if not exists buyer_rfq_campaigns_organization_idx
  on public.buyer_rfq_campaigns(organization_id);

create index if not exists buyer_rfq_campaigns_source_distinta_idx
  on public.buyer_rfq_campaigns(source_distinta_id);

create index if not exists buyer_rfq_events_actor_user_idx
  on public.buyer_rfq_events(actor_user_id)
  where actor_user_id is not null;

create index if not exists buyer_rfq_events_organization_idx
  on public.buyer_rfq_events(organization_id);

create index if not exists buyer_rfq_events_owner_user_idx
  on public.buyer_rfq_events(owner_user_id);

create index if not exists buyer_rfq_events_supplier_idx
  on public.buyer_rfq_events(supplier_id)
  where supplier_id is not null;

create index if not exists buyer_rfq_suppliers_owner_user_idx
  on public.buyer_rfq_suppliers(owner_user_id);

create index if not exists buyer_rfq_suppliers_network_company_idx
  on public.buyer_rfq_suppliers(supplier_network_company_id)
  where supplier_network_company_id is not null;

create index if not exists buyer_rfq_suppliers_organization_idx
  on public.buyer_rfq_suppliers(supplier_organization_id)
  where supplier_organization_id is not null;
