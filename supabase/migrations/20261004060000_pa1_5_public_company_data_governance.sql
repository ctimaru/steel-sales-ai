-- PA1.5 — Public Company Data Governance & Legal Gate
--
-- This migration does not make the Network public. It adds a fail-closed
-- publication/enrichment gate around public-web discovery and a minimal public
-- correction/removal intake. Source visibility is never treated as a reuse licence.

alter table public.network_company_discovery_runs
  add column if not exists governance_status text not null default 'unreviewed',
  add column if not exists terms_status text not null default 'not_checked',
  add column if not exists database_rights_status text not null default 'not_assessed',
  add column if not exists personal_data_policy text not null default 'not_assessed',
  add column if not exists governance_reviewed_by uuid null references auth.users(id) on delete restrict,
  add column if not exists governance_reviewed_at timestamptz null,
  add column if not exists governance_note text null;

alter table public.network_company_discovery_runs
  drop constraint if exists network_company_discovery_runs_pa15_governance_check;
alter table public.network_company_discovery_runs
  add constraint network_company_discovery_runs_pa15_governance_check
  check (
    governance_status in ('unreviewed','approved','restricted','blocked')
    and terms_status in (
      'not_checked','allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
    )
    and database_rights_status in (
      'not_assessed','low_risk','licensed','restricted','unknown'
    )
    and personal_data_policy in (
      'not_assessed','company_data_only','exclude_personal_data','legal_review_required'
    )
    and (governance_note is null or char_length(governance_note)<=4000)
    and (
      (governance_status='unreviewed'
        and governance_reviewed_by is null
        and governance_reviewed_at is null)
      or
      (governance_status<>'unreviewed'
        and governance_reviewed_by is not null
        and governance_reviewed_at is not null)
    )
  );

alter table public.network_company_discovery_candidates
  add column if not exists governance_status text not null default 'unreviewed',
  add column if not exists personal_data_detected boolean not null default false,
  add column if not exists personal_data_fields text[] not null default '{}'::text[],
  add column if not exists governance_reviewed_by uuid null references auth.users(id) on delete restrict,
  add column if not exists governance_reviewed_at timestamptz null,
  add column if not exists governance_note text null;

alter table public.network_company_discovery_candidates
  drop constraint if exists network_company_discovery_candidates_pa15_governance_check;
alter table public.network_company_discovery_candidates
  add constraint network_company_discovery_candidates_pa15_governance_check
  check (
    governance_status in (
      'unreviewed','approved_company_data','needs_legal_review','blocked'
    )
    and cardinality(personal_data_fields)<=32
    and array_position(personal_data_fields,null) is null
    and (governance_note is null or char_length(governance_note)<=4000)
    and (
      (governance_status='unreviewed'
        and governance_reviewed_by is null
        and governance_reviewed_at is null)
      or
      (governance_status<>'unreviewed'
        and governance_reviewed_by is not null
        and governance_reviewed_at is not null)
    )
    and (
      governance_status<>'approved_company_data'
      or (not personal_data_detected and cardinality(personal_data_fields)=0)
    )
  );

create index if not exists network_discovery_runs_governance_idx
  on public.network_company_discovery_runs(governance_status,created_at desc);

create index if not exists network_discovery_candidates_governance_idx
  on public.network_company_discovery_candidates(governance_status,created_at desc);

create table if not exists public.network_data_governance_events (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (
    subject_type in ('discovery_run','discovery_candidate','public_data_request')
  ),
  subject_id uuid not null,
  action text not null check (
    action in (
      'source_governance_reviewed',
      'candidate_governance_reviewed',
      'public_data_request_received',
      'public_data_request_reviewed'
    )
  ),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('platform','public_requester','system')),
  before_state jsonb null,
  after_state jsonb not null,
  note text null check (note is null or char_length(note)<=4000),
  occurred_at timestamptz not null default now()
);

alter table public.network_data_governance_events enable row level security;
revoke all on table public.network_data_governance_events from public,anon,authenticated;
grant select,insert on table public.network_data_governance_events to service_role;

create index if not exists network_data_governance_events_subject_idx
  on public.network_data_governance_events(subject_type,subject_id,occurred_at desc);

