-- COMM-UX6.B / LOCAL synthetic visual density only.
-- Invoked exclusively by FLOW1 with psql -h 127.0.0.1 -p 54322 after original E2E tests.
-- These fixed IDs must NEVER be used on hosted Supabase.
\set ON_ERROR_STOP on
begin;

insert into public.buyer_distintas
 (id,owner_user_id,organization_id,title,line_count,total_meters,total_tonnes)
select
 ('00000000-0000-0000-0000-' || lpad((67000 + n)::text,12,'0'))::uuid,
 :'buyer_user_id'::uuid,
 '00000000-0000-0000-0000-000000023301'::uuid,
 'COMMUX6B Distinta ' || lpad(n::text,2,'0') || ' — Test materiali',
 1,72,1.8
from generate_series(1,8) as s(n);

insert into public.buyer_distinta_lines
 (id,distinta_id,line_position,description,standard_code,grade_code,quantity_mode,quantity,bar_length_m,weight_kg_m,line_meters,line_tonnes)
select
 ('00000000-0000-0000-0000-' || lpad((67100 + n)::text,12,'0'))::uuid,
 ('00000000-0000-0000-0000-' || lpad((67000 + n)::text,12,'0'))::uuid,
 1,
 case when n % 2 = 0 then 'RHS 200x100x6' else 'SHS 100x100x5' end,
 'EN 10219','S355J2H','bars',12,6,25,72,1.8
from generate_series(1,8) as s(n);

insert into public.buyer_rfq_campaigns
 (id,owner_user_id,organization_id,source_distinta_id,title,status,due_at)
select
 ('00000000-0000-0000-0000-' || lpad((67200 + n)::text,12,'0'))::uuid,
 :'buyer_user_id'::uuid,
 '00000000-0000-0000-0000-000000023301'::uuid,
 ('00000000-0000-0000-0000-' || lpad((67000 + n)::text,12,'0'))::uuid,
 'COMMUX6B RFQ ' || lpad(n::text,2,'0') || ' · ' ||
 case when n % 2 = 0 then 'RHS 200x100x6' else 'SHS 100x100x5' end ||
 ' S355J2H EN 10219 — 12 barre da 6 metri',
 'draft', now() + interval '14 days'
from generate_series(1,8) as s(n);

do $$
begin
 if (select count(*) from public.buyer_rfq_campaigns
     where organization_id='00000000-0000-0000-0000-000000023301'
     and title like 'COMMUX6B RFQ %') <> 8 then
   raise exception 'COMM-UX6.B: expected 8 synthetic buyer campaigns';
 end if;
end $$;
commit;
select 'COMM-UX6.B: eight company-private synthetic deals ready for local visual acceptance' as result;
