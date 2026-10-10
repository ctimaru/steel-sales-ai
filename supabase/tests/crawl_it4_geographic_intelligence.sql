-- CRAWL-IT4: temporary acceptance fixtures, no production changes.
begin;
do $$
declare v text;
begin
 insert into public.network_it_municipalities
 (istat_code,municipality_name,municipality_normalized,province_code,province_name,
  region_code,region_name,reference_date,source_url)
 values
 ('015146','Milano','milano','MI','Milano','03','Lombardia','2026-02-21','https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/'),
 ('001272','Torino','torino','TO','Torino','01','Piemonte','2026-02-21','https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/');
 -- fixture municipalities verify model behavior, never seed production via this test
 select istat_code into v from public.crawl_it4_match_municipality(' Milano ','MI');
 if v is distinct from '015146' then raise exception 'explicit municipality/province mismatch'; end if;
 if exists(select 1 from public.crawl_it4_match_municipality('Milano',null)) then
   raise exception 'city without province incorrectly matched';
 end if;
 if exists(select 1 from public.crawl_it4_match_municipality('Milano','TO')) then
   raise exception 'wrong province incorrectly matched';
 end if;
 if exists(select 1 from public.crawl_it4_match_municipality('Roma','MI')) then
   raise exception 'unknown municipality incorrectly matched';
 end if;
end $$;
rollback;
