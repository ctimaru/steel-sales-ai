-- NET-EU-TUBIFICI1.C1 — European physical tube manufacturing proofs and
-- bounded minimal publisher. Does NOT modify Italian AUTO2/AUTO3 or claim legal
-- verification, producer confirmation, exact technical dimensions or PDF rights.
-- Analyst source observations are separate from machine first-party identity.
create table if not exists private.net_eu_tubifici1_manufacturing_proofs (
  candidate_id uuid primary key references public.network_company_discovery_candidates(id) on delete restrict,
  identity_evidence_id uuid not null references private.net_eu_tubifici1_identity_evidence(id) on delete restrict,
  factory_country_code text not null check (factory_country_code ~ '^[A-Z]{2}$' and factory_country_code <> 'IT'),
  factory_city text check (factory_city is null or char_length(factory_city) between 2 and 160),
  process_code text not null check (process_code in (
    'seamless_hot_rolled','seamless_hot_rolled_cold_drawn',
    'welded_longitudinal_uoe','welded_stainless_hollow_sections',
    'cold_formed_tubes_profiles','welded_steel_tubes','group_division_unspecified'
  )),
  source_url text not null check (char_length(source_url) <= 2000 and source_url ~* '^https://'),
  source_kind text not null check (source_kind in ('first_party_html','related_group_firstparty')),
  proof_note text not null check (char_length(proof_note) between 20 and 600),
  proof_status text not null check (proof_status in ('qualified_firstparty','hold_group_entity','hold_legal_identity','hold_factory_site')),
  checked_at timestamptz not null default now(),
  published_company_id uuid unique references public.network_companies(id) on delete restrict,
  published_at timestamptz,
  check ((published_company_id is null and published_at is null)
      or (published_company_id is not null and published_at is not null))
);
alter table private.net_eu_tubifici1_manufacturing_proofs enable row level security;
revoke all on private.net_eu_tubifici1_manufacturing_proofs from public,anon,authenticated;
grant select, insert, update on private.net_eu_tubifici1_manufacturing_proofs to service_role;

create table if not exists private.net_eu_tubifici1_publication_ledger (
  candidate_id uuid primary key references public.network_company_discovery_candidates(id) on delete restrict,
  company_id uuid not null unique references public.network_companies(id) on delete restrict,
  identity_evidence_id uuid not null references private.net_eu_tubifici1_identity_evidence(id) on delete restrict,
  source_url text not null,
  published_at timestamptz not null default now(),
  release_contract text not null default 'net-eu-tubifici1-c1-factory-v1'
);
alter table private.net_eu_tubifici1_publication_ledger enable row level security;
revoke all on private.net_eu_tubifici1_publication_ledger from public,anon,authenticated;
grant select on private.net_eu_tubifici1_publication_ledger to service_role;

-- No public/browsable publisher permission. Inside this explicitly scoped
-- project, only service_role (GitHub protected workflow) or postgres maintenance
-- may invoke. No normal user JWT or delegated browser JWT may release records.
create or replace function private.net_eu_tubifici1_publish(
  p_max integer default 6, p_commit boolean default false
)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_row record;
  v_eligible int := 0;
  v_published int := 0;
  v_company uuid;
  v_assertion uuid;
  v_facility uuid;
  v_role uuid;
  v_subtype uuid;
  v_product uuid;
  v_list jsonb := '[]'::jsonb;