create or replace function private.pa1_5_governance_event_immutable_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'PA1.5 governance events are immutable'
    using errcode='55000';
end;
$function$;

revoke all on function private.pa1_5_governance_event_immutable_guard()
  from public,anon,authenticated;

drop trigger if exists network_data_governance_events_immutable
  on public.network_data_governance_events;

create trigger network_data_governance_events_immutable
before update or delete on public.network_data_governance_events
for each row execute function private.pa1_5_governance_event_immutable_guard();

create table if not exists public.company_data_governance_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('correction','removal','source_question')),
  company_name text not null check (char_length(btrim(company_name)) between 2 and 255),
  country_code text null check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  contact_email text null check (
    contact_email is null or (
      char_length(contact_email) between 5 and 320
      and position('@' in contact_email) > 1
      and position('.' in split_part(contact_email,'@',2)) > 1
    )
  ),
  source_url text null check (
    source_url is null or (char_length(source_url)<=2000 and source_url ~* '^https?://')
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (status in ('received','in_review','resolved','rejected')),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or (status in ('resolved','rejected') and reviewed_by is not null and reviewed_at is not null and resolved_at is not null)
  )
);
alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=nullif(lower(btrim(coalesce(p_contact_email,''))),'');
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if v_email is not null and (
    char_length(v_email) not between 5 and 320
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if v_email is not null and (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal business-data correction, removal or source-question intake. Contact email is optional and never public; this channel does not replace formal privacy-rights procedures.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=lower(btrim(coalesce(p_contact_email,'')));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','privacy_objection','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if char_length(v_email) not between 5 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

  ) then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=lower(btrim(coalesce(p_contact_email,'')));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','privacy_objection','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if char_length(v_email) not between 5 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=nullif(lower(btrim(coalesce(p_contact_email,''))),'');
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if v_email is not null and (
    char_length(v_email) not between 5 and 320
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if v_email is not null and (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal business-data correction, removal or source-question intake. Contact email is optional and never public; this channel does not replace formal privacy-rights procedures.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=lower(btrim(coalesce(p_contact_email,'')));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','privacy_objection','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if char_length(v_email) not between 5 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

  ) then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=lower(btrim(coalesce(p_contact_email,'')));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','privacy_objection','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if char_length(v_email) not between 5 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

  ) then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if v_email is not null and (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal business-data correction, removal or source-question intake. Contact email is optional and never public; this channel does not replace formal privacy-rights procedures.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=lower(btrim(coalesce(p_contact_email,'')));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','privacy_objection','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if char_length(v_email) not between 5 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

  ) then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=lower(btrim(coalesce(p_contact_email,'')));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','privacy_objection','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if char_length(v_email) not between 5 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=nullif(lower(btrim(coalesce(p_contact_email,''))),'');
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if v_email is not null and (
    char_length(v_email) not between 5 and 320
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if v_email is not null and (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal business-data correction, removal or source-question intake. Contact email is optional and never public; this channel does not replace formal privacy-rights procedures.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=lower(btrim(coalesce(p_contact_email,'')));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','privacy_objection','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if char_length(v_email) not between 5 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

  ) then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';

    )
  ),
  source_url text null check (
    source_url is null
    or (
      char_length(source_url)<=2000
      and source_url ~* '^https?://'
    )
  ),
  request_text text not null check (char_length(btrim(request_text)) between 10 and 4000),
  status text not null default 'received' check (
    status in ('received','in_review','resolved','rejected')
  ),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null check (review_note is null or char_length(review_note)<=4000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint company_data_governance_requests_review_integrity_check check (
    (status='received' and reviewed_by is null and reviewed_at is null and resolved_at is null)
    or
    (status='in_review' and reviewed_by is not null and reviewed_at is not null and resolved_at is null)
    or
    (status in ('resolved','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
      and resolved_at is not null)
  )
);

alter table public.company_data_governance_requests enable row level security;
revoke all on table public.company_data_governance_requests from public,anon,authenticated;
grant select,insert,update on table public.company_data_governance_requests to service_role;

create index if not exists company_data_governance_requests_status_idx
  on public.company_data_governance_requests(status,created_at desc);

create index if not exists company_data_governance_requests_email_created_idx
  on public.company_data_governance_requests(lower(contact_email),created_at desc);

-- PA1.5 source/legal review is intentionally root-only at launch. It can be
-- delegated later only after a dedicated legal/data-governance operating role exists.
insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'discovery.governance_review',
  'discovery',
  'governance_review',
  'critical',
  'Approve or block reuse/publication of discovery sources and candidate company data.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.pa1_5_review_discovery_run_governance_impl(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in ('approved','restricted','blocked') then
    raise exception 'invalid PA1.5 source governance decision' using errcode='22023';
  end if;
  if p_terms_status not in (
    'allows_reuse','allows_limited_reuse','restricts_reuse','unknown'
  ) then
    raise exception 'invalid PA1.5 terms status' using errcode='22023';
  end if;
  if p_database_rights_status not in (
    'low_risk','licensed','restricted','unknown'
  ) then
    raise exception 'invalid PA1.5 database-rights status' using errcode='22023';
  end if;
  if p_personal_data_policy not in (
    'company_data_only','exclude_personal_data','legal_review_required'
  ) then
    raise exception 'invalid PA1.5 personal-data policy' using errcode='22023';
  end if;

  if p_decision='approved' and (
    p_terms_status not in ('allows_reuse','allows_limited_reuse')
    or p_database_rights_status not in ('low_risk','licensed')
    or p_personal_data_policy not in ('company_data_only','exclude_personal_data')
  ) then
    raise exception 'approved source requires reusable terms, acceptable database rights and a company-data-only policy'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=p_run_id
  for update;

  if not found then
    raise exception 'discovery run not found' using errcode='P0002';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy
  );

  update public.network_company_discovery_runs
  set
    governance_status=p_decision,
    terms_status=p_terms_status,
    database_rights_status=p_database_rights_status,
    personal_data_policy=p_personal_data_policy,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_run_id
  returning * into v_run;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_run',p_run_id,'source_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_run.governance_status,
      'terms_status',v_run.terms_status,
      'database_rights_status',v_run.database_rights_status,
      'personal_data_policy',v_run.personal_data_policy
    ),
    v_note
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'governance_status',v_run.governance_status,
    'terms_status',v_run.terms_status,
    'database_rights_status',v_run.database_rights_status,
    'personal_data_policy',v_run.personal_data_policy,
    'publication_source_ready',(v_run.governance_status='approved')
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_run_governance_impl(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_run_governance(
  p_run_id uuid,
  p_decision text,
  p_terms_status text,
  p_database_rights_status text,
  p_personal_data_policy text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_run_governance_impl(
    p_run_id,p_decision,p_terms_status,p_database_rights_status,
    p_personal_data_policy,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_run_governance(
  uuid,text,text,text,text,text
) to authenticated,service_role;

create or replace function private.pa1_5_review_discovery_candidate_governance_impl(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_candidate public.network_company_discovery_candidates%rowtype;
  v_run public.network_company_discovery_runs%rowtype;
  v_note text;
  v_fields text[];
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_decision not in (
    'approved_company_data','needs_legal_review','blocked'
  ) then
    raise exception 'invalid PA1.5 candidate governance decision' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct btrim(f) order by btrim(f)),'{}'::text[])
  into v_fields
  from unnest(coalesce(p_personal_data_fields,'{}'::text[])) f
  where f is not null and btrim(f)<>'';

  if cardinality(v_fields)>32 then
    raise exception 'too many personal-data field markers' using errcode='22023';
  end if;

  if p_decision='approved_company_data'
     and (coalesce(p_personal_data_detected,false) or cardinality(v_fields)>0) then
    raise exception 'candidate with personal data cannot be approved as company-data-only'
      using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'governance note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;

  select * into v_run
  from public.network_company_discovery_runs
  where id=v_candidate.run_id;

  if p_decision='approved_company_data' and v_run.governance_status<>'approved' then
    raise exception 'source governance must be approved before candidate approval'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
  );

  update public.network_company_discovery_candidates
  set
    governance_status=p_decision,
    personal_data_detected=coalesce(p_personal_data_detected,false),
    personal_data_fields=v_fields,
    governance_reviewed_by=v_user_id,
    governance_reviewed_at=now(),
    governance_note=v_note
  where id=p_candidate_id
  returning * into v_candidate;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'discovery_candidate',p_candidate_id,'candidate_governance_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object(
      'governance_status',v_candidate.governance_status,
      'personal_data_detected',v_candidate.personal_data_detected,
      'personal_data_fields',to_jsonb(v_candidate.personal_data_fields)
    ),
    v_note
  );

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'governance_status',v_candidate.governance_status,
    'personal_data_detected',v_candidate.personal_data_detected,
    'personal_data_fields',to_jsonb(v_candidate.personal_data_fields),
    'publication_candidate_ready',(
      v_candidate.governance_status='approved_company_data'
      and not v_candidate.personal_data_detected
    )
  );
