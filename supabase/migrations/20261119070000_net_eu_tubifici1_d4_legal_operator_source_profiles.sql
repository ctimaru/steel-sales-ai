-- NET-EU-TUBIFICI1.D4 — Publish SOURCE-BOUND operators, not ambiguous group labels.
-- Six already researched candidates map to six independently identified legal
-- manufacturing operators. No group/division is asserted as a legal company.
-- No third-party HTML/PDF is copied: only original factual summaries, URLs,
-- registered company identifiers, product families and documented locations.
-- ARATUBO's webpage-reuse restriction is explicitly respected: the primary
-- published manufacturing source is an independently registered EPD listing.
-- Does not change any PA1.5 or Italian AUTO2/AUTO3 function/trigger.

create table if not exists private.net_eu_tubifici1_d4_operator_sources (
 candidate_id uuid primary key references public.network_company_discovery_candidates(id) on delete restrict,
 operator_legal_name text not null check(char_length(operator_legal_name) between 6 and 255),
 operator_trading_name text check(operator_trading_name is null or char_length(operator_trading_name) between 4 and 255),
 operator_registration_id text not null check(char_length(operator_registration_id) between 4 and 128),
 operator_vat_id text,
 legal_source_url text not null check(legal_source_url ~* '^https://' and char_length(legal_source_url)<=2000),
 factory_source_url text not null check(factory_source_url ~* '^https://' and char_length(factory_source_url)<=2000),
 source_kind text not null check(source_kind in ('first_party','government_registry','independent_epd')),
 process_code text not null check(process_code in
    ('welded_steel_tubes','precision_seamless_and_welded_tubes','seamless_tubes_unspecified')),
 factory_city text check(factory_city is null or char_length(factory_city) between 2 and 160),
 factual_note text not null check(char_length(factual_note) between 24 and 500),
 company_id uuid unique references public.network_companies(id) on delete restrict,
 published_at timestamptz,
 check ((company_id is null and published_at is null) or
        (company_id is not null and published_at is not null))
);
alter table private.net_eu_tubifici1_d4_operator_sources enable row level security;
revoke all on private.net_eu_tubifici1_d4_operator_sources from public,anon,authenticated;
grant select on private.net_eu_tubifici1_d4_operator_sources to service_role;

-- A finite source-verified cohort. The source URL is a provenance link, not a
-- license to reproduce or claim the contents of the underlying document.
insert into private.net_eu_tubifici1_d4_operator_sources(
 candidate_id,operator_legal_name,operator_trading_name,operator_registration_id,operator_vat_id,
 legal_source_url,factory_source_url,source_kind,process_code,factory_city,factual_note
)
select
 v.candidate_id::uuid,v.operator_legal_name,v.operator_trading_name,v.operator_registration_id,v.operator_vat_id,
 v.legal_source_url,v.factory_source_url,v.source_kind,v.process_code,v.factory_city,v.factual_note
from (values
 ('ff0725ba-b894-4833-8bf6-edf453177be5',
  'Mannesmann Precision Tubes GmbH',null,'HRB 20198',null,
  'https://www.mannesmann.com/en/contact/legal-notice.html',
  'https://www.mannesmann.com/en/locations.html','first_party',
  'precision_seamless_and_welded_tubes','Hamm',
  'The named German operator has a company imprint and identified steel precision tube manufacturing sites; no size or grade range is inferred.'),
 ('0d9fb502-44e0-4594-bf7c-5cedaedd1863',
  'ARATUBO S.A.U.',null,'A01242627','A01242627',
  'https://environdec.com/library/epd23048',
  'https://environdec.com/library/epd23048','independent_epd',
  'welded_steel_tubes','Vitoria-Gasteiz',
  'Independent EPD registry identifies ARATUBO as manufacturer of precision welded steel tubes; no website content is reproduced.'),
 ('3b150f09-86d0-402a-bbd3-9e706f68a8da',
  'ARCELORMITTAL TUBULAR PRODUCTS HAUTMONT','ArcelorMittal Tubular Products — Hautmont',
  '784689499',null,
  'https://annuaire-entreprises.data.gouv.fr/entreprise/arcelormittal-tubular-products-hautmont-784689499',
  'https://tubulareurope.arcelormittal.com/index.php/production-sites/automotive',
  'government_registry','welded_steel_tubes','Hautmont',
  'French public business registry names the Hautmont legal operator; official ArcelorMittal sources associate this factory with tube operations.'),
 ('b4c98821-db2f-483f-95c6-7db8f4c38ebc',
  'TATA STEEL UK LIMITED','Tata Steel — Tubes UK',
  '02280000',null,
  'https://find-and-update.company-information.service.gov.uk/company/02280000',
  'https://www.tatasteeluk.com/about-us/our-operations',
  'government_registry','welded_steel_tubes','Corby',
  'UK Companies House names the operator; the official Tata Steel UK operations site documents welded tube manufacturing at Corby.'),
 ('d4df3aa1-5877-4a5a-8b2f-996b0c598cfe',
  'FERPINTA - INDUSTRIAS DE TUBOS DE AÇO DE FERNANDO PINHO TEIXEIRA S.A.',
  'FERPINTA','500113009','500113009',
  'https://transparencia.gov.pt/en/fundos-europeus/prr/beneficiarios-projetos/beneficiario/500113009/',
  'https://www.ferpinta.pt/pt/',
  'government_registry','welded_steel_tubes',null,
  'Portuguese public government record identifies FERPINTA and its NIF; its first-party site documents welded steel tube production.'),
 ('63f070bd-1427-4dc6-a2c3-4f141f08beed',
  'Alleima Tube AB',null,'556234-6832',null,
  'https://www.alleima.com/en/about-this-site/data-privacy-portal/list-of-alleima-entities/',
  'https://www.alleima.com/en/technical-center/material-datasheets/bar-and-hollow-bar/bar/sanmac-2205/',
  'first_party','seamless_tubes_unspecified','Sandviken',
  'Alleima corporate entity listing identifies Alleima Tube AB; its first-party manufacturing description locates the operator in Sandviken.')
) as v(candidate_id,operator_legal_name,operator_trading_name,operator_registration_id,operator_vat_id,
       legal_source_url,factory_source_url,source_kind,process_code,factory_city,factual_note)
