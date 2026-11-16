-- NET-PRO-PRODUCERS1.C — first-party catalog LINK index (no PDF mirroring).
-- Only source URL metadata. No catalog content, price lists, PDF bytes or copyrighted
-- norm text is imported. Requires existing Network PRO producer/country entitlement.

create table if not exists private.network_producer_catalog_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete cascade,
  title text not null check (char_length(title) between 8 and 220),
  source_url text not null check (source_url ~ '^https://[^[:space:]<>]+$' and char_length(source_url)<=1200),
  document_type text not null check (document_type in ('official_pdf','official_catalog_page')),
  language_codes text[] not null default array['it']::text[],
  edition_year integer check (edition_year between 1990 and 2100),
  rights_status text not null default 'link_only' check (rights_status='link_only'),
  source_status text not null default 'official_link_observed'
    check (source_status in ('official_link_observed','unavailable')),
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id,source_url)
);
alter table private.network_producer_catalog_links enable row level security;
revoke all on table private.network_producer_catalog_links from public,anon,authenticated;
-- No browser-side table access. Metadata are exposed only by a scoped RPC.

-- Seed links to documents or catalog landing pages that the manufacturers
-- themselves host. Identity matched to exact existing published producer roles.
with sources (domain,match_name,title,url,kind,langs,edition_year) as (
  values
  ('acciaitubi.it','Acciaitubi%',
   'Acciaitubi - Catalogo prodotti e norme 2024',
   'https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf',
   'official_pdf',array['it','en']::text[],2024),
  ('alessiotubi.it','Alessio Tubi%',
   'Alessio Tubi - Catalogo prodotti 2026',
   'https://alessiotubi.it/wp-content/uploads/2026/04/2026_04_ALESSIOTUBI_BrochureTabelle.pdf',
   'official_pdf',array['it','en']::text[],2026),
  ('padanatubi.it','Padana Tubi%',
   'Padana Tubi - Catalogo tecnico Inox 2018',
   'https://www.padanatubi.it/wp-content/uploads/2021/09/INOX_aggiornamento_Cat-042018_OK.pdf',
   'official_pdf',array['it','en']::text[],2018),
  ('padanatubi.it','Padana Tubi%',
   'Padana Tubi - Cataloghi e allegati prodotti',
   'https://www.padanatubi.it/prodotti/',
   'official_catalog_page',array['it']::text[],null::integer),
  ('marcegaglia.com','Marcegaglia Carbon Steel%',
   'Marcegaglia Carbon Steel - Carbon Steel Tubes',
   'https://www.publications.marcegaglia.com/wp-content/uploads/2023/11/Marcegaglia-Carbon-Steel-Tubes.pdf',
   'official_pdf',array['it','en']::text[],2023)
)
insert into private.network_producer_catalog_links
(company_id,title,source_url,document_type,language_codes,edition_year)
select c.id,s.title,s.url,s.kind,s.langs,s.edition_year
from sources s join public.network_companies c
  on c.country_code='IT' and c.publication_status='published'
  and c.archived_at is null and c.website_domain=s.domain
  and c.legal_name ilike s.match_name
where exists (
 select 1 from public.network_company_role_assignments a
 join public.network_company_roles r on r.id=a.role_id
 where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
)
on conflict (company_id,source_url) do nothing;

create or replace function private.netproducers1_catalog_index_impl(
  p_organization_id uuid,p_company_ids uuid[]
)
returns jsonb language plpgsql stable security definer set search_path=''
as $body$
declare v_docs jsonb;
begin
  if not private.netpro1b_allowed_for(p_organization_id,'producers','IT') then
    raise exception 'Network PRO producer/country entitlement required'
      using errcode='42501';
  end if;
  if p_company_ids is null or cardinality(p_company_ids) not between 1 and 24 then
    raise exception 'Bounded company ID list required' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'company_id',q.company_id,'title',q.title,'source_url',q.source_url,
    'document_type',q.document_type,'language_codes',to_jsonb(q.language_codes),
    'edition_year',q.edition_year,'rights_status',q.rights_status,
    'source_status',q.source_status
  ) order by q.company_id,q.title),'[]'::jsonb)
  into v_docs from (
    select d.*
    from private.network_producer_catalog_links d
    join public.network_companies c on c.id=d.company_id
    where d.company_id=any(p_company_ids)
      and d.source_status='official_link_observed'
      and c.publication_status='published'
      and c.archived_at is null and c.country_code='IT'
      and exists (
       select 1 from public.network_company_role_assignments a
       join public.network_company_roles r on r.id=a.role_id
       where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
      )
    order by d.company_id,d.title
    limit 60
  ) q;
  return jsonb_build_object('contract','netproducers1-catalog-index-v1',
    'items',v_docs,'total',jsonb_array_length(v_docs));
end;
$body$;

create or replace function public.netproducers1_catalog_index(
  p_organization_id uuid,p_company_ids uuid[]
)
returns jsonb language sql stable security invoker set search_path=''
as $body$
  select private.netproducers1_catalog_index_impl(p_organization_id,p_company_ids);
$body$;

revoke all on function private.netproducers1_catalog_index_impl(uuid,uuid[])
  from public,anon;
revoke all on function public.netproducers1_catalog_index(uuid,uuid[])
  from public,anon;
grant execute on function private.netproducers1_catalog_index_impl(uuid,uuid[])
  to authenticated,service_role;
grant execute on function public.netproducers1_catalog_index(uuid,uuid[])
  to authenticated,service_role;

comment on table private.network_producer_catalog_links is
  'Official manufacturer catalog link metadata only; never mirror PDFs without license.';
comment on function public.netproducers1_catalog_index(uuid,uuid[]) is
  'Italian manufacturer official-catalog links, fail closed by Network PRO producers IT entitlement and tenant identity.';