end;
$function$;

revoke all on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) from public,anon,authenticated;
grant execute on function private.pa1_5_review_discovery_candidate_governance_impl(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function public.pa1_5_review_discovery_candidate_governance(
  p_candidate_id uuid,
  p_decision text,
  p_personal_data_detected boolean default false,
  p_personal_data_fields text[] default '{}'::text[],
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_discovery_candidate_governance_impl(
    p_candidate_id,p_decision,p_personal_data_detected,p_personal_data_fields,p_note
  );
$function$;

revoke all on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) from public,anon;
grant execute on function public.pa1_5_review_discovery_candidate_governance(
  uuid,text,boolean,text[],text
) to authenticated,service_role;

create or replace function private.pa1_5_discovery_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_run public.network_company_discovery_runs%rowtype;
begin
  if old.review_status='pending_review'
     and new.review_status in ('published','enriched_existing') then

    select * into v_run
    from public.network_company_discovery_runs
    where id=new.run_id;

    if not found
       or v_run.governance_status<>'approved'
       or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
       or v_run.database_rights_status not in ('low_risk','licensed')
       or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
       or new.governance_status<>'approved_company_data'
       or new.personal_data_detected
       or cardinality(new.personal_data_fields)>0 then
      raise exception 'PA1.5 governance gate blocks publication/enrichment'
        using errcode='42501',
              detail='source and candidate governance approval are required before materialization';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_5_discovery_publication_guard()
  from public,anon,authenticated;

drop trigger if exists pa1_5_discovery_publication_guard
  on public.network_company_discovery_candidates;

create trigger pa1_5_discovery_publication_guard
before update of review_status on public.network_company_discovery_candidates
for each row execute function private.pa1_5_discovery_publication_guard();

create or replace function private.pa1_5_discovery_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.read');
  v_limit:=least(greatest(coalesce(p_limit,250),1),500);

  return jsonb_build_object(
    'runs',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id as run_id,
          r.governance_status,
          r.terms_status,
          r.database_rights_status,
          r.personal_data_policy,
          r.governance_reviewed_at,
          r.governance_note,
          r.created_at
        from public.network_company_discovery_runs r
        order by r.created_at desc
        limit 100
      ) q
    ),'[]'::jsonb),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          c.id as candidate_id,
          c.run_id,
          c.governance_status,
          c.personal_data_detected,
          c.personal_data_fields,
          c.governance_reviewed_at,
          c.governance_note,
          (
            r.governance_status='approved'
            and r.terms_status in ('allows_reuse','allows_limited_reuse')
            and r.database_rights_status in ('low_risk','licensed')
            and r.personal_data_policy in ('company_data_only','exclude_personal_data')
            and c.governance_status='approved_company_data'
            and not c.personal_data_detected
            and cardinality(c.personal_data_fields)=0
          ) as publication_gate_ready,
          c.created_at
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        order by c.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'source_review_required',(
        select count(*) from public.network_company_discovery_runs
        where governance_status='unreviewed'
      ),
      'candidate_review_required',(
        select count(*) from public.network_company_discovery_candidates
        where review_status='pending_review'
          and governance_status='unreviewed'
      ),
      'publication_ready',(
        select count(*)
        from public.network_company_discovery_candidates c
        join public.network_company_discovery_runs r on r.id=c.run_id
        where c.review_status='pending_review'
          and r.governance_status='approved'
          and r.terms_status in ('allows_reuse','allows_limited_reuse')
          and r.database_rights_status in ('low_risk','licensed')
          and r.personal_data_policy in ('company_data_only','exclude_personal_data')
          and c.governance_status='approved_company_data'
          and not c.personal_data_detected
          and cardinality(c.personal_data_fields)=0
      )
    )
  );
