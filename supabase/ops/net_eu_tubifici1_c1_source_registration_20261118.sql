-- EU1.C1 first-party source register, deliberately executed AFTER guarded
-- schema migration and separate GitHub release. Facts are short original
-- summaries, not copied site content or catalog PDFs.
-- Run once/idempotently against production; never upgrades company verification.
with sources(country_code,domain,city,process,proof_url,source_kind,proof_status,proof_note) as (
 values
 ('AT','voestalpine.com','Kindberg','seamless_hot_rolled',
  'https://www.voestalpine.com/tubulars/en/company/production/',
  'first_party_html','qualified_firstparty',
  'The Austrian Kindberg works operates seamless tube rolling, industrial pipe finishing and production of hollow sections.'),
 ('CZ','trz.cz','Ostrava','seamless_hot_rolled',
  'https://www.trz.cz/en/products/seamless-tubes/',
  'first_party_html','qualified_firstparty',
  'The official TŽ product page places two Mannesmann seamless-tube rolling lines at its Ostrava mill.'),
 ('DE','europipe.com','Mülheim an der Ruhr','welded_longitudinal_uoe',
  'https://www.europipe.com/en/unternehmen/produktion',
  'first_party_html','qualified_firstparty',
  'EUROPIPE directly describes large-diameter longitudinal seam welding using UOE forming at its Mülheim production facility.'),
 ('FI','stalatube.com','Lahti','welded_stainless_hollow_sections',
  'https://stalatube.com/2024/01/16/stalatube-launched-epd-figures-for-stainless-steel-hollow-sections-at-the-forefront-of-all/',
  'first_party_html','qualified_firstparty',
  'Stalatube reports production of stainless hollow sections in Lahti by cold roll forming, welding and cutting.'),
 ('PL','stalprodukt.com.pl',null,'cold_formed_tubes_profiles',
  'https://www.stalprodukt.com.pl/en/offer/cold-rolled-sections/',
  'first_party_html','qualified_firstparty',
  'Stalprodukt describes its automated cold-formed tube and steel profile manufacturing; precise tube mill location requires separate evidence.'),
 ('SK','zelpo.eu','Podbrezová','seamless_hot_rolled_cold_drawn',
  'https://www.zelpo.eu/',
  'first_party_html','qualified_firstparty',
  'The official Slovak producer site describes in-group steelworks and hot rolled and cold drawn tube production in Podbrezová.'),
 ('SE','alleima.com','Sandviken','group_division_unspecified',
  'https://www.alleima.com/en/news-media/archive/2026/06/alleima-responds-to-growing-global-demand-for-nuclear-power--inaugurates-tube-mill-2026-in-sandviken/',
  'related_group_firstparty','hold_group_entity',
  'Alleima reports a Tube Mill in Sandviken but the proposed Alleima AB group identity must be reconciled with the factory operating legal entity.'),
 ('PT','ferpinta.pt','Carregosa','welded_steel_tubes',
  'https://ferro.pt/en/about/',
  'related_group_firstparty','hold_legal_identity',
  'Group-owned public information identifies tube manufacture; the producer legal registration has a longer official name than the proposed FERPINTA S.A.')
), inserted as (
 insert into private.net_eu_tubifici1_manufacturing_proofs(
  candidate_id,identity_evidence_id,factory_country_code,
  factory_city,process_code,source_url,source_kind,proof_note,proof_status
 )
 select c.id,e.id,s.country_code,s.city,s.process,s.proof_url,
   s.source_kind,s.proof_note,s.proof_status
 from sources s
 join public.network_company_discovery_candidates c on
   c.country_code=s.country_code and lower(c.canonical_domain)=s.domain
   and c.extraction_version='net-eu-tubifici1-bridge-v1'
   and c.review_status='pending_review'
 join private.net_eu_tubifici1_identity_evidence e on
   e.candidate_id=c.id and e.verdict='observed_match'
   and e.name_matched and e.page_sha256 is not null
 where not exists(select 1 from public.network_companies n
   where n.publication_status<>'archived' and
     lower(regexp_replace(coalesce(n.website_domain,''),'^www[.]',''))=s.domain)
 on conflict(candidate_id) do nothing
 returning candidate_id,proof_status
)
select proof_status,count(*) as inserted from inserted group by proof_status order by proof_status;
