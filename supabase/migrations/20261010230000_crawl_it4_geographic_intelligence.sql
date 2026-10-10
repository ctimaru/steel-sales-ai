-- CRAWL-IT4: versioned Italian municipal reference, evidence-preserving reconciliation.
-- ISTAT canonical export is loaded in a separate, reviewed import: never fake codes.
create table if not exists public.network_it_municipalities (
 istat_code text primary key check (istat_code ~ '^[0-9]{6}$'),
 municipality_name text not null,
 municipality_normalized text not null,
 province_code text not null check (province_code ~ '^[A-Z]{2}$'),
 province_name text not null,
 region_code text not null check (region_code ~ '^[0-9]{2}$'),
 region_name text not null,
 reference_date date not null,
 source_url text not null,
 created_at timestamptz not null default now()
);
create index if not exists network_it_municipality_lookup_idx
 on public.network_it_municipalities(municipality_normalized,province_code);
create index if not exists network_it_municipality_region_idx
 on public.network_it_municipalities(region_code,province_code);
alter table public.network_it_municipalities enable row level security;
revoke all on public.network_it_municipalities from public,anon,authenticated;
grant select,insert,update on public.network_it_municipalities to service_role;

-- Never overwrite existing published facilities: retain geocoding proposals for review.
create table if not exists public.network_it_facility_geo_reviews (
 id uuid primary key default gen_random_uuid(),
 facility_id uuid not null references public.network_facilities(id) on delete cascade,
 proposed_istat_code text not null references public.network_it_municipalities(istat_code),
 source_url text not null,
 matching_basis text not null check (matching_basis in ('municipality_and_province','official_istat_code')),
 status text not null default 'pending_review'
   check (status in ('pending_review','approved','rejected')),
 reviewed_by uuid null references auth.users(id),
 reviewed_at timestamptz null,
 review_note text,
 created_at timestamptz not null default now(),
 unique (facility_id,proposed_istat_code)
);
alter table public.network_it_facility_geo_reviews enable row level security;
revoke all on public.network_it_facility_geo_reviews from public,anon,authenticated;
grant select,insert,update on public.network_it_facility_geo_reviews to service_role;
create index if not exists network_it_facility_geo_reviews_status_idx
 on public.network_it_facility_geo_reviews(status,created_at);

-- A matching municipal name ALONE is never enough for precise geolocation.
-- Read-only deterministic resolution requires explicit municipality AND province.
create or replace function public.crawl_it4_match_municipality(
 p_city text,p_province_code text
) returns table(istat_code text, municipality_name text, province_code text, region_name text,reference_date date)
language sql stable security invoker set search_path=''
as $$
 select m.istat_code,m.municipality_name,m.province_code,m.region_name,m.reference_date
 from public.network_it_municipalities m
 where p_city is not null and p_province_code ~ '^[A-Za-z]{2}$'
   and m.municipality_normalized=lower(btrim(regexp_replace(p_city,'[[:space:]]+',' ','g')))
   and m.province_code=upper(p_province_code)
 order by m.istat_code limit 2;
$$;
revoke all on function public.crawl_it4_match_municipality(text,text) from public,anon,authenticated;
grant execute on function public.crawl_it4_match_municipality(text,text) to service_role;