end;
$function$;

revoke all on function private.pa1_5_discovery_governance_state_impl(integer)
  from public,anon;
grant execute on function private.pa1_5_discovery_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.pa1_5_discovery_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_discovery_governance_state_impl(p_limit);
$function$;

revoke all on function public.pa1_5_discovery_governance_state(integer)
  from public,anon;
grant execute on function public.pa1_5_discovery_governance_state(integer)
  to authenticated,service_role;

create schema if not exists public_intake_private;
revoke all on schema public_intake_private from public;
grant usage on schema public_intake_private to anon,authenticated,service_role;

create or replace function public_intake_private.pa1_5_submit_company_data_request_impl(
  p_request_type text,
  p_company_name text,
  p_country_code text,
  p_contact_email text,
  p_source_url text,
  p_request_text text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type text:=lower(btrim(coalesce(p_request_type,'')));
  v_company text:=btrim(coalesce(p_company_name,''));
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_email text:=lower(btrim(coalesce(p_contact_email,'')));
  v_url text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_text text:=btrim(coalesce(p_request_text,''));
begin
  if v_type not in ('correction','removal','privacy_objection','source_question') then
    raise exception 'invalid company-data request type' using errcode='22023';
  end if;
  if char_length(v_company) not between 2 and 255 then
    raise exception 'company name must contain 2..255 characters' using errcode='22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;
  if char_length(v_email) not between 5 and 320
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid contact email' using errcode='22023';
  end if;
  if v_url is not null and (
    char_length(v_url)>2000 or v_url !~* '^https?://'
  ) then
    raise exception 'source URL must be an absolute http(s) URL' using errcode='22023';
  end if;
  if char_length(v_text) not between 10 and 4000 then
    raise exception 'request text must contain 10..4000 characters' using errcode='22023';
  end if;

  if (
    select count(*)
    from public.company_data_governance_requests r
    where lower(r.contact_email)=v_email
      and r.created_at >= now()-interval '24 hours'
  ) >= 5 then
    raise exception 'too many company-data requests from this email'
      using errcode='P0001';
  end if;

  insert into public.company_data_governance_requests(
    request_type,company_name,country_code,contact_email,source_url,request_text
  )
  values(v_type,v_company,v_country,v_email,v_url,v_text)
  returning id into v_id;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',v_id,'public_data_request_received',
    null,'public_requester',null,
    jsonb_build_object('status','received','request_type',v_type),
    null
  );

  return jsonb_build_object(
    'ok',true,
    'request_id',v_id,
    'status','received'
  );