join public.network_company_discovery_candidates c on c.id=v.candidate_id::uuid
join private.net_eu_tubifici1_d3_recovery d on d.candidate_id=c.id
where c.review_status='pending_review'
  and c.country_code<>'IT'
  and d.manufacturing_observed
on conflict(candidate_id) do nothing;

comment on table private.net_eu_tubifici1_d4_operator_sources is
 'Six source-specific EU legal tube operator reconciliations. Original group research candidates remain auditable without pretending they were corporate entities.';

create or replace function private.net_eu_tubifici1_d4_publish(
 p_max integer default 6,p_commit boolean default false
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
    or p_max is null or p_max not between 1 and 6 or p_commit is null then
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
  from private.net_eu_tubifici1_d4_operator_sources s
  join public.network_company_discovery_candidates c on c.id=s.candidate_id
  join public.network_company_discovery_runs r on r.id=c.run_id
  join private.net_eu_tubifici1_d3_recovery d on d.candidate_id=c.id
  where s.company_id is null and s.published_at is null
    and c.review_status='pending_review'
    and c.governance_status='unreviewed'
    and c.publication_actor_type='platform'
    and c.country_code<>'IT' and c.country_code=r.country_code
    and c.extraction_version='net-eu-tubifici1-bridge-v1'
    and r.extraction_version='net-eu-tubifici1-bridge-v1'
    and r.source_reference in
       ('net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01',
        'net-eu-tubifici1:NET-EU-TUBIFICI-20261118-02')
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
    and d.manufacturing_observed
    and d.last_checked_at>now()-interval '30 days'
    and s.factory_source_url ~* '^https://'
    and s.legal_source_url ~* '^https://'
    and (
      (c.canonical_domain='aratubo.com' and d.reuse_restricted
         and s.source_kind='independent_epd'
         and s.factory_source_url='https://environdec.com/library/epd23048'
         and s.legal_source_url=s.factory_source_url)
      or (not d.reuse_restricted
         and s.source_kind in ('first_party','government_registry')
         and lower(regexp_replace(
             split_part(split_part(s.factory_source_url,'/',3),':',1),'^www[.]',''))
             = lower(c.canonical_domain))
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
   update private.net_eu_tubifici1_d4_operator_sources
     set company_id=v_company,published_at=now()
     where candidate_id=v_row.candidate_id;

   -- Deliberately do NOT make the original parent/division candidate
   -- impersonate the newly published legal operator. Linked evidence and
   -- audit release ledger record the reconciliation instead.
   v_published:=v_published+1;
 end loop;
 return jsonb_build_object('contract','net-eu-tubifici1-d4-operators-v1',
  'mode',case when p_commit then 'publish' else 'dry_run' end,
  'eligible',v_eligible,'published',v_published,
  'operators',v_items,'legal_entity_certified',false,
  'exact_technical_dimensions',false);
end
$d4$;

revoke all on function private.net_eu_tubifici1_d4_publish(integer,boolean)
 from public,anon,authenticated,service_role;

-- Preserve the original EU evidence access rule and its authorization checks.
-- Append only an accepted, https source-bound observation on a PUBLISHED
-- canonical company; no private seeds, raw HTML, contact or pending rows.
do $patch$
declare v_def text;
 v_old constant text:=' return jsonb_build_object(''contract'',''netprofile1d-evidence-v1'',''items'',v_items);';
 v_new constant text:=$patchbody$
 if exists(select 1 from public.network_companies n
   where n.id=p_company_id and n.publication_status='published'
     and n.archived_at is null) then
   select v_items||coalesce(jsonb_agg(jsonb_build_object(
       'field_key','industrial_source',
       'field_value',jsonb_build_object('observed',true),
       'evidence_url',a.source_reference,
       'fetched_at',a.captured_at)
      order by a.captured_at desc),'[]'::jsonb)
   into v_items
   from (
     select distinct on (a.source_reference)
       a.source_reference,a.captured_at
     from public.network_data_assertions a
     where a.entity_type='company' and a.entity_id=p_company_id
       and a.field_path in (
         'eu_tube_factory_firstparty_observation',
         'eu_tube_factory_reconciled_operator')
       and a.source_type='public_web'
       and a.ownership_type='platform_curated'
       and a.review_state='accepted'
       and a.source_reference ~* '^https://'
     order by a.source_reference,a.captured_at desc
     limit 5
   ) a;
 end if;
 return jsonb_build_object('contract','netprofile1d-evidence-v1','items',v_items);
$patchbody$;
begin
 select pg_catalog.pg_get_functiondef('public.netprofile1d_profile_evidence(uuid,uuid,text)'::regprocedure)
 into v_def;
 if v_def is null or pg_catalog.strpos(v_def,v_old)=0
   or pg_catalog.strpos(v_def,'industrial_source')>0 then
  raise exception 'EU D4 profile evidence contract drift: refusing unsafe patch';
 end if;
 execute pg_catalog.replace(v_def,v_old,v_new);
end $patch$;

comment on function private.net_eu_tubifici1_d4_publish(integer,boolean) is
 'EU D4: postgres-maintenance-only six documented legal manufacturers, distinct from original discovery labels. No general PA1.5 exception.';
