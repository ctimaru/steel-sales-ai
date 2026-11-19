-- NET-EU-TUBIFICI1.D5.A: reusable source-bound European operator publication.
-- Publishes original factual manufacturing profiles with source URL provenance;
-- no copies of webpages, personal data, legal certification or invented dimensions.
-- Existing B1/C1/D4, PA1.5 and Italian auto-publish triggers remain unchanged.
create table if not exists private.net_eu_tubifici1_d5_operator_sources (
 candidate_id uuid primary key references public.network_company_discovery_candidates(id) on delete restrict,
 operator_legal_name text not null check(char_length(operator_legal_name) between 6 and 255),
 operator_trading_name text,
 operator_registration_id text,
 legal_source_url text not null check(legal_source_url ~* '^https://' and char_length(legal_source_url)<=2000),
 factory_source_url text not null check(factory_source_url ~* '^https://' and char_length(factory_source_url)<=2000),
 factory_city text,
 process_code text not null check(char_length(process_code) between 5 and 80),
 source_kind text not null check(source_kind in ('first_party','official_registry','official_operator','first_party_subdomain')),
 factual_note text not null check(char_length(factual_note) between 24 and 600),
 rights_state text not null default 'not_restricted' check(rights_state='not_restricted'),
 source_checked_at timestamptz not null default now(),
 company_id uuid unique references public.network_companies(id) on delete restrict,
 published_at timestamptz,
 check((company_id is null and published_at is null) or
       (company_id is not null and published_at is not null))
);
alter table private.net_eu_tubifici1_d5_operator_sources enable row level security;
revoke all on private.net_eu_tubifici1_d5_operator_sources from public,anon,authenticated,service_role;
grant select on private.net_eu_tubifici1_d5_operator_sources to service_role;
create index if not exists net_eu_tubifici1_d5_source_ready on private.net_eu_tubifici1_d5_operator_sources(source_checked_at)
where company_id is null;

-- Initial European backlog cohort: source research is public-business-only.
-- In an empty CI database these rows are not invented; they are materialized
-- only when the exact private-seed-backed original candidates are present.
insert into private.net_eu_tubifici1_d5_operator_sources(
 candidate_id,operator_legal_name,operator_trading_name,operator_registration_id,
 legal_source_url,factory_source_url,factory_city,process_code,source_kind,factual_note
)
select v.candidate_id::uuid,v.operator_legal_name,v.operator_trading_name,v.operator_registration_id,
 v.legal_source_url,v.factory_source_url,v.factory_city,v.process_code,v.source_kind,v.factual_note
