create table public.network_company_role_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete restrict,
  role_id uuid not null references public.network_company_roles(id) on delete restrict,
  is_primary boolean not null default false,
  source_assertion_id uuid null,
  created_at timestamptz not null default now(),

  constraint network_company_role_assignments_company_role_unique
    unique (company_id, role_id)
);

create unique index network_company_role_assignments_one_primary_uidx
  on public.network_company_role_assignments (company_id)
  where is_primary = true;

create index network_company_role_assignments_role_idx
  on public.network_company_role_assignments (role_id);


create table public.network_company_subtype_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete restrict,
  subtype_id uuid not null references public.network_company_subtypes(id) on delete restrict,
  source_assertion_id uuid null,
  created_at timestamptz not null default now(),

  constraint network_company_subtype_assignments_company_subtype_unique
    unique (company_id, subtype_id)
);

create index network_company_subtype_assignments_subtype_idx
  on public.network_company_subtype_assignments (subtype_id);


create table public.network_company_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete restrict,
  product_family_id uuid not null references public.network_product_families(id) on delete restrict,
  relationship_type text not null,
  facility_id uuid null,
  source_assertion_id uuid null,
  created_at timestamptz not null default now(),

  constraint network_company_products_relationship_type_check
    check (relationship_type in ('produces','distributes','stocks','processes','uses')),
  constraint network_company_products_facility_company_fkey
    foreign key (facility_id, company_id)
    references public.network_facilities(id, company_id)
    on delete restrict
);

create unique index network_company_products_company_scope_uidx
  on public.network_company_products (company_id, product_family_id, relationship_type)
  where facility_id is null;

create unique index network_company_products_facility_scope_uidx
  on public.network_company_products (company_id, product_family_id, relationship_type, facility_id)
  where facility_id is not null;

create index network_company_products_product_family_idx
  on public.network_company_products (product_family_id);

create index network_company_products_facility_idx
  on public.network_company_products (facility_id)
  where facility_id is not null;

create index network_company_products_relationship_type_idx
  on public.network_company_products (relationship_type);


create table public.network_company_markets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete restrict,
  market_id uuid not null references public.network_markets(id) on delete restrict,
  source_assertion_id uuid null,
  created_at timestamptz not null default now(),

  constraint network_company_markets_company_market_unique
    unique (company_id, market_id)
);

create index network_company_markets_market_idx
  on public.network_company_markets (market_id);


create table public.network_facility_capabilities (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.network_facilities(id) on delete restrict,
  capability_id uuid not null references public.network_capabilities(id) on delete restrict,
  source_assertion_id uuid null,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now(),

  constraint network_facility_capabilities_facility_capability_unique
    unique (facility_id, capability_id),
  constraint network_facility_capabilities_verification_status_check
    check (verification_status in ('unverified','pending','verified','rejected','expired','revoked'))
);

create index network_facility_capabilities_capability_idx
  on public.network_facility_capabilities (capability_id);

create index network_facility_capabilities_verification_status_idx
  on public.network_facility_capabilities (verification_status);


create table public.network_company_certifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete restrict,
  facility_id uuid null,
  certification_type_id uuid not null references public.network_certification_types(id) on delete restrict,
  issuer text null,
  certificate_identifier text null,
  valid_from date null,
  valid_to date null,
  scope_text text null,
  verification_status text not null default 'unverified',
  evidence_reference text null,
  source_assertion_id uuid null,
  created_at timestamptz not null default now(),

  constraint network_company_certifications_facility_company_fkey
    foreign key (facility_id, company_id)
    references public.network_facilities(id, company_id)
    on delete restrict,
  constraint network_company_certifications_validity_check
    check (valid_from is null or valid_to is null or valid_to >= valid_from),
  constraint network_company_certifications_verification_status_check
    check (verification_status in ('unverified','pending','verified','rejected','expired','revoked')),
  constraint network_company_certifications_text_length_check
    check (
      (issuer is null or char_length(issuer) <= 255)
      and (certificate_identifier is null or char_length(certificate_identifier) <= 255)
      and (scope_text is null or char_length(scope_text) <= 4000)
      and (evidence_reference is null or char_length(evidence_reference) <= 1000)
    )
);

create index network_company_certifications_company_idx
  on public.network_company_certifications (company_id);

