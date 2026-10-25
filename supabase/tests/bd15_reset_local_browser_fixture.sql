-- LOCAL CI ONLY: called with psql -h 127.0.0.1 -p 54322 against disposable Supabase.
-- Run only after bd15_acceptance_no_send.sql passes. Preserve every other fixture.
\set ON_ERROR_STOP on
begin;

create temporary table bd15_local_browser_ids (
  id uuid primary key,
  source_distinta_id uuid not null unique
) on commit drop;

insert into bd15_local_browser_ids (id,source_distinta_id)
select id,source_distinta_id
from public.buyer_rfq_campaigns
where organization_id='00000000-0000-0000-0000-000000023301'::uuid
  and title in ('BD15 E2E LOCAL 390','BD15 E2E LOCAL 1440')
for update;

do $guard$
begin
  if (select count(*) from bd15_local_browser_ids) <> 2 then
    raise exception 'BD15 reset requires exactly two local browser campaigns';
  end if;
  if exists (
    select 1 from public.buyer_rfq_campaigns r
    join bd15_local_browser_ids fixture on fixture.id=r.id
    where r.status<>'draft' or r.marketplace_request_id is not null or r.launched_at is not null
  ) then
    raise exception 'BD15 reset requires private, unlaunched draft campaigns';
  end if;
  if (select count(distinct r.title) from public.buyer_rfq_campaigns r
      join bd15_local_browser_ids fixture on fixture.id=r.id) <> 2 then
    raise exception 'BD15 reset requires one desktop and one mobile campaign';
  end if;
  if (select count(*) from public.buyer_distintas d
      join bd15_local_browser_ids fixture on fixture.source_distinta_id=d.id
      join public.buyer_rfq_campaigns r on r.id=fixture.id
      where d.organization_id='00000000-0000-0000-0000-000000023301'::uuid
        and d.owner_user_id=r.owner_user_id and d.title=r.title
        and d.title in ('BD15 E2E LOCAL 390','BD15 E2E LOCAL 1440')) <> 2 then
    raise exception 'BD15 reset requires exactly the two matching private source bills';
  end if;
  if exists (
    select 1 from public.buyer_rfq_dispatches dispatch
    join bd15_local_browser_ids fixture on fixture.id=dispatch.rfq_id
  ) or exists (
    select 1 from public.buyer_distinta_deliveries delivery
    join bd15_local_browser_ids fixture on fixture.source_distinta_id=delivery.distinta_id
  ) or exists (
    select 1 from public.buyer_rfq_marketplace_bridges bridge
    join bd15_local_browser_ids fixture on fixture.id=bridge.rfq_id
  ) then
    raise exception 'BD15 reset refuses dispatched, delivered or published fixtures';
  end if;
  if exists (
    select 1 from public.buyer_rfq_campaigns r
    join bd15_local_browser_ids fixture on fixture.source_distinta_id=r.source_distinta_id
    where r.id<>fixture.id
  ) then
    raise exception 'BD15 reset refuses source bills shared with another campaign';
  end if;
end $guard$;

do $reset$
declare
  removed integer;
begin
  -- Supplier targets/activity cascade from these campaign IDs. Bills are retained
  -- until the campaign FK has been removed, then deleted by the captured IDs.
  delete from public.buyer_rfq_campaigns r
  using bd15_local_browser_ids fixture
  where r.id=fixture.id;
  get diagnostics removed = row_count;
  if removed<>2 then raise exception 'BD15 reset did not remove exactly two campaigns'; end if;

  delete from public.buyer_distintas d
  using bd15_local_browser_ids fixture
  where d.id=fixture.source_distinta_id;
  get diagnostics removed = row_count;
  if removed<>2 then raise exception 'BD15 reset did not remove exactly two source bills'; end if;
end $reset$;

commit;
select 'BD15 local browser reset: exactly two verified private campaigns and source bills removed' as result;
