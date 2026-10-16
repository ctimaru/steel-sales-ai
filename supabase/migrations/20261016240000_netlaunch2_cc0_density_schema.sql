-- NET-LAUNCH2.0: accelerate the already-reviewed Wikidata CC0 source
-- into two sector queries / day; no new source approval or website crawling.
create table public.network_netlaunch2_cursors(
 industry_qid text primary key check(industry_qid in ('Q2285982','Q1924906','Q1957908','Q190117')),
 next_offset integer not null default 0 check(next_offset between 0 and 2000),
 updated_at timestamptz not null default now()
);
insert into public.network_netlaunch2_cursors(industry_qid)
values ('Q2285982'),('Q1924906'),('Q1957908'),('Q190117');
alter table public.network_netlaunch2_cursors enable row level security;
revoke all on public.network_netlaunch2_cursors from public,anon,authenticated;
grant select,update on public.network_netlaunch2_cursors to service_role;
create policy netlaunch2_cursors_deny_clients on public.network_netlaunch2_cursors
 as restrictive for all to anon,authenticated using(false) with check(false);

create table public.network_netlaunch2_runs(
 id uuid primary key default gen_random_uuid(),
 run_day date not null unique,
 industry_ids text[] not null,
 offsets jsonb not null,
 status text not null default 'claimed' check(status in ('claimed','completed')),
 claimed_at timestamptz not null default now(),
 finished_at timestamptz,
 queried integer not null default 0,
 accepted integer not null default 0,
 inserted integer not null default 0,
 skipped integer not null default 0,
 constraint netlaunch2_counter_bounds check(
  queried between 0 and 200 and accepted between 0 and queried
  and inserted between 0 and accepted and skipped between 0 and accepted)
);
alter table public.network_netlaunch2_runs enable row level security;
revoke all on public.network_netlaunch2_runs from public,anon,authenticated;
grant select,insert,update on public.network_netlaunch2_runs to service_role;
create policy netlaunch2_runs_deny_clients on public.network_netlaunch2_runs
 as restrictive for all to anon,authenticated using(false) with check(false);

do $$
declare n integer;
begin
 update public.network_discovery_source_registry
 set max_domains_per_run=200,minimum_interval_hours=24,updated_at=now()
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid
 and source_type='curated_public_source'
 and source_url='https://query.wikidata.org/sparql'
 and enabled_for_discovery and governance_status='approved'
 and terms_status='allows_reuse' and database_rights_status='low_risk'
 and personal_data_policy='exclude_personal_data'
 and rights_evidence_url='https://www.wikidata.org/wiki/Wikidata:Licensing'
 and reviewed_at is not null and reviewed_by is not null;
 get diagnostics n=row_count;
 if n<>1 and exists(select 1 from public.network_discovery_source_registry
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid)
 then raise exception 'NET-LAUNCH2 cannot expand source without existing rights' using errcode='42501';end if;
 -- Clean CI lacks a human-reviewed source. Nothing is auto-approved there.
end $$;
