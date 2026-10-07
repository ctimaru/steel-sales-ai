create index if not exists buyer_supplier_profiles_organization_idx
  on public.buyer_supplier_profiles(organization_id);

create index if not exists buyer_supplier_profiles_supplier_organization_idx
  on public.buyer_supplier_profiles(supplier_organization_id)
  where supplier_organization_id is not null;

create index if not exists buyer_supplier_profiles_supplier_contact_idx
  on public.buyer_supplier_profiles(supplier_contact_id)
  where supplier_contact_id is not null;

create index if not exists buyer_supplier_profiles_supplier_network_contact_idx
  on public.buyer_supplier_profiles(supplier_network_contact_id)
  where supplier_network_contact_id is not null;

create index if not exists buyer_supplier_profiles_last_rfq_idx
  on public.buyer_supplier_profiles(last_rfq_id)
  where last_rfq_id is not null;

notify pgrst,'reload schema';