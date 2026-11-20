-- HOME-REVIEW1 / CPOST4: «Gamma lavorabile» on capacity posts. Optional, trimmed,
-- max 80 characters, only on capacity; the other types and rules are unchanged.
begin;

create or replace function pg_temp.c4_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'CPOST4 assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.c4_error(p_type text, p_details jsonb)
returns text language plpgsql as $$
begin
  perform private.cpost2_normalize_details(p_type, p_details);
  return 'ACCEPTED';
exception when others then
  return sqlerrm;
end;
$$;

select pg_temp.c4_assert(
  private.cpost2_normalize_details('capacity', '{"process":"curvatura","range":"  Ø 20–114 mm, sp. fino a 6 mm  "}'::jsonb)
    ->> 'range' = 'Ø 20–114 mm, sp. fino a 6 mm',
  'range kept and trimmed'
);
select pg_temp.c4_assert(
  not (private.cpost2_normalize_details('capacity', '{"process":"taglio"}'::jsonb) ? 'range'),
  'range is optional'
);
select pg_temp.c4_assert(
  pg_temp.c4_error('capacity', jsonb_build_object('process', 'taglio', 'range', repeat('x', 81))) <> 'ACCEPTED',
  'range longer than 80 characters is refused'
);
select pg_temp.c4_assert(
  not (private.cpost2_normalize_details('stock', '{"product":"Tubo","range":"x"}'::jsonb) ? 'range'),
  'range is a capacity field only'
);
select pg_temp.c4_assert(
  pg_temp.c4_error('capacity', '{"process":"nope","range":"x"}'::jsonb) like '%invalid capacity process%',
  'capacity rules unchanged'
);
select pg_temp.c4_assert(
  private.cpost2_normalize_details('capacity', '{"process":"laser","quantity":"200 t/mese","location":"Brescia"}'::jsonb)
    = '{"process":"laser","quantity":"200 t/mese","location":"Brescia"}'::jsonb,
  'existing fields unchanged'
);

rollback;
