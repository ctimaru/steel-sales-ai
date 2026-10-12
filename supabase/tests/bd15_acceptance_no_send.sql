-- BD15: assert the real Chrome E2E exercise performed NO dispatch or Marketplace publish.
-- Runs only against ephemeral CI PostgreSQL on 127.0.0.1:54322.
\set ON_ERROR_STOP on
do $verify$
declare
  v_count integer;
  v_bad integer;
begin
  select count(*) into v_count
  from public.buyer_rfq_campaigns
  where title in ('BD15 E2E LOCAL 390','BD15 E2E LOCAL 1440')
    and status='draft' and marketplace_request_id is null;
  if v_count<>2 then raise exception 'BD15 expected two saved private draft campaigns; got %',v_count; end if;

  select count(*) into v_count
  from public.buyer_distintas d
  join public.buyer_rfq_campaigns r on r.source_distinta_id=d.id
  where r.title in ('BD15 E2E LOCAL 390','BD15 E2E LOCAL 1440')
    and d.line_count=2 and abs(d.total_meters-72)<0.01;
  if v_count<>2 then raise exception 'BD15 calculator→snapshot incorrect'; end if;

  select count(*) into v_count
  from public.buyer_rfq_campaigns r
  join public.buyer_rfq_suppliers s on s.rfq_id=r.id
  where r.title in ('BD15 E2E LOCAL 390','BD15 E2E LOCAL 1440');
  if v_count<>4 then raise exception 'BD15 expected exactly 2 selected recipients per RFQ, got %',v_count; end if;

  select count(*) into v_bad
  from public.buyer_rfq_campaigns r
  left join public.buyer_rfq_dispatches dis on dis.rfq_id=r.id
  where r.title in ('BD15 E2E LOCAL 390','BD15 E2E LOCAL 1440')
    and dis.id is not null;
  if v_bad<>0 then raise exception 'BD15 unexpected email dispatch ledger rows'; end if;

  select count(*) into v_bad
  from public.buyer_rfq_campaigns r
  join public.buyer_distinta_lines l on l.distinta_id=r.source_distinta_id
  where r.title in ('BD15 E2E LOCAL 390','BD15 E2E LOCAL 1440')
    and l.standard_code not in ('EN 10219','EN 10210');
  if v_bad<>0 then raise exception 'BD15 wrong standards persisted'; end if;
end $verify$;
select 'BD15 E2E local-only acceptance: 2 private RFQs, 4 suppliers, 0 outbound messages, 0 Marketplace publications' as result;