create index network_company_certifications_facility_idx
  on public.network_company_certifications (facility_id)
  where facility_id is not null;

create index network_company_certifications_type_idx
  on public.network_company_certifications (certification_type_id);

create index network_company_certifications_verification_status_idx
  on public.network_company_certifications (verification_status);


alter table public.network_company_role_assignments enable row level security;
alter table public.network_company_subtype_assignments enable row level security;
alter table public.network_company_products enable row level security;
alter table public.network_company_markets enable row level security;
alter table public.network_facility_capabilities enable row level security;
alter table public.network_company_certifications enable row level security;

revoke all on table public.network_company_role_assignments from public, anon, authenticated;
revoke all on table public.network_company_subtype_assignments from public, anon, authenticated;
revoke all on table public.network_company_products from public, anon, authenticated;
revoke all on table public.network_company_markets from public, anon, authenticated;
revoke all on table public.network_facility_capabilities from public, anon, authenticated;
revoke all on table public.network_company_certifications from public, anon, authenticated;

grant select on table public.network_company_role_assignments to authenticated;
grant select on table public.network_company_subtype_assignments to authenticated;
grant select on table public.network_company_products to authenticated;
grant select on table public.network_company_markets to authenticated;
grant select on table public.network_facility_capabilities to authenticated;
grant select on table public.network_company_certifications to authenticated;

grant select,insert,update,delete on table public.network_company_role_assignments to service_role;
grant select,insert,update,delete on table public.network_company_subtype_assignments to service_role;
grant select,insert,update,delete on table public.network_company_products to service_role;
grant select,insert,update,delete on table public.network_company_markets to service_role;
grant select,insert,update,delete on table public.network_facility_capabilities to service_role;
grant select,insert,update,delete on table public.network_company_certifications to service_role;

create policy "Authenticated users can read published network company roles"
on public.network_company_role_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.network_companies c
    where c.id = company_id
      and c.publication_status = 'published'
  )
);

create policy "Authenticated users can read published network company subtypes"
on public.network_company_subtype_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.network_companies c
    where c.id = company_id
      and c.publication_status = 'published'
  )
);

create policy "Authenticated users can read published network company products"
on public.network_company_products
for select
to authenticated
using (
  exists (
    select 1
    from public.network_companies c
    where c.id = company_id
      and c.publication_status = 'published'
  )
  and (
    facility_id is null
    or exists (
      select 1
      from public.network_facilities f
      where f.id = facility_id
        and f.publication_status = 'published'
    )
  )
);

create policy "Authenticated users can read published network company markets"
on public.network_company_markets
for select
to authenticated
using (
  exists (
    select 1
    from public.network_companies c
    where c.id = company_id
      and c.publication_status = 'published'
  )
);

create policy "Authenticated users can read published network facility capabilities"
on public.network_facility_capabilities
for select
to authenticated
using (
  exists (
    select 1
    from public.network_facilities f
    join public.network_companies c on c.id = f.company_id
    where f.id = facility_id
      and f.publication_status = 'published'
      and c.publication_status = 'published'
  )
);

create policy "Authenticated users can read published network company certifications"
on public.network_company_certifications
for select
to authenticated
using (
  exists (
    select 1
    from public.network_companies c
    where c.id = company_id
      and c.publication_status = 'published'
  )
  and (
    facility_id is null
    or exists (
      select 1
      from public.network_facilities f
      where f.id = facility_id
        and f.publication_status = 'published'
    )
  )
);

comment on column public.network_company_role_assignments.source_assertion_id is
  'Reserved for M4 network_data_assertions FK; nullable and intentionally unenforced in M3.';
comment on column public.network_company_subtype_assignments.source_assertion_id is
  'Reserved for M4 network_data_assertions FK; nullable and intentionally unenforced in M3.';
comment on column public.network_company_products.source_assertion_id is
  'Reserved for M4 network_data_assertions FK; nullable and intentionally unenforced in M3.';
comment on column public.network_company_markets.source_assertion_id is
  'Reserved for M4 network_data_assertions FK; nullable and intentionally unenforced in M3.';
comment on column public.network_facility_capabilities.source_assertion_id is
  'Reserved for M4 network_data_assertions FK; nullable and intentionally unenforced in M3.';
comment on column public.network_company_certifications.source_assertion_id is
  'Reserved for M4 network_data_assertions FK; nullable and intentionally unenforced in M3.';