from (values
('df1b13f5-b0e3-45ec-bf7a-a4c8ed9d34b5','BENTELER Steel/Tube GmbH & Co. KG',NULL,'529900W8QNKUBM788A34','https://lei.bloomberg.com/leis/view/529900W8QNKUBM788A34','https://www.benteler.com/en/about-benteler/company-structure/',NULL,'seamless_and_welded_steel_tubes','official_registry','German BENTELER Steel/Tube operating company identified by LEI; group source explicitly lists manufacturing of seamless and welded steel tubes.'),
('b4d9daa0-020c-4e7a-8823-a7b2d4a58534','BORNAY, S.L.','Bornay','B03016268','https://www.bornay.es/aviso-legal/','https://www.bornay.es/bornay/quienes-somos/','Ibi','welded_steel_tubes','first_party','Company imprint identifies BORNAY SL and its Spanish fiscal ID; its original business description documents precision welded steel tube manufacturing.'),
('789985a5-014f-4647-bebe-edb9ec394751','TUBACEX TUBOS INOXIDABLES S.A.U.','TUBACEX Tubos Inoxidables',NULL,'https://www.tubacex.com/en/tubacex-group/group-companies/tubacex-tubos-inoxidables-eng/','https://www.tubacex.com/en/tubacex-group/group-companies/tubacex-tubos-inoxidables-eng/','Laudio-Llodio','seamless_stainless_tubes','first_party','Tubacex names this exact manufacturing subsidiary and describes seamless stainless and nickel-alloy tubes. Plant at Laudio-Llodio supported by producer news.'),
('9186e3fe-b047-414d-b32e-b924b293abe9','TUBOS REUNIDOS INDUSTRIAL S.L.U.','Tubos Reunidos Industrial',NULL,'https://eu.prtr-es.miteco.gob.es/informes/fichacomplejo.aspx?Id_Complejo=3342','https://www.tubosreunidosgroup.com/es/noticias/2021/tubos-reunidos-industrial-tubos-de-diametro-exterior-de-hasta-7-pulgadas-97','Amurrio','seamless_steel_tubes','official_registry','Spanish environmental register identifies the operator at Amurrio; group manufacturing page documents seamless carbon and alloy steel tubes.'),
('2311d3e1-1ffa-4383-ab55-ffa8780af288','SSAB Europe Oy',NULL,NULL,'https://www.ssab.com/fi-fi/yhteystiedot/locations','https://www.ssab.com/en/company/about-ssab/business-areas/main-production-sites','Hämeenlinna','welded_hollow_sections','first_party','SSAB official entity listing names SSAB Europe Oy; Hämeenlinna producer site documents hollow-section tube production.'),
('fb29c679-d27b-4e59-8a75-8724fa150c51','MARCEGAGLIA (UK) LIMITED','Marcegaglia UK','02677001','https://find-and-update.company-information.service.gov.uk/company/02677001','https://www.marcegaglia.co.uk/marcegaglia-oldbury/','Oldbury','welded_steel_tubes','official_registry','UK Companies House identifies Marcegaglia (UK) Limited; its own Oldbury facility page records carbon and stainless electro-welded tube lines.'),
('8ec49e12-9c9c-4a5f-91a4-66b1ca17158a','Marcegaglia Poland sp. z o.o.','Marcegaglia Poland',NULL,'https://marcegaglia.pl/en/legal-documents/','https://marcegaglia.pl/en/marcegaglia-kluczbork/','Kluczbork','welded_steel_tubes','first_party','Polish first-party legal documents name Marcegaglia Poland sp. z o.o.; Kluczbork plant manufactures welded precision carbon steel tubes.'),
('99e99715-80fe-4ffb-b25e-4aeba9b0bdae','Borusan Birleşik Boru Fabrikaları Sanayi ve Ticaret A.Ş.','Borusan Pipe','69531-0','https://borusanpipe.com/investor-relations/corporate-governance/corporate-management-trade-registry','https://borusanpipe.com/corporate/our-history','Gemlik','welded_steel_tubes','first_party','Operator first-party trade registry identifies the full company name and registration; history identifies the Gemlik steel pipe manufacturing plant.'),
('f04ea2dc-8f5c-404d-8ad1-84777260aa03','Erciyas Çelik Boru Sanayi A.Ş.','Erciyas Steel Pipe','363426-0','https://erciyasboru.com/yatirimci-iliskileri/ticaret-sicil-bilgileri/','https://erciyasboru.com/yatirimci-iliskileri/sikca-sorulan-sorular/','Düzce','spiral_welded_steel_pipes','official_operator','The separate factory operator''s official trade register identifies Erciyas Çelik Boru A.Ş.; its FAQ documents spiral welded pipes at Düzce and Mersin.'),
('98e472af-6ec5-47de-94bf-317020a56c1f','CENTRAVIS PRODUCTION UKRAINE PJSC','Centravis',NULL,'https://www.centravis.com/en/privacy-policy/','https://www.centravis.com/en/about-us/','Nikopol','seamless_stainless_tubes','first_party','Centravis own legal notice names the operating Ukrainian company; Nikopol mill produces seamless stainless tubes using hot extrusion and cold drawing.'),
('6838ebf7-985d-43b2-8996-73e8dc5e6465','INTERPIPE NIKO TUBE LLC','Interpipe Niko Tube',NULL,'https://interpipe.biz/en/certificates-interpipe-niko-tube-nikopol/','https://nikotube.interpipe.biz/en/about/about','Nikopol','seamless_steel_tubes','first_party_subdomain','Interpipe official operator certificates name Niko Tube LLC; its manufacturer-owned subdomain documents seamless steel pipe production at Nikopol.')
) v(candidate_id,operator_legal_name,operator_trading_name,operator_registration_id,
    legal_source_url,factory_source_url,factory_city,process_code,source_kind,factual_note)