begin
  if not (
    (session_user='postgres' and auth.uid() is null)
    or (auth.role()='service_role' and auth.uid() is null)
  ) then
    raise exception 'Maintenance or server-only EU release required'
      using errcode='42501';
  end if;
  if p_max is null or p_max not between 1 and 8 or p_commit is null then
    raise exception 'Bounded release required' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(810021,20263);
  select id into v_role from public.network_company_roles
    where canonical_key='producer' and status='active';
  select id into v_subtype from public.network_company_subtypes
    where canonical_key='tube_pipe_producer' and status='active';
  select id into v_product from public.network_product_families
    where canonical_key='tubes_pipes' and status='active';
  if v_role is null or v_subtype is null or v_product is null then
    raise exception 'Missing active producer taxonomy'
      using errcode='22023';
  end if;

  for v_row in
    select c.id candidate_id,c.legal_name,c.country_code,c.canonical_domain,
      c.website_url,c.run_id,c.source_url candidate_source_url,
      m.source_url proof_url,m.factory_country_code,m.factory_city,
      m.process_code,m.proof_note,m.identity_evidence_id
    from public.network_company_discovery_candidates c
    join public.network_company_discovery_runs r on r.id=c.run_id
    join private.net_eu_tubifici1_manufacturing_proofs m on m.candidate_id=c.id
    join private.net_eu_tubifici1_identity_evidence e on e.id=m.identity_evidence_id
       and e.candidate_id=c.id and e.run_id=c.run_id
       and e.country_code=c.country_code
    where c.extraction_version='net-eu-tubifici1-bridge-v1'
      and r.extraction_version='net-eu-tubifici1-bridge-v1'
      and r.source_reference='net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01'
      and c.country_code=r.country_code and c.country_code<>'IT'
      and c.review_status='pending_review' and c.governance_status='unreviewed'
      and c.role_keys @> array['producer']::text[]
      and not c.personal_data_detected and cardinality(c.personal_data_fields)=0
      and not c.quality_flags && array['group_or_legal_entity_review']::text[]
      and m.published_company_id is null and m.published_at is null
      and m.proof_status='qualified_firstparty'
      and m.source_kind='first_party_html'
      and m.factory_country_code=c.country_code
      and m.checked_at > now()-interval '30 days'
      and lower(regexp_replace(split_part(split_part(m.source_url,'/',3),':',1),'^www[.]',''))=lower(c.canonical_domain)
      and e.verdict='observed_match' and e.name_matched
      and e.page_sha256 is not null
      and e.source_rights_state='unknown'
      and e.last_checked_at>now()-interval '30 days'
      and e.observed_name=c.legal_name
      and not exists (select 1 from private.net_eu_tubifici1_publication_ledger l
                      where l.candidate_id=c.id)
      and not exists (
        select 1 from public.network_companies n
        where n.publication_status<>'archived'
          and (lower(regexp_replace(coalesce(n.website_domain,''),'^www[.]',''))=lower(c.canonical_domain)
            or (n.country_code=c.country_code and
              lower(regexp_replace(btrim(n.legal_name),'[^[:alnum:]]','','g'))
              = lower(regexp_replace(btrim(c.legal_name),'[^[:alnum:]]','','g')))
          )
      )
      and not exists (select 1 from public.network_netfast3_suppressed_domains s
                      where lower(s.domain)=lower(c.canonical_domain))
    order by c.country_code,c.canonical_domain
    limit p_max for update of c skip locked
  loop
    v_eligible:=v_eligible+1;
    v_list:=v_list||jsonb_build_array(jsonb_build_object(
      'candidate_id',v_row.candidate_id,'company',v_row.legal_name,
      'country',v_row.country_code,'factory_city',v_row.factory_city));
    if not p_commit then continue; end if;

    -- Only factual, minimal claimable profile, not a 'verified company' badge.
    insert into public.network_companies(
      legal_name,country_code,website_url,website_domain,
      publication_status,claimed_status,verification_status
    ) values (
      v_row.legal_name,v_row.country_code,v_row.website_url,
      lower(v_row.canonical_domain),'published','unclaimed','unverified'
    ) returning id into v_company;

    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,
      source_reference,ownership_type,asserted_by,confidence,review_state
    ) values (
      'company',v_company,'eu_tube_factory_firstparty_observation',
      jsonb_build_object(
        'candidate_id',v_row.candidate_id,
        'factory_country',v_row.factory_country_code,
        'factory_city',v_row.factory_city,'process',v_row.process_code,
        'source_level','first_party_observed',
        'legal_registration_verified',false,
        'manufacturer_confirmed',false,'specific_dimensions_verified',false,
        'evidence_note',v_row.proof_note
      ),
      'public_web',v_row.proof_url,'platform_curated',null,0.94,'accepted'
    ) returning id into v_assertion;

    insert into public.network_company_role_assignments(
      company_id,role_id,is_primary,source_assertion_id)
    values(v_company,v_role,true,v_assertion);

    insert into public.network_company_subtype_assignments(
      company_id,subtype_id,source_assertion_id)
    values(v_company,v_subtype,v_assertion);

    v_facility:=null;
    if v_row.factory_city is not null then
      insert into public.network_facilities(
        company_id,name,facility_type,city,country_code,website_url,
        publication_status,verification_status
      ) values (
        v_company,'Tube manufacturing — '||v_row.factory_city,
        'manufacturing',v_row.factory_city,v_row.country_code,
        v_row.proof_url,'published','unverified'
      ) returning id into v_facility;
    end if;

    insert into public.network_company_products(
      company_id,product_family_id,relationship_type,facility_id,source_assertion_id
    ) values (v_company,v_product,'produces',v_facility,v_assertion);

    insert into private.net_eu_tubifici1_publication_ledger(
      candidate_id,company_id,identity_evidence_id,source_url)
    values(v_row.candidate_id,v_company,v_row.identity_evidence_id,v_row.proof_url);

    update public.network_company_discovery_candidates
    set review_status='published',reviewed_at=now(),reviewed_by=null,
        publication_actor_type='delegated_agent',
        promoted_company_id=v_company,
        review_note='EU1.C1: source-bound tube manufacturing, unclaimed and unverified legal entity'
    where id=v_row.candidate_id;

    update private.net_eu_tubifici1_manufacturing_proofs
    set published_company_id=v_company,published_at=now()
    where candidate_id=v_row.candidate_id;

    v_published:=v_published+1;
  end loop;
  return jsonb_build_object(
    'contract','net-eu-tubifici1-c1-factory-v1',
    'mode',case when p_commit then 'publish' else 'dry_run' end,
    'eligible',v_eligible,'published',v_published,
    'companies',v_list,'legal_certification',false,
    'manufacturer_confirmed',false,'exact_dimensions_verified',false
  );
end
$$;
revoke all on function private.net_eu_tubifici1_publish(integer,boolean) from public,anon,authenticated;
grant execute on function private.net_eu_tubifici1_publish(integer,boolean) to service_role;
create or replace function public.net_eu_tubifici1_publish(
  p_max integer default 6, p_commit boolean default false
)
returns jsonb language sql security invoker set search_path=''
as $$ select private.net_eu_tubifici1_publish(p_max,p_commit) $$;
revoke all on function public.net_eu_tubifici1_publish(integer,boolean) from public,anon,authenticated;
grant execute on function public.net_eu_tubifici1_publish(integer,boolean) to service_role;

comment on table private.net_eu_tubifici1_manufacturing_proofs is
  'Source URL and human-reviewed first-party physical tube manufacturing evidence. Corporate legal identity, producer confirmation and exact dimensions are NOT certified.';
comment on function private.net_eu_tubifici1_publish(integer,boolean) is
  'Maintenance/service-role-only bounded release of minimal first-party-evidenced European tube factories; retains unverified company status and source-bound audit.';
