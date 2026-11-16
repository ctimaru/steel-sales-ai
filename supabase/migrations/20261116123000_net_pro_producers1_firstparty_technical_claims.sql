-- NET-PRO-PRODUCERS1.E — source-backed, conservative technical capability metadata.
-- Link-only references to official first-party HTML. No mirrored PDFs, copied
-- descriptions or claims of certified supply, live capacity, price or stock.
-- EACH claim has its own source, segment and observation timestamp. A standard,
-- grade or dimensional interval does NOT prove that every combination is made.
-- Do not overwrite canonical product scopes with this evidence. New sources enter
-- via reviewed append-only records; failed/uncertain extractions stay private.

create table if not exists private.network_producer_technical_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete cascade,
  product_scope text not null check (char_length(product_scope) between 4 and 96),
  claim_kind text not null check (claim_kind in (
    'manufacturing_process','technical_standard','steel_grade',
    'section_shape','dimension_range'
  )),
  claim_value text not null check (char_length(claim_value) between 2 and 200),
  source_url text not null check (
    source_url ~ '^https://[^[:space:]<>]+$' and char_length(source_url)<=1200
  ),
  source_title text not null check (char_length(source_title) between 6 and 160),
  evidence_status text not null default 'first_party_observed'
    check (evidence_status in ('first_party_observed','withdrawn')),
  rights_status text not null default 'link_only'
    check (rights_status='link_only'),
  observed_at timestamptz not null default now(),
  unique(company_id,product_scope,claim_kind,claim_value,source_url)
);
alter table private.network_producer_technical_claims enable row level security;
revoke all on table private.network_producer_technical_claims
  from public,anon,authenticated;
create index if not exists network_producer_technical_claims_company_idx
  on private.network_producer_technical_claims(company_id)
  where evidence_status='first_party_observed';