end;
$function$;

revoke all on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) from public;
grant execute on function public_intake_private.pa1_5_submit_company_data_request_impl(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function public.pa1_5_submit_company_data_request(
  p_request_type text,
  p_company_name text,
  p_country_code text default null,
  p_contact_email text default null,
  p_source_url text default null,
  p_request_text text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select public_intake_private.pa1_5_submit_company_data_request_impl(
    p_request_type,p_company_name,p_country_code,p_contact_email,p_source_url,p_request_text
  );
$function$;

revoke all on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) from public;
grant execute on function public.pa1_5_submit_company_data_request(
  text,text,text,text,text,text
) to anon,authenticated,service_role;

create or replace function private.pa1_5_company_data_request_queue_impl(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer;
begin
  perform private.require_platform_permission('discovery.governance_review');

  if p_status is not null
     and p_status not in ('received','in_review','resolved','rejected') then
    raise exception 'invalid company-data request status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          r.id,r.request_type,r.company_name,r.country_code,r.contact_email,
          r.source_url,r.request_text,r.status,r.reviewed_at,r.review_note,
          r.created_at,r.resolved_at
        from public.company_data_governance_requests r
        where p_status is null or r.status=p_status
        order by r.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'open_count',(
      select count(*)
      from public.company_data_governance_requests
      where status in ('received','in_review')
    )
  );
end;
$function$;

revoke all on function private.pa1_5_company_data_request_queue_impl(text,integer)
  from public,anon,authenticated;
grant execute on function private.pa1_5_company_data_request_queue_impl(text,integer)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_request_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_5_company_data_request_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.pa1_5_company_data_request_queue(text,integer)
  from public,anon;
grant execute on function public.pa1_5_company_data_request_queue(text,integer)
  to authenticated,service_role;

create or replace function private.pa1_5_review_company_data_request_impl(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_row public.company_data_governance_requests%rowtype;
  v_note text;
  v_before jsonb;
begin
  v_user_id:=(select auth.uid());
  perform private.require_platform_permission('discovery.governance_review');

  if p_status not in ('in_review','resolved','rejected') then
    raise exception 'invalid company-data request decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(coalesce(p_note,'')),'');
  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_row
  from public.company_data_governance_requests
  where id=p_request_id
  for update;

  if not found then
    raise exception 'company-data request not found' using errcode='P0002';
  end if;
  if v_row.status in ('resolved','rejected') then
    raise exception 'closed company-data request cannot be reopened through this action'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object('status',v_row.status);

  update public.company_data_governance_requests
  set
    status=p_status,
    reviewed_by=v_user_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=v_note,
    resolved_at=case when p_status in ('resolved','rejected') then now() else null end
  where id=p_request_id
  returning * into v_row;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
  )
  values(
    'public_data_request',p_request_id,'public_data_request_reviewed',
    v_user_id,'platform',v_before,
    jsonb_build_object('status',v_row.status),
    v_note
  );

  return jsonb_build_object(
    'request_id',p_request_id,
    'status',v_row.status,
    'reviewed_at',v_row.reviewed_at,
    'resolved_at',v_row.resolved_at
  );
end;
$function$;

revoke all on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.pa1_5_review_company_data_request_impl(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_review_company_data_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.pa1_5_review_company_data_request_impl(
    p_request_id,p_status,p_note
  );
$function$;

revoke all on function public.pa1_5_review_company_data_request(uuid,text,text)
  from public,anon;
grant execute on function public.pa1_5_review_company_data_request(uuid,text,text)
  to authenticated,service_role;

create or replace function public.pa1_5_company_data_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','PA1.5-public-company-data-governance-v1',
    'network_public',false,
    'public_lookup_scope',jsonb_build_array(
      'legal_name','trading_name','country_code','masked_vat_hint','claim_state'
    ),
    'default_rules',jsonb_build_array(
      'public_visibility_is_not_a_reuse_licence',
      'source_terms_and_database_rights_must_be_reviewed_before_publication',
      'prefer_legal_entity_and_company_data',
      'exclude_personal_employee_contacts_by_default',
      'commercial_memory_never_feeds_public_company_data',
      'claim_does_not_equal_verification',
      'correction_removal_and_privacy_objection_channel_available'
    )
  );
$function$;

revoke all on function public.pa1_5_company_data_policy() from public;
grant execute on function public.pa1_5_company_data_policy()
  to anon,authenticated,service_role;

comment on table public.network_data_governance_events is
  'PA1.5 immutable source/candidate/public-request governance decisions. Direct browser access denied.';
comment on table public.company_data_governance_requests is
  'PA1.5 minimal public correction/removal/privacy/source-question intake. Contains requester contact data and is never exposed directly.';
comment on function public.pa1_5_review_discovery_run_governance(uuid,text,text,text,text,text) is
  'PA1.5 root-only source reuse/legal gate. A source is approvable only with acceptable terms, database-rights assessment and company-data policy.';
comment on function public.pa1_5_review_discovery_candidate_governance(uuid,text,boolean,text[],text) is
  'PA1.5 root-only candidate classification gate. Personal-data-bearing candidates cannot be approved as company-data-only.';
comment on function public.pa1_5_submit_company_data_request(text,text,text,text,text,text) is
  'PA1.5 anonymous/authenticated minimal correction, removal, privacy-objection or source-question intake. No Network access is granted.';