join public.network_company_discovery_candidates c on c.id=v.candidate_id::uuid
join public.network_company_discovery_runs r on r.id=c.run_id
where c.review_status='pending_review'
 and c.country_code<>'IT'
 and c.extraction_version='net-eu-tubifici1-bridge-v1'
 and r.extraction_version='net-eu-tubifici1-bridge-v1'
 and c.country_code=r.country_code
 and c.role_keys @> array['producer']::text[]
 and not c.personal_data_detected and cardinality(c.personal_data_fields)=0
 and c.identity_quality->'operator_reconciliation' is null
 and private.net_eu_tubifici1_seed_matches(
 c.country_code,c.canonical_domain,c.source_url,r.source_reference,
 c.identity_quality->>'seed_id',c.identity_quality->>'research_id')
on conflict(candidate_id) do nothing;
create or replace function private.net_eu_tubifici1_d5_publish(
 p_max integer default 50,p_commit boolean default false
)
returns jsonb language plpgsql security definer set search_path=''
as $d4$
declare
 v_row record;
 v_role uuid;
 v_subtype uuid;
 v_family uuid;
 v_company uuid;
 v_assertion uuid;
 v_facility uuid;
 v_eligible int:=0;
 v_published int:=0;
 v_items jsonb:='[]'::jsonb;
