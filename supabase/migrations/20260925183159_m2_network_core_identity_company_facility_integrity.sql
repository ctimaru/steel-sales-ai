alter table public.network_facilities
  add constraint network_facilities_id_company_unique
  unique (id, company_id);

alter table public.network_contacts
  add constraint network_contacts_facility_company_fkey
  foreign key (facility_id, company_id)
  references public.network_facilities(id, company_id)
  on delete restrict;
