-- SP2 acceptance: no approved sources, strict role boundary, transactional staging.
begin;
create or replace function pg_temp.sp2_check(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'SP2: %',message; end if;
end;
$$;

select pg_temp.sp2_check(
  (select count(*)=6 from steel_pulse_private.sources),
  'six seed sources are registered'
);
select pg_temp.sp2_check(
  not exists(select 1 from steel_pulse_private.sources where status='approved'
    or cardinality(approved_operations)>0 or feed_url is not null),
  'all initial sources disabled'
);
select pg_temp.sp2_check(
  (select status='prohibited' from steel_pulse_private.sources where id='steelorbis'),
  'restricted source prohibited'
);
select pg_temp.sp2_check(
  not has_table_privilege('anon','steel_pulse_private.items','SELECT') and
  not has_table_privilege('authenticated','steel_pulse_private.sources','SELECT') and
  not has_table_privilege('authenticated','steel_pulse_private.items','INSERT') and
  not has_schema_privilege('authenticated','steel_pulse_private','USAGE'),
  'tenant and public roles cannot access staged news'
);
select pg_temp.sp2_check(
  (select count(*)=4 from pg_class c
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='steel_pulse_private'
   and c.relname in ('sources','source_rights_ledger','fetch_runs','items') and c.relrowsecurity),
  'RLS enabled on every SP2 table'
);

do $$
begin
  begin
    update steel_pulse_private.source_rights_ledger
    set decision_reason='illegal overwrite' where source_id='oecd';
    raise exception 'SP2 immutable ledger update unexpectedly succeeded';
  exception when sqlstate '42501' then
    null;
  end;
end $$;

-- Service role JWT alone can invoke RPCs, but candidate sources are refused.
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.sp2_begin_feed_run('oecd') as candidate_result \gset
select pg_temp.sp2_check(
  (:'candidate_result'::jsonb->>'allowed')::boolean=false,
  'a candidate cannot begin a run'
);
reset role;

-- Deterministic synthetic source; all effects rolled back at test exit.
insert into auth.users(id,email) values
('00000000-0000-0000-0000-00000000b201','sp2-editor@example.test'),
('00000000-0000-0000-0000-00000000b202','sp2-legal@example.test')
on conflict (id) do nothing;

insert into steel_pulse_private.sources(
  id,display_name,origin_url,allowed_hosts,channel,status,
  license_basis,approved_operations,feed_url,policy_url,
  approval_evidence_url,approval_reason,reviewer_user_id,legal_reviewer_user_id,
  approved_at,approval_expires_at,terms_reviewed_at,fetch_interval_minutes
)
values (
  'test_sp2_feed','SP2 Synthetic Feed','https://news.example.org/',array['news.example.org'],
  'press_room','approved','explicit_written_agreement',
  array['discover_metadata'],
  'https://news.example.org/news.xml','https://news.example.org/terms',
  'https://news.example.org/approval','SP2 disposable rights approval for test fixture',
  '00000000-0000-0000-0000-00000000b201',
  '00000000-0000-0000-0000-00000000b202',
  now()-interval '1 day',now()+interval '7 days',now(),1440
);
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.sp2_begin_feed_run('test_sp2_feed') as allow_result \gset
select pg_temp.sp2_check(
  (:'allow_result'::jsonb->>'allowed')::boolean=true,
  'approved source must acquire bounded run'
);
select (:'allow_result'::jsonb->>'run_id') as run_id \gset

select public.sp2_begin_feed_run('test_sp2_feed') as denied_duplicate \gset
select pg_temp.sp2_check(
  (:'denied_duplicate'::jsonb->>'reason')='run_already_in_progress',
  'parallel leases refused'
);
select public.sp2_finish_feed_run(
  :'run_id'::uuid,
  '[{"canonical_url":"https://news.example.org/a","source_guid_hash":"a7f9d883e0c3a7f9d883e0c3a7f9d883e0c3a7f9d883e0c3a7f9d883e0c3a7f9"}]'::jsonb
) as finished_result \gset
select pg_temp.sp2_check(
  (:'finished_result'::jsonb->>'inserted')::int=1
  and (select count(*)=1 from steel_pulse_private.items
       where source_id='test_sp2_feed' and editorial_state='staged'),
  'metadata staged and NOT published'
);
select public.sp2_begin_feed_run('test_sp2_feed') as second_result \gset
select pg_temp.sp2_check(
  (:'second_result'::jsonb->>'reason')='rate_limit',
  'subsequent calls rate limited'
);
reset role;

select pg_temp.sp2_check(
  (select count(*)=6 from steel_pulse_private.source_rights_ledger
    where decision_reason='SP1 research baseline: source remains disabled'),
  'initial rights evidence created for seeds'
);
rollback;