begin
 if session_user<>'postgres' or auth.uid() is not null
    or p_max is null or p_max not between 1 and 50 or p_commit is null then
   raise exception 'D4 requires bounded database-maintenance publication' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(810021,20264);
 select id into v_role from public.network_company_roles
 where canonical_key='producer' and status='active';
 select id into v_subtype from public.network_company_subtypes
 where canonical_key='tube_pipe_producer' and status='active';
 select id into v_family from public.network_product_families
 where canonical_key='tubes_pipes' and status='active';
 if v_role is null or v_subtype is null or v_family is null then
    raise exception 'Missing active steel manufacturer taxonomy' using errcode='22023';
 end if;
 for v_row in
  select s.*,c.id source_candidate_id,c.country_code,c.canonical_domain,
     c.website_url,c.legal_name old_candidate_name,c.run_id
  from private.net_eu_tubifici1_d5_operator_sources s
  join public.network_company_discovery_candidates c on c.id=s.candidate_id
  join public.network_company_discovery_runs r on r.id=c.run_id
  where s.company_id is null and s.published_at is null
    and c.review_status='pending_review'
    and c.governance_status='unreviewed'
    and c.publication_actor_type='platform'
    and c.country_code<>'IT' and c.country_code=r.country_code
    and c.extraction_version='net-eu-tubifici1-bridge-v1'
    and r.extraction_version='net-eu-tubifici1-bridge-v1'
    and r.source_reference ~ '^net-eu-tubifici1:NET-EU-TUBIFICI-[0-9]{8}-[0-9]{2}
    and c.role_keys @> array['producer']::text[]
    and c.quality_flags <@ array[
       'legal_identity_not_verified','producer_role_not_verified',
       'group_or_legal_entity_review']::text[]
    and not c.personal_data_detected
    and cardinality(c.personal_data_fields)=0
    and r.personal_data_policy='company_data_only'
    and r.governance_status='unreviewed'
    and private.net_eu_tubifici1_seed_matches(
        c.country_code,c.canonical_domain,c.source_url,r.source_reference,
        c.identity_quality->>'seed_id',c.identity_quality->>'research_id')
    and s.source_checked_at>now()-interval '180 days'
    and s.rights_state='not_restricted'
    and s.factory_source_url ~* '^https://'
    and s.legal_source_url ~* '^https://'
    and (
      (s.source_kind in ('first_party','first_party_subdomain','official_registry')
       and (lower(regexp_replace(split_part(split_part(s.factory_source_url,'/',3),':',1),'^www[.]',''))=lower(c.canonical_domain)
          or right(lower(regexp_replace(split_part(split_part(s.factory_source_url,'/',3),':',1),'^www[.]','')),
                   length(c.canonical_domain)+1)='.'||lower(c.canonical_domain)))
       or (s.source_kind='official_operator'
         and c.canonical_domain='erciyas.com'
         and split_part(s.factory_source_url,'/',3)='erciyasboru.com')
    )
    and not exists(
       select 1 from public.network_companies n
       where n.publication_status<>'archived'
         and (lower(regexp_replace(coalesce(n.website_domain,''),'^www[.]',''))
              = lower(c.canonical_domain)
         or (n.country_code=c.country_code and
             lower(regexp_replace(btrim(n.legal_name),'[^[:alnum:]]','','g'))
             = lower(regexp_replace(btrim(s.operator_legal_name),'[^[:alnum:]]','','g')))
         or (n.country_code=c.country_code and
             n.registration_id=s.operator_registration_id))
    )
    and not exists(select 1 from public.network_netfast3_suppressed_domains sd
       where lower(sd.domain)=lower(c.canonical_domain))
  order by c.country_code,c.canonical_domain
  limit p_max for update of s skip locked
 loop
   v_eligible:=v_eligible+1;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'candidate_id',v_row.candidate_id,'operator',v_row.operator_legal_name,
     'country',v_row.country_code,'previous_label',v_row.old_candidate_name,
     'factory_city',v_row.factory_city,'source',v_row.factory_source_url));
   if not p_commit then continue; end if;

   insert into public.network_companies(
     legal_name,trading_name,country_code,registration_id,vat_id,
     website_url,website_domain,description,
     publication_status,claimed_status,verification_status
   ) values (
     v_row.operator_legal_name,v_row.operator_trading_name,
     v_row.country_code,v_row.operator_registration_id,v_row.operator_vat_id,
     v_row.website_url,lower(v_row.canonical_domain),
     v_row.factual_note,'published','unclaimed','unverified'
   ) returning id into v_company;

   insert into public.network_data_assertions(
     entity_type,entity_id,field_path,asserted_value,
     source_type,source_reference,ownership_type,asserted_by,confidence,review_state
   ) values (
     'company',v_company,'eu_tube_factory_reconciled_operator',
     jsonb_build_object(
       'original_candidate_id',v_row.candidate_id,
       'source_company_label',v_row.old_candidate_name,
       'legal_name',v_row.operator_legal_name,
       'factory_country',v_row.country_code,
       'factory_city',v_row.factory_city,
       'process',v_row.process_code,
       'source_level','independent_or_first_party_observed',
       'legal_source_url',v_row.legal_source_url,
       'source_kind',v_row.source_kind,
       'legal_registration_verified',false,
       'manufacturer_confirmed',false,
       'specific_dimensions_verified',false,
       'evidence_note',v_row.factual_note
     ),'public_web',v_row.factory_source_url,
     'platform_curated',null,0.92,'accepted'
   ) returning id into v_assertion;

   insert into public.network_company_role_assignments(
     company_id,role_id,is_primary,source_assertion_id
   ) values(v_company,v_role,true,v_assertion);
   insert into public.network_company_subtype_assignments(
     company_id,subtype_id,source_assertion_id
   ) values(v_company,v_subtype,v_assertion);
   v_facility:=null;
   if v_row.factory_city is not null then
     insert into public.network_facilities(
       company_id,name,facility_type,city,country_code,website_url,
       publication_status,verification_status
     ) values (
       v_company,'Tube manufacturing — '||v_row.factory_city,
       'manufacturing',v_row.factory_city,v_row.country_code,
       v_row.factory_source_url,'published','unverified'
     ) returning id into v_facility;
   end if;
   insert into public.network_company_products(
     company_id,product_family_id,relationship_type,facility_id,source_assertion_id
   ) values(v_company,v_family,'produces',v_facility,v_assertion);
   update private.net_eu_tubifici1_d5_operator_sources
     set company_id=v_company,published_at=now()
     where candidate_id=v_row.candidate_id;
   update public.network_company_discovery_candidates c
     set identity_quality=pg_catalog.jsonb_set(coalesce(c.identity_quality,'{}'::jsonb),
       '{operator_reconciliation}',pg_catalog.jsonb_build_object(
       'status','published_correct_legal_operator',
       'operator_company_id',v_company,
       'operator_legal_name',v_row.operator_legal_name,
       'source_candidate_still_audit_only',true,
       'release_contract','net-eu-tubifici1-d5-operators-v1'),true)
     where c.id=v_row.candidate_id and c.review_status='pending_review'
       and c.identity_quality->'operator_reconciliation' is null;

   -- Deliberately do NOT make the original parent/division candidate
   -- impersonate the newly published legal operator. Linked evidence and
   -- audit release ledger record the reconciliation instead.
   v_published:=v_published+1;
 end loop;
 return jsonb_build_object('contract','net-eu-tubifici1-d5-operators-v1',
  'mode',case when p_commit then 'publish' else 'dry_run' end,
  'eligible',v_eligible,'published',v_published,
  'operators',v_items,'legal_entity_certified',false,
  'exact_technical_dimensions',false);
