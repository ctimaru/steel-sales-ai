create table public.network_companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text null,
  normalized_legal_name text generated always as (
    lower(regexp_replace(btrim(legal_name), '\s+', ' ', 'g'))
  ) stored,
  country_code text not null,
  registration_id text null,
  vat_id text null,
  website_url text null,
  website_domain text null,
  description text null,
  publication_status text not null default 'draft',
  claimed_status text not null default 'unclaimed',
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,

  constraint network_companies_legal_name_length_check
    check (char_length(btrim(legal_name)) between 1 and 255),
  constraint network_companies_trading_name_length_check
    check (trading_name is null or char_length(btrim(trading_name)) between 1 and 255),
  constraint network_companies_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint network_companies_identifier_length_check
    check (
      (registration_id is null or char_length(registration_id) <= 128)
      and (vat_id is null or char_length(vat_id) <= 128)
    ),
  constraint network_companies_website_length_check
    check (
      (website_url is null or char_length(website_url) <= 500)
      and (website_domain is null or char_length(website_domain) <= 255)
    ),
  constraint network_companies_description_length_check
    check (description is null or char_length(description) <= 4000),
  constraint network_companies_publication_status_check
    check (publication_status in ('draft','pending_review','published','suspended','archived')),
  constraint network_companies_claimed_status_check
    check (claimed_status in ('unclaimed','pending','claimed','revoked')),
  constraint network_companies_verification_status_check
    check (verification_status in ('unverified','pending','verified','rejected','expired','revoked')),
  constraint network_companies_archive_integrity_check
    check (
      (publication_status = 'archived' and archived_at is not null)
      or (publication_status <> 'archived' and archived_at is null)
    )
);

create unique index network_companies_country_vat_uidx
  on public.network_companies (country_code, upper(vat_id))
  where vat_id is not null;

create unique index network_companies_country_registration_uidx
  on public.network_companies (country_code, upper(registration_id))
  where registration_id is not null;

create index network_companies_normalized_name_idx
  on public.network_companies (normalized_legal_name);

create index network_companies_country_idx
  on public.network_companies (country_code);

create index network_companies_website_domain_idx
  on public.network_companies (lower(website_domain))
  where website_domain is not null;

create index network_companies_publication_status_idx
  on public.network_companies (publication_status);

create table public.network_facilities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete restrict,
  name text not null,
  facility_type text not null,
  address_line_1 text null,
  address_line_2 text null,
  postal_code text null,
  city text null,
  region text null,
  country_code text not null,
  website_url text null,
  publication_status text not null default 'draft',
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,

  constraint network_facilities_name_length_check
    check (char_length(btrim(name)) between 1 and 255),
  constraint network_facilities_type_length_check
    check (char_length(btrim(facility_type)) between 1 and 100),
  constraint network_facilities_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint network_facilities_address_length_check
    check (
      (address_line_1 is null or char_length(address_line_1) <= 255)
      and (address_line_2 is null or char_length(address_line_2) <= 255)
      and (postal_code is null or char_length(postal_code) <= 40)
      and (city is null or char_length(city) <= 160)
      and (region is null or char_length(region) <= 160)
    ),
  constraint network_facilities_website_length_check
    check (website_url is null or char_length(website_url) <= 500),
  constraint network_facilities_publication_status_check
    check (publication_status in ('draft','pending_review','published','suspended','archived')),
  constraint network_facilities_verification_status_check
    check (verification_status in ('unverified','pending','verified','rejected','expired','revoked')),
  constraint network_facilities_archive_integrity_check
    check (
      (publication_status = 'archived' and archived_at is not null)
      or (publication_status <> 'archived' and archived_at is null)
    )
);

create index network_facilities_company_idx
  on public.network_facilities (company_id);

create index network_facilities_country_region_city_idx
  on public.network_facilities (country_code, region, city);

create index network_facilities_publication_status_idx
  on public.network_facilities (publication_status);

create table public.network_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.network_companies(id) on delete restrict,
  facility_id uuid null references public.network_facilities(id) on delete restrict,
  contact_type text not null,
  display_name text null,
  email text null,
  phone text null,
  website_url text null,
  publication_status text not null default 'draft',
  consent_basis text null,
  source_reference text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,

  constraint network_contacts_type_length_check
    check (char_length(btrim(contact_type)) between 1 and 100),
  constraint network_contacts_display_name_length_check
    check (display_name is null or char_length(display_name) <= 200),
  constraint network_contacts_channel_length_check
    check (
      (email is null or char_length(email) <= 320)
      and (phone is null or char_length(phone) <= 100)
      and (website_url is null or char_length(website_url) <= 500)
    ),
  constraint network_contacts_has_channel_check
    check (email is not null or phone is not null or website_url is not null),
  constraint network_contacts_publication_status_check
    check (publication_status in ('draft','pending_review','published','suspended','archived')),
  constraint network_contacts_governance_length_check
    check (
      (consent_basis is null or char_length(consent_basis) <= 500)
      and (source_reference is null or char_length(source_reference) <= 1000)
    ),
  constraint network_contacts_archive_integrity_check
    check (
      (publication_status = 'archived' and archived_at is not null)
      or (publication_status <> 'archived' and archived_at is null)
    )
);

create index network_contacts_company_idx
  on public.network_contacts (company_id);

create index network_contacts_facility_idx
  on public.network_contacts (facility_id)
  where facility_id is not null;

create index network_contacts_publication_status_idx
  on public.network_contacts (publication_status);

create or replace function private.network_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.network_touch_updated_at() from public;
revoke all on function private.network_touch_updated_at() from anon;
revoke all on function private.network_touch_updated_at() from authenticated;

create trigger network_companies_touch_updated_at
before update on public.network_companies
for each row execute function private.network_touch_updated_at();

create trigger network_facilities_touch_updated_at
before update on public.network_facilities
for each row execute function private.network_touch_updated_at();

create trigger network_contacts_touch_updated_at
before update on public.network_contacts
for each row execute function private.network_touch_updated_at();

alter table public.network_companies enable row level security;
alter table public.network_facilities enable row level security;
alter table public.network_contacts enable row level security;

revoke all on table public.network_companies from public;
revoke all on table public.network_companies from anon;
revoke all on table public.network_companies from authenticated;

revoke all on table public.network_facilities from public;
revoke all on table public.network_facilities from anon;
revoke all on table public.network_facilities from authenticated;

revoke all on table public.network_contacts from public;
revoke all on table public.network_contacts from anon;
revoke all on table public.network_contacts from authenticated;

grant select on table public.network_companies to authenticated;
grant select on table public.network_facilities to authenticated;
grant select on table public.network_contacts to authenticated;

grant select,insert,update,delete on table public.network_companies to service_role;
grant select,insert,update,delete on table public.network_facilities to service_role;
grant select,insert,update,delete on table public.network_contacts to service_role;

create policy "Authenticated users can read published network companies"
on public.network_companies
for select
to authenticated
using (publication_status = 'published');

create policy "Authenticated users can read published network facilities"
on public.network_facilities
for select
to authenticated
using (
  publication_status = 'published'
  and exists (
    select 1
    from public.network_companies c
    where c.id = company_id
      and c.publication_status = 'published'
  )
);

create policy "Authenticated users can read published network contacts"
on public.network_contacts
for select
to authenticated
using (
  publication_status = 'published'
  and exists (
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
