-- SP2 Steel Pulse — server-only, default-deny news feed staging.
-- No approval, crawler schedule, public feed or publication RPC is created here.
create schema if not exists steel_pulse_private;
revoke all on schema steel_pulse_private from public, anon, authenticated;
grant usage on schema steel_pulse_private to service_role;

create table steel_pulse_private.sources (
  id text primary key check (id ~ '^[a-z0-9_-]{2,50}$'),
  display_name text not null check (char_length(display_name) between 2 and 140),
  origin_url text not null check (origin_url ~ '^https://'),
  allowed_hosts text[] not null check (cardinality(allowed_hosts) between 1 and 8),
  channel text not null check (channel in ('official_api','publication','press_room','editorial_site')),
  status text not null default 'candidate' check (status in ('candidate','approved','suspended','prohibited')),
  license_basis text not null default 'unverified'
    check (license_basis in ('unverified','verified_open_license','verified_public_reuse','explicit_written_agreement')),
  approved_operations text[] not null default '{}'::text[],
  feed_url text check (feed_url is null or (char_length(feed_url) <= 1024 and feed_url ~ '^https://')),
  policy_url text,
  approval_evidence_url text,
  approval_reason text check (approval_reason is null or char_length(approval_reason) between 12 and 2000),
  reviewer_user_id uuid references auth.users(id) on delete restrict,
  legal_reviewer_user_id uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  approval_expires_at timestamptz,
  terms_reviewed_at timestamptz,
  fetch_interval_minutes int not null default 1440 check (fetch_interval_minutes between 60 and 10080),
  updated_at timestamptz not null default now(),
  check (approved_operations <@ array[
    'discover_metadata','ingest_statistical_data','summarize_facts','publish_news_card','reuse_media'
  ]::text[]),
  check (status <> 'approved' or (
    feed_url is not null and policy_url is not null and approval_evidence_url is not null
    and approval_reason is not null and reviewer_user_id is not null and legal_reviewer_user_id is not null
    and approved_at is not null and approval_expires_at > approved_at
    and terms_reviewed_at is not null and license_basis <> 'unverified'
    and 'discover_metadata' = any(approved_operations)
  ))
);

create table steel_pulse_private.source_rights_ledger (
  id bigint generated always as identity primary key,
  source_id text not null references steel_pulse_private.sources(id) on delete restrict,
  previous_status text not null,
  next_status text not null,
  actor_user_id uuid references auth.users(id) on delete restrict,
  policy_url text,
  evidence_url text,
  decision_reason text not null check (char_length(decision_reason) between 5 and 2000),
  decided_at timestamptz not null default now()
);
create index source_rights_ledger_source_decided_idx
  on steel_pulse_private.source_rights_ledger(source_id, decided_at desc);

create function steel_pulse_private.sp2_deny_ledger_changes()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'SP2 source rights ledger is append only' using errcode='42501';
end;
$$;
create trigger sp2_rights_ledger_immutable
before update or delete on steel_pulse_private.source_rights_ledger
for each row execute function steel_pulse_private.sp2_deny_ledger_changes();

-- No rights approval RPC in SP2. Platform legal + editor approval workflow is a separate gate.
create table steel_pulse_private.fetch_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references steel_pulse_private.sources(id) on delete restrict,
  state text not null default 'running' check (state in ('running','succeeded','failed')),
  started_at timestamptz not null default now(),
  lease_expires_at timestamptz not null default (now()+interval '5 minutes'),
  finished_at timestamptz,
  discovered_count int not null default 0 check (discovered_count >= 0 and discovered_count <= 25),
  inserted_count int not null default 0 check (inserted_count >= 0 and inserted_count <= 25),
  failure_code text check (failure_code is null or (char_length(failure_code) <= 48 and failure_code ~ '^[a-z_]+$'))
);
create index sp2_fetch_runs_source_started_idx
  on steel_pulse_private.fetch_runs(source_id, started_at desc);
create unique index sp2_one_running_lease_per_source
  on steel_pulse_private.fetch_runs(source_id) where state = 'running';