end
$d4$;

revoke all on function private.net_eu_tubifici1_d5_publish(integer,boolean)
 from public,anon,authenticated,service_role;


    and c.role_keys @> array['producer']::text[]
    and c.quality_flags <@ array[
       'legal_identity_not_verified','producer_role_not_verified',
       'group_or_legal_entity_review']::text[]
    and not c.personal_data_detected
    and cardinality(c.personal_data_fields)=0
    and r.personal_data_policy='company_data_only'
    and r.governance_status='unreviewed'
    and private.net_eu_tubifici1_seed_matches(
        c.country_code,c.canonical_domain,c.source_url,r.source_reference,
        c.identity_quality->>'seed_id',c.identity_quality->>'research_id')
    and s.source_checked_at>now()-interval '180 days'
    and s.rights_state='not_restricted'
    and s.factory_source_url ~* '^https://'
    and s.legal_source_url ~* '^https://'
    and (
      (s.source_kind in ('first_party','first_party_subdomain','official_registry')
       and (lower(regexp_replace(split_part(split_part(s.factory_source_url,'/',3),':',1),'^www[.]',''))=lower(c.canonical_domain)
          or right(lower(regexp_replace(split_part(split_part(s.factory_source_url,'/',3),':',1),'^www[.]','')),
                   length(c.canonical_domain)+1)='.'||lower(c.canonical_domain)))
       or (s.source_kind='official_operator'
         and c.canonical_domain='erciyas.com'
         and split_part(s.factory_source_url,'/',3)='erciyasboru.com')
    )
    and not exists(
       select 1 from public.network_companies n
       where n.publication_status<>'archived'
         and (lower(regexp_replace(coalesce(n.website_domain,''),'^www[.]',''))
              = lower(c.canonical_domain)
         or (n.country_code=c.country_code and
             lower(regexp_replace(btrim(n.legal_name),'[^[:alnum:]]','','g'))
             = lower(regexp_replace(btrim(s.operator_legal_name),'[^[:alnum:]]','','g')))
         or (n.country_code=c.country_code and
             n.registration_id=s.operator_registration_id))
    )
    and not exists(select 1 from public.network_netfast3_suppressed_domains sd
       where lower(sd.domain)=lower(c.canonical_domain))
  order by c.country_code,c.canonical_domain
  limit p_max for update of s skip locked
 loop
   v_eligible:=v_eligible+1;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'candidate_id',v_row.candidate_id,'operator',v_row.operator_legal_name,
     'country',v_row.country_code,'previous_label',v_row.old_candidate_name,
     'factory_city',v_row.factory_city,'source',v_row.factory_source_url));
   if not p_commit then continue; end if;

   insert into public.network_companies(
     legal_name,trading_name,country_code,registration_id,vat_id,
     website_url,website_domain,description,
     publication_status,claimed_status,verification_status
   ) values (
     v_row.operator_legal_name,v_row.operator_trading_name,
     v_row.country_code,v_row.operator_registration_id,v_row.operator_vat_id,
     v_row.website_url,lower(v_row.canonical_domain),
     v_row.factual_note,'published','unclaimed','unverified'
   ) returning id into v_company;

   insert into public.network_data_assertions(
     entity_type,entity_id,field_path,asserted_value,
     source_type,source_reference,ownership_type,asserted_by,confidence,review_state
   ) values (
     'company',v_company,'eu_tube_factory_reconciled_operator',
     jsonb_build_object(
       'original_candidate_id',v_row.candidate_id,
       'source_company_label',v_row.old_candidate_name,
       'legal_name',v_row.operator_legal_name,
       'factory_country',v_row.country_code,
       'factory_city',v_row.factory_city,
       'process',v_row.process_code,
       'source_level','independent_or_first_party_observed',
       'legal_source_url',v_row.legal_source_url,
       'source_kind',v_row.source_kind,
       'legal_registration_verified',false,
       'manufacturer_confirmed',false,
       'specific_dimensions_verified',false,
       'evidence_note',v_row.factual_note
     ),'public_web',v_row.factory_source_url,
     'platform_curated',null,0.92,'accepted'
   ) returning id into v_assertion;

   insert into public.network_company_role_assignments(
     company_id,role_id,is_primary,source_assertion_id
   ) values(v_company,v_role,true,v_assertion);
   insert into public.network_company_subtype_assignments(
     company_id,subtype_id,source_assertion_id
   ) values(v_company,v_subtype,v_assertion);
   v_facility:=null;
   if v_row.factory_city is not null then
     insert into public.network_facilities(
       company_id,name,facility_type,city,country_code,website_url,
       publication_status,verification_status
     ) values (
       v_company,'Tube manufacturing — '||v_row.factory_city,
       'manufacturing',v_row.factory_city,v_row.country_code,
       v_row.factory_source_url,'published','unverified'
     ) returning id into v_facility;
   end if;
   insert into public.network_company_products(
     company_id,product_family_id,relationship_type,facility_id,source_assertion_id
   ) values(v_company,v_family,'produces',v_facility,v_assertion);
   update private.net_eu_tubifici1_d5_operator_sources
     set company_id=v_company,published_at=now()
     where candidate_id=v_row.candidate_id;
   update public.network_company_discovery_candidates c
     set identity_quality=pg_catalog.jsonb_set(coalesce(c.identity_quality,'{}'::jsonb),
       '{operator_reconciliation}',pg_catalog.jsonb_build_object(
       'status','published_correct_legal_operator',
       'operator_company_id',v_company,
       'operator_legal_name',v_row.operator_legal_name,
       'source_candidate_still_audit_only',true,
       'release_contract','net-eu-tubifici1-d5-operators-v1'),true)
     where c.id=v_row.candidate_id and c.review_status='pending_review'
       and c.identity_quality->'operator_reconciliation' is null;

   -- Deliberately do NOT make the original parent/division candidate
   -- impersonate the newly published legal operator. Linked evidence and
   -- audit release ledger record the reconciliation instead.
   v_published:=v_published+1;
 end loop;
 return jsonb_build_object('contract','net-eu-tubifici1-d5-operators-v1',
  'mode',case when p_commit then 'publish' else 'dry_run' end,
  'eligible',v_eligible,'published',v_published,
  'operators',v_items,'legal_entity_certified',false,
  'exact_technical_dimensions',false);
end
$d4$;

revoke all on function private.net_eu_tubifici1_d5_publish(integer,boolean)
 from public,anon,authenticated,service_role;

