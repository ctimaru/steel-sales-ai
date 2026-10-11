-- CRAWL-IT4.1 geographic reconciliation readiness, read-only.
-- No municipality match is inferred from city alone.
select
  count(*) as active_facilities,
  count(*) filter (where country_code='IT') as italian_facilities,
  count(*) filter (where country_code='IT' and nullif(btrim(city),'') is not null) as with_city,
  count(*) filter (where country_code='IT' and nullif(btrim(region),'') is not null) as with_unverified_region_label,
  count(*) filter (where country_code='IT' and nullif(btrim(postal_code),'') is not null) as with_postcode
from public.network_facilities
where archived_at is null;

-- Match readiness remains 0 until official reference import and evidenced province codes:
-- network_facilities has no approved province_code column today.
select
  count(*) as official_municipalities_loaded,
  count(distinct region_code) as covered_regions,
  count(distinct province_code) as covered_provinces,
  min(reference_date) as oldest_reference_date,
  max(reference_date) as newest_reference_date
from public.network_it_municipalities;

-- Proposed facility corrections are separate, never automatic updates.
select status,count(*) as proposals
from public.network_it_facility_geo_reviews
group by status order by status;