create table steel_pulse_private.items (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references steel_pulse_private.sources(id) on delete restrict,
  canonical_url text not null unique check (char_length(canonical_url) between 12 and 1024),
  source_guid_hash text check (source_guid_hash is null or source_guid_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_run_id uuid not null references steel_pulse_private.fetch_runs(id) on delete restrict,
  rights_evidence_url text not null,
  editorial_state text not null default 'staged' check (editorial_state in ('staged','held','rejected')),
  check (last_seen_at >= first_seen_at)
);
create index sp2_items_source_published_idx
  on steel_pulse_private.items(source_id, published_at desc);
create index sp2_items_state_first_seen_idx
  on steel_pulse_private.items(editorial_state, first_seen_at desc);

alter table steel_pulse_private.sources enable row level security;
alter table steel_pulse_private.source_rights_ledger enable row level security;
alter table steel_pulse_private.fetch_runs enable row level security;
alter table steel_pulse_private.items enable row level security;
revoke all on all tables in schema steel_pulse_private from public, anon, authenticated;
grant select, insert, update on steel_pulse_private.sources to service_role;
grant select, insert on steel_pulse_private.source_rights_ledger to service_role;
grant select, insert, update on steel_pulse_private.fetch_runs to service_role;
grant select, insert, update on steel_pulse_private.items to service_role;

insert into steel_pulse_private.sources(id,display_name,origin_url,allowed_hosts,channel,status)
values
('eurostat','Eurostat','https://ec.europa.eu/eurostat/',array['ec.europa.eu'],'official_api','candidate'),
('oecd','OECD','https://www.oecd.org/',array['www.oecd.org','oecd.org'],'publication','candidate'),
('worldsteel','World Steel Association','https://worldsteel.org/',array['worldsteel.org','www.worldsteel.org'],'press_room','candidate'),
('eurofer','EUROFER','https://www.eurofer.eu/',array['www.eurofer.eu','eurofer.eu'],'press_room','candidate'),
('siderweb','siderweb','https://www.siderweb.com/',array['www.siderweb.com','siderweb.com'],'editorial_site','candidate'),
('steelorbis','SteelOrbis','https://www.steelorbis.com/',array['www.steelorbis.com','steelorbis.com'],'editorial_site','prohibited')
on conflict (id) do nothing;

insert into steel_pulse_private.source_rights_ledger(
  source_id,previous_status,next_status,decision_reason
)
select id,status,status,'SP1 research baseline: source remains disabled'
from steel_pulse_private.sources
on conflict do nothing;

-- Any later source-rights edit writes an append-only audit record, in the same transaction.
-- Approval must be backed by reviewer identities and an explicit rationale.
create function steel_pulse_private.sp2_audit_source_rights()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    insert into steel_pulse_private.source_rights_ledger(
      source_id,previous_status,next_status,actor_user_id,
      policy_url,evidence_url,decision_reason
    ) values (
      new.id,old.status,new.status,(select auth.uid()),
      new.policy_url,new.approval_evidence_url,
      coalesce(new.approval_reason,'Source rights changed without activation')
    );
  end if;
  return new;
end;
$$;
create trigger sp2_source_rights_change_audit
after update on steel_pulse_private.sources
for each row execute function steel_pulse_private.sp2_audit_source_rights();

-- Executed only with the Supabase service-role JWT; not exposed to normal sessions.
create function public.sp2_begin_feed_run(p_source_id text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare s steel_pulse_private.sources%rowtype; r uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'SP2 service role required' using errcode='42501';
  end if;
  select * into s from steel_pulse_private.sources where id = p_source_id for update;
  if not found or s.status <> 'approved' or s.license_basis = 'unverified'
    or s.approval_expires_at <= now()
    or s.approval_evidence_url is null or s.approval_reason is null or s.policy_url is null
    or s.reviewer_user_id is null or s.legal_reviewer_user_id is null
    or s.terms_reviewed_at is null
    or s.terms_reviewed_at < now() - interval '90 days'
    or s.feed_url is null or not ('discover_metadata' = any(s.approved_operations))
  then
    return jsonb_build_object('allowed',false,'reason','source_not_authorized');
  end if;
  -- Fail closed for an abandoned lease until it is explicitly marked failed.
  if exists(select 1 from steel_pulse_private.fetch_runs
    where source_id=p_source_id and state='running') then
    return jsonb_build_object('allowed',false,'reason','run_already_in_progress');
  end if;
  if exists(select 1 from steel_pulse_private.fetch_runs
    where source_id=p_source_id and started_at > now() - (s.fetch_interval_minutes * interval '1 minute')) then
    return jsonb_build_object('allowed',false,'reason','rate_limit');
  end if;
  insert into steel_pulse_private.fetch_runs(source_id)
  values (p_source_id) returning id into r;
  return jsonb_build_object('allowed',true,'run_id',r,
    'feed_url',s.feed_url,'allowed_hosts',s.allowed_hosts,
    'license_basis',s.license_basis,'policy_url',s.policy_url,
    'approval_evidence_url',s.approval_evidence_url);
end;
$$;
revoke all on function public.sp2_begin_feed_run(text) from public,anon,authenticated;
grant execute on function public.sp2_begin_feed_run(text) to service_role;

create function public.sp2_finish_feed_run(
  p_run_id uuid, p_items jsonb default '[]'::jsonb, p_failure_code text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r steel_pulse_private.fetch_runs%rowtype;
        s steel_pulse_private.sources%rowtype;
        item jsonb; v_url text; v_host text; v_inserted int := 0;
        v_discovered int := 0; v_seen int := 0; v_published timestamptz;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'SP2 service role required' using errcode='42501';
  end if;
  select * into r from steel_pulse_private.fetch_runs where id=p_run_id for update;
  if not found or r.state <> 'running' then
    raise exception 'SP2 run missing or already finalized' using errcode='22023';
  end if;
  if p_failure_code is not null then
    if p_failure_code !~ '^[a-z_]{3,48}$' then
      raise exception 'invalid failure code' using errcode='22023';
    end if;
    update steel_pulse_private.fetch_runs set state='failed',
      finished_at=now(),failure_code=p_failure_code where id=p_run_id;
    return jsonb_build_object('ok',true,'state','failed');
  end if;
  select * into s from steel_pulse_private.sources where id=r.source_id for update;
  if r.lease_expires_at <= now() or s.status <> 'approved'
    or s.approval_expires_at <= now()
    or s.approval_evidence_url is null or s.approval_reason is null
    or s.terms_reviewed_at < now() - interval '90 days'
    or not ('discover_metadata' = any(s.approved_operations)) then
    raise exception 'source rights or lease no longer valid' using errcode='42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) > 25 then
    raise exception 'invalid feed metadata batch' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object'
      or item ? 'body' or item ? 'description' or item ? 'html' or item ? 'title' then
      raise exception 'raw article text not accepted' using errcode='22023';
    end if;
    v_url := item->>'canonical_url';
    v_host := lower(substring(v_url from '^https://([a-zA-Z0-9.-]+)(?:/|$)'));
    if v_host is null or not (v_host = any(s.allowed_hosts))
      or char_length(v_url) > 1024
      or v_url ~ '[[:space:]#?]' then
      raise exception 'invalid canonical source URL' using errcode='22023';
    end if;
    if item ? 'published_at' then
      v_published := (item->>'published_at')::timestamptz;
    else
      v_published := null;
    end if;
    if item ? 'source_guid_hash' and
      (item->>'source_guid_hash') !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid guid fingerprint' using errcode='22023';
    end if;
    v_discovered := v_discovered + 1;
    insert into steel_pulse_private.items(
      source_id, canonical_url, source_guid_hash,published_at,
      first_run_id, rights_evidence_url
    ) values (
      s.id,v_url,item->>'source_guid_hash',v_published,
      r.id,s.approval_evidence_url
    )
    on conflict (canonical_url) do update
      set last_seen_at=now()
      where steel_pulse_private.items.source_id=excluded.source_id;
    get diagnostics v_seen = row_count;
    -- Existing items and inserts both count as processed. Count inserts separately below.
  end loop;
  select count(*) into v_inserted
  from steel_pulse_private.items where first_run_id=r.id;
  update steel_pulse_private.fetch_runs
    set state='succeeded',finished_at=now(),
        discovered_count=v_discovered,inserted_count=v_inserted
    where id=r.id;
  return jsonb_build_object('ok',true,'state','succeeded',
    'discovered',v_discovered,'inserted',v_inserted,
    'duplicates',v_discovered-v_inserted);
end;
$$;
revoke all on function public.sp2_finish_feed_run(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.sp2_finish_feed_run(uuid,jsonb,text) to service_role;

comment on schema steel_pulse_private is
'SP2 restricted source-rights registry and staging. No public feed or automatic crawler enabled.';
