alter table public.organization_network_company_links
  drop constraint organization_network_company_links_org_unique;

alter table public.organization_network_company_links
  drop constraint organization_network_company_links_company_unique;

create unique index organization_network_company_links_active_org_uidx
  on public.organization_network_company_links (organization_id)
  where link_status='active';

create unique index organization_network_company_links_active_company_uidx
  on public.organization_network_company_links (network_company_id)
  where link_status='active';

comment on index public.organization_network_company_links_active_org_uidx is
  'At most one active Network Company link per organization; revoked historical links may coexist.';
comment on index public.organization_network_company_links_active_company_uidx is
  'At most one active organization link per Network Company; revoked historical links may coexist.';