-- Bounded first-party observations from four ALREADY PUBLISHED producer
-- companies. Legal identity + canonical domain + active producer role must match.
-- The source pages are official product pages, not PDF copies or crawled snippets.
with claims(domain,match_name,product_scope,claim_kind,claim_value,source_url,source_title) as (
 values
  ('acciaitubi.it','Acciaitubi%','en-10219-structural','manufacturing_process','Saldatura longitudinale','https://acciaitubi.it/en/tubes/welded-construction-tubes/','Acciaitubi · Welded construction tubes'),
  ('acciaitubi.it','Acciaitubi%','en-10219-structural','technical_standard','EN 10219-1','https://acciaitubi.it/en/tubes/welded-construction-tubes/','Acciaitubi · Welded construction tubes'),
  ('acciaitubi.it','Acciaitubi%','en-10219-structural','steel_grade','S235JRH','https://acciaitubi.it/en/tubes/welded-construction-tubes/','Acciaitubi · Welded construction tubes'),
  ('acciaitubi.it','Acciaitubi%','en-10219-structural','steel_grade','S355J2H','https://acciaitubi.it/en/tubes/welded-construction-tubes/','Acciaitubi · Welded construction tubes'),
  ('acciaitubi.it','Acciaitubi%','en-10219-structural','steel_grade','S460MH','https://acciaitubi.it/en/tubes/welded-construction-tubes/','Acciaitubi · Welded construction tubes'),
  ('acciaitubi.it','Acciaitubi%','en-10219-structural','section_shape','Tondo','https://acciaitubi.it/en/tubes/welded-construction-tubes/','Acciaitubi · Welded construction tubes'),
  ('acciaitubi.it','Acciaitubi%','en-10219-structural','dimension_range','Tondo: Ø 21,3–114,3 mm','https://acciaitubi.it/en/tubes/welded-construction-tubes/','Acciaitubi · Welded construction tubes'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','manufacturing_process','Tubi saldati formati a freddo','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','technical_standard','EN 10219-1','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','steel_grade','S235JRH','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','steel_grade','S275J0H','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','steel_grade','S275J2H','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','steel_grade','S355J2H','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','section_shape','Tondo','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','section_shape','Quadro','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','section_shape','Rettangolare','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','dimension_range','Tondo: Ø 20–508 mm; sp. 1,5–12,5 mm','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','dimension_range','Quadro: 15×15–300×300 mm; sp. 1,5–12,5 mm','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('alessiotubi.it','Alessio Tubi%','en-10219-structural','dimension_range','Rettangolare: 20×10–400×200 mm; sp. 1,5–12,5 mm','https://alessiotubi.it/it/prodotti/','Alessio Tubi · Prodotti'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','manufacturing_process','Tubi elettrosaldati','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','technical_standard','EN 10219','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','section_shape','Tondo','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','section_shape','Quadro','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','section_shape','Rettangolare','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','dimension_range','Tondo: Ø 12–355,6 mm','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','dimension_range','Quadro: 10×10–300×300 mm','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','dimension_range','Rettangolare: 15×10–400×200 mm','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('padanatubi.it','Padana Tubi%','en-10219-carbon','dimension_range','Spessore famiglia carbonio: 1,25–12,5 mm','https://www.padanatubi.it/prodotti/acciaio-al-carbonio/','Padana Tubi · Acciaio al carbonio'),
  ('marcegaglia.com','Marcegaglia Carbon Steel%','carbon-welded','manufacturing_process','Tubi saldati in acciaio al carbonio','https://www.carbonsteel.marcegaglia.com/it/tubi-saldati-in-acciaio-al-carbonio/','Marcegaglia Carbon Steel · Tubi saldati'),
  ('marcegaglia.com','Marcegaglia Carbon Steel%','carbon-welded','technical_standard','EN 10219','https://www.carbonsteel.marcegaglia.com/it/tubi-saldati-in-acciaio-al-carbonio/','Marcegaglia Carbon Steel · Tubi saldati'),
  ('marcegaglia.com','Marcegaglia Carbon Steel%','carbon-welded','technical_standard','EN 10305-3','https://www.carbonsteel.marcegaglia.com/it/tubi-saldati-in-acciaio-al-carbonio/','Marcegaglia Carbon Steel · Tubi saldati'),
  ('marcegaglia.com','Marcegaglia Carbon Steel%','carbon-welded','technical_standard','EN 10305-5','https://www.carbonsteel.marcegaglia.com/it/tubi-saldati-in-acciaio-al-carbonio/','Marcegaglia Carbon Steel · Tubi saldati'),
  ('marcegaglia.com','Marcegaglia Carbon Steel%','carbon-welded','section_shape','Tondo','https://www.carbonsteel.marcegaglia.com/it/tubi-saldati-in-acciaio-al-carbonio/','Marcegaglia Carbon Steel · Tubi saldati'),
  ('marcegaglia.com','Marcegaglia Carbon Steel%','carbon-welded','section_shape','Quadro','https://www.carbonsteel.marcegaglia.com/it/tubi-saldati-in-acciaio-al-carbonio/','Marcegaglia Carbon Steel · Tubi saldati'),
  ('marcegaglia.com','Marcegaglia Carbon Steel%','carbon-welded','section_shape','Rettangolare','https://www.carbonsteel.marcegaglia.com/it/tubi-saldati-in-acciaio-al-carbonio/','Marcegaglia Carbon Steel · Tubi saldati'),
  ('marcegaglia.com','Marcegaglia Carbon Steel%','carbon-welded','dimension_range','Gamma aggregata tubi saldati: 8–406,4 mm; sp. 0,3–16 mm','https://www.carbonsteel.marcegaglia.com/it/tubi-saldati-in-acciaio-al-carbonio/','Marcegaglia Carbon Steel · Tubi saldati')
)
insert into private.network_producer_technical_claims
  (company_id,product_scope,claim_kind,claim_value,source_url,source_title)
select c.id,s.product_scope,s.claim_kind,s.claim_value,s.source_url,s.source_title
from claims s
join public.network_companies c
  on c.website_domain=s.domain
 and c.legal_name ilike s.match_name
 and c.country_code='IT' and c.publication_status='published'
 and c.archived_at is null
where exists (
 select 1 from public.network_company_role_assignments a
 join public.network_company_roles r on r.id=a.role_id
 where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
)
on conflict(company_id,product_scope,claim_kind,claim_value,source_url) do nothing;

-- Never allow unsafely mixed organization and company identifiers to obtain
-- technical data. This uses the same current, validated producers/IT grant as
-- the directory and catalog. No anonymous or unscoped public endpoint.
create or replace function private.netproducers1_technical_claims_impl(
  p_organization_id uuid, p_company_ids uuid[]
)
returns jsonb language plpgsql stable security definer set search_path=''
as $body$
declare v_items jsonb;
begin
 if not private.netpro1b_allowed_for(p_organization_id,'producers','IT') then
   raise exception 'Network PRO producer/country entitlement required'
     using errcode='42501';
 end if;
 if p_company_ids is null or cardinality(p_company_ids) not between 1 and 24 then
   raise exception 'Bounded company IDs required' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'company_id',v.company_id,'product_scope',v.product_scope,
   'claim_kind',v.claim_kind,'claim_value',v.claim_value,
   'source_url',v.source_url,'source_title',v.source_title,
   'evidence_status',v.evidence_status,'rights_status',v.rights_status,
   'observed_at',v.observed_at
 ) order by v.company_id,v.claim_kind,v.claim_value),'[]'::jsonb)
 into v_items
 from (
   select e.*
   from private.network_producer_technical_claims e
   join public.network_companies c on c.id=e.company_id
   where e.company_id=any(p_company_ids)
     and e.evidence_status='first_party_observed'
     and c.publication_status='published' and c.archived_at is null
     and c.country_code='IT'
     and exists (
       select 1 from public.network_company_role_assignments a
       join public.network_company_roles r on r.id=a.role_id
       where a.company_id=c.id and r.canonical_key='producer'
         and r.status='active'
     )
   order by e.company_id,e.claim_kind,e.claim_value
   limit 160
 ) v;
 return jsonb_build_object('contract','netproducers1-technical-claims-v1',
   'items',v_items,'total',jsonb_array_length(v_items));
end;
$body$;

create or replace function public.netproducers1_technical_claims(
  p_organization_id uuid,p_company_ids uuid[]
)
returns jsonb language sql stable security invoker set search_path=''
as $body$
  select private.netproducers1_technical_claims_impl(p_organization_id,p_company_ids);
$body$;

revoke all on function private.netproducers1_technical_claims_impl(uuid,uuid[])
  from public,anon;
revoke all on function public.netproducers1_technical_claims(uuid,uuid[])
  from public,anon;
grant execute on function private.netproducers1_technical_claims_impl(uuid,uuid[])
  to authenticated,service_role;
grant execute on function public.netproducers1_technical_claims(uuid,uuid[])
  to authenticated,service_role;
comment on table private.network_producer_technical_claims is
  'Official-source technical observations, link-only and non-combinatorial; never infer exact manufacture or stock.';
