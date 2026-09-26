-- P3.2 — Web Company Discovery Crawler & Review Pipeline
-- Staging-only crawler persistence + superadmin-controlled promotion.
-- Crawler output can never become a published Network profile without an explicit review decision.

create table public.network_company_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete restrict,
  country_code text not null default 'IT',
  seed_urls jsonb not null default '[]'::jsonb,
  status text not null default 'queued',
  candidate_count integer not null default 0,
  error text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint network_company_discovery_runs_country_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint network_company_discovery_runs_seed_urls_check
    check (
      jsonb_typeof(seed_urls)='array'
      and jsonb_array_length(seed_urls) between 1 and 100
      and pg_column_size(seed_urls) <= 32768
    ),
  constraint network_company_discovery_runs_status_check
    check (status in ('queued','running','completed','failed')),
  constraint network_company_discovery_runs_count_check
    check (candidate_count >= 0),
  constraint network_company_discovery_runs_error_check
    check (error is null or char_length(error) <= 4000),
  constraint network_company_discovery_runs_timing_check
    check (
      (status='queued' and started_at is null and completed_at is null)
      or (status='running' and started_at is not null and completed_at is null)
      or (status in ('completed','failed') and started_at is not null and completed_at is not null)
    )
);

create index network_company_discovery_runs_status_idx
  on public.network_company_discovery_runs(status, created_at desc);
create index network_company_discovery_runs_requested_by_idx
  on public.network_company_discovery_runs(requested_by, created_at desc);

create table public.network_company_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.network_company_discovery_runs(id) on delete restrict,
  source_url text not null,
  canonical_domain text not null,
  website_url text not null,
  legal_name text not null,
  trading_name text null,
  country_code text not null,
  vat_id text null,
  registration_id text null,
  description text null,
  role_keys text[] not null default '{}'::text[],
  subtype_keys text[] not null default '{}'::text[],
  product_relations jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  match_company_id uuid null references public.network_companies(id) on delete restrict,
  match_signals jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) not null default 0,
  review_status text not null default 'pending_review',
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null,
  promoted_company_id uuid null references public.network_companies(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint network_company_discovery_candidates_domain_check
    check (char_length(btrim(canonical_domain)) between 1 and 255),
  constraint network_company_discovery_candidates_url_check
    check (
      char_length(btrim(source_url)) between 1 and 2000
      and char_length(btrim(website_url)) between 1 and 2000
    ),
  constraint network_company_discovery_candidates_name_check
    check (
      char_length(btrim(legal_name)) between 1 and 255
      and (trading_name is null or char_length(btrim(trading_name)) between 1 and 255)
    ),
  constraint network_company_discovery_candidates_country_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint network_company_discovery_candidates_identifier_check
    check (
      (vat_id is null or char_length(vat_id) <= 128)
      and (registration_id is null or char_length(registration_id) <= 128)
    ),
  constraint network_company_discovery_candidates_description_check
    check (description is null or char_length(description) <= 4000),
  constraint network_company_discovery_candidates_role_keys_check
    check (
      cardinality(role_keys) between 1 and 8
      and array_position(role_keys,null) is null
    ),
  constraint network_company_discovery_candidates_subtype_keys_check
    check (
      cardinality(subtype_keys) <= 16
      and array_position(subtype_keys,null) is null
    ),
  constraint network_company_discovery_candidates_products_check
    check (
      jsonb_typeof(product_relations)='array'
      and jsonb_array_length(product_relations) between 1 and 32
      and pg_column_size(product_relations) <= 16384
    ),
  constraint network_company_discovery_candidates_evidence_check
    check (
      jsonb_typeof(evidence)='array'
      and jsonb_array_length(evidence) between 1 and 40
      and pg_column_size(evidence) <= 65536
    ),
  constraint network_company_discovery_candidates_sources_check
    check (
      jsonb_typeof(source_urls)='array'
      and jsonb_array_length(source_urls) between 1 and 20
      and pg_column_size(source_urls) <= 32768
    ),
  constraint network_company_discovery_candidates_match_signals_check
    check (
      jsonb_typeof(match_signals)='array'
      and pg_column_size(match_signals) <= 8192
    ),
  constraint network_company_discovery_candidates_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint network_company_discovery_candidates_review_status_check
    check (review_status in ('pending_review','published','rejected','duplicate_existing')),
  constraint network_company_discovery_candidates_review_integrity_check
    check (
      (review_status='pending_review' and reviewed_by is null and reviewed_at is null and promoted_company_id is null)
      or
      (review_status='published' and reviewed_by is not null and reviewed_at is not null and promoted_company_id is not null)
      or
      (review_status in ('rejected','duplicate_existing') and reviewed_by is not null and reviewed_at is not null and promoted_company_id is null)
    ),
  constraint network_company_discovery_candidates_review_note_check
    check (review_note is null or char_length(review_note) <= 2000),
  constraint network_company_discovery_candidates_run_domain_unique
    unique (run_id, canonical_domain)
);

create index network_company_discovery_candidates_review_idx
  on public.network_company_discovery_candidates(review_status, confidence desc, created_at desc);
create index network_company_discovery_candidates_domain_idx
  on public.network_company_discovery_candidates(lower(canonical_domain));
create index network_company_discovery_candidates_match_company_idx
  on public.network_company_discovery_candidates(match_company_id)
  where match_company_id is not null;
create index network_company_discovery_candidates_run_idx
  on public.network_company_discovery_candidates(run_id, created_at);

create or replace function private.p3_discovery_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  new.updated_at:=now();
  return new;
end;
$function$;

revoke all on function private.p3_discovery_touch_updated_at() from public,anon,authenticated;

create trigger network_company_discovery_runs_touch_updated_at
before update on public.network_company_discovery_runs
for each row execute function private.p3_discovery_touch_updated_at();

create trigger network_company_discovery_candidates_touch_updated_at
before update on public.network_company_discovery_candidates
for each row execute function private.p3_discovery_touch_updated_at();

alter table public.network_company_discovery_runs enable row level security;
alter table public.network_company_discovery_candidates enable row level security;

revoke all on table public.network_company_discovery_runs from public,anon,authenticated;
revoke all on table public.network_company_discovery_candidates from public,anon,authenticated;

grant select,insert,update on table public.network_company_discovery_runs to service_role;
grant select,insert,update on table public.network_company_discovery_candidates to service_role;

create or replace function private.p3_start_company_discovery_impl(
  p_country_code text,
  p_seed_urls jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_run_id uuid;
  v_country text;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  v_country:=upper(btrim(coalesce(p_country_code,'IT')));
  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;

  if p_seed_urls is null
     or jsonb_typeof(p_seed_urls)<>'array'
     or jsonb_array_length(p_seed_urls)<1
     or jsonb_array_length(p_seed_urls)>100 then
    raise exception 'seed_urls must contain 1..100 URLs' using errcode='22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_seed_urls) u(url)
    where btrim(url) !~* '^https?://'
       or char_length(url)>2000
  ) then
    raise exception 'all seed URLs must be absolute http(s) URLs' using errcode='22023';
  end if;

  insert into public.network_company_discovery_runs(
    requested_by,country_code,seed_urls,status
  )
  values(v_user_id,v_country,p_seed_urls,'queued')
  returning id into v_run_id;

  return jsonb_build_object(
    'run_id',v_run_id,
    'status','queued',
    'country_code',v_country,
    'seed_count',jsonb_array_length(p_seed_urls)
  );
end;
$function$;

revoke all on function private.p3_start_company_discovery_impl(text,jsonb) from public,anon;
grant execute on function private.p3_start_company_discovery_impl(text,jsonb) to authenticated,service_role;

create or replace function public.p3_start_company_discovery(
  p_country_code text,
  p_seed_urls jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_start_company_discovery_impl(p_country_code,p_seed_urls);
$function$;

revoke all on function public.p3_start_company_discovery(text,jsonb) from public,anon;
grant execute on function public.p3_start_company_discovery(text,jsonb) to authenticated,service_role;

create or replace function private.p3_admin_discovery_queue_impl(
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
  v_user_id uuid;
  v_items jsonb;
  v_total integer;
  v_limit integer;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  if p_status is not null and p_status not in ('pending_review','published','rejected','duplicate_existing') then
    raise exception 'invalid candidate status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  select count(*)::integer into v_total
  from public.network_company_discovery_candidates c
  where p_status is null or c.review_status=p_status;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.confidence desc,q.created_at desc),'[]'::jsonb)
  into v_items
  from (
    select
      c.id,c.run_id,c.legal_name,c.trading_name,c.country_code,
      c.website_url,c.canonical_domain,c.description,
      c.role_keys,c.subtype_keys,c.product_relations,c.evidence,c.source_urls,
      c.match_company_id,c.match_signals,c.confidence,c.review_status,
      c.reviewed_at,c.review_note,c.promoted_company_id,c.created_at
    from public.network_company_discovery_candidates c
    where p_status is null or c.review_status=p_status
    order by c.confidence desc,c.created_at desc
    limit v_limit
  ) q;

  return jsonb_build_object('items',v_items,'total',v_total,'limit',v_limit);
end;
$function$;

revoke all on function private.p3_admin_discovery_queue_impl(text,integer) from public,anon;
grant execute on function private.p3_admin_discovery_queue_impl(text,integer) to authenticated,service_role;

create or replace function public.p3_admin_discovery_queue(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_admin_discovery_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.p3_admin_discovery_queue(text,integer) from public,anon;
grant execute on function public.p3_admin_discovery_queue(text,integer) to authenticated,service_role;

create or replace function private.p3_admin_discovery_detail_impl(p_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'candidate',to_jsonb(c),
    'run',jsonb_build_object(
      'id',r.id,'country_code',r.country_code,'status',r.status,
      'seed_urls',r.seed_urls,'candidate_count',r.candidate_count,
      'created_at',r.created_at,'started_at',r.started_at,'completed_at',r.completed_at
    ),
    'matched_company',case when m.id is null then null else jsonb_build_object(
      'id',m.id,'legal_name',m.legal_name,'country_code',m.country_code,
      'website_domain',m.website_domain,'publication_status',m.publication_status,
      'claimed_status',m.claimed_status,'verification_status',m.verification_status
    ) end
  )
  into v_result
  from public.network_company_discovery_candidates c
  join public.network_company_discovery_runs r on r.id=c.run_id
  left join public.network_companies m on m.id=c.match_company_id
  where c.id=p_candidate_id;

  if v_result is null then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;
  return v_result;
end;
$function$;

revoke all on function private.p3_admin_discovery_detail_impl(uuid) from public,anon;
grant execute on function private.p3_admin_discovery_detail_impl(uuid) to authenticated,service_role;

create or replace function public.p3_admin_discovery_detail(p_candidate_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_admin_discovery_detail_impl(p_candidate_id);
$function$;

revoke all on function public.p3_admin_discovery_detail(uuid) from public,anon;
grant execute on function public.p3_admin_discovery_detail(uuid) to authenticated,service_role;

create or replace function private.p3_review_company_discovery_impl(
  p_candidate_id uuid,
  p_decision text,
  p_existing_company_id uuid default null,
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
  v_company_id uuid;
  v_assertion_id uuid;
  v_existing_id uuid;
  v_note text;
  v_invalid text;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  if p_decision not in ('publish_new','reject','duplicate_existing') then
    raise exception 'invalid discovery review decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'review note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_candidate
  from public.network_company_discovery_candidates
  where id=p_candidate_id
  for update;

  if not found then
    raise exception 'discovery candidate not found' using errcode='P0002';
  end if;
  if v_candidate.review_status<>'pending_review' then
    raise exception 'only pending discovery candidates can be reviewed' using errcode='22023';
  end if;

  if p_decision='reject' then
    update public.network_company_discovery_candidates
    set review_status='rejected',reviewed_by=v_user_id,reviewed_at=now(),review_note=v_note
    where id=p_candidate_id;
    return jsonb_build_object('candidate_id',p_candidate_id,'status','rejected','company_id',null);
  end if;

  if p_decision='duplicate_existing' then
    if p_existing_company_id is null
       or not exists(select 1 from public.network_companies where id=p_existing_company_id and publication_status<>'archived') then
      raise exception 'valid existing company required for duplicate decision' using errcode='22023';
    end if;
    update public.network_company_discovery_candidates
    set
      review_status='duplicate_existing',
      match_company_id=p_existing_company_id,
      reviewed_by=v_user_id,
      reviewed_at=now(),
      review_note=v_note
    where id=p_candidate_id;
    return jsonb_build_object(
      'candidate_id',p_candidate_id,'status','duplicate_existing',
      'company_id',p_existing_company_id,'merge_performed',false
    );
  end if;

  -- Re-check exact identity signals at decision time. A crawler candidate may never
  -- silently create a duplicate legal entity.
  select c.id into v_existing_id
  from public.network_companies c
  where c.publication_status<>'archived'
    and (
      (nullif(v_candidate.canonical_domain,'') is not null
        and lower(c.website_domain)=lower(v_candidate.canonical_domain))
      or (v_candidate.vat_id is not null
        and c.country_code=v_candidate.country_code
        and upper(c.vat_id)=upper(v_candidate.vat_id))
      or (v_candidate.registration_id is not null
        and c.country_code=v_candidate.country_code
        and upper(c.registration_id)=upper(v_candidate.registration_id))
      or (
        c.country_code=v_candidate.country_code
        and c.normalized_legal_name=lower(regexp_replace(btrim(v_candidate.legal_name),'\s+',' ','g'))
      )
    )
  order by
    case when lower(c.website_domain)=lower(v_candidate.canonical_domain) then 0 else 1 end,
    c.created_at
  limit 1;

  if v_existing_id is not null then
    raise exception 'existing Network identity match requires duplicate_existing review decision'
      using errcode='23505',
            detail='existing_company_id='||v_existing_id::text;
  end if;

  select k into v_invalid
  from unnest(v_candidate.role_keys) k
  where not exists (
    select 1 from public.network_company_roles r
    where r.canonical_key=k and r.status='active'
  )
  limit 1;
  if v_invalid is not null then
    raise exception 'unknown active role key: %',v_invalid using errcode='22023';
  end if;

  select k into v_invalid
  from unnest(v_candidate.subtype_keys) k
  where not exists (
    select 1 from public.network_company_subtypes s
    where s.canonical_key=k and s.status='active'
  )
  limit 1;
  if v_invalid is not null then
    raise exception 'unknown active subtype key: %',v_invalid using errcode='22023';
  end if;

  select e->>'key' into v_invalid
  from jsonb_array_elements(v_candidate.product_relations) e
  where coalesce(e->>'relationship_type','') not in ('produces','distributes','stocks','processes','uses')
     or not exists (
       select 1 from public.network_product_families p
       where p.canonical_key=e->>'key' and p.status='active'
     )
  limit 1;
  if v_invalid is not null then
    raise exception 'invalid product relationship for key: %',v_invalid using errcode='22023';
  end if;

  insert into public.network_companies(
    legal_name,trading_name,country_code,registration_id,vat_id,
    website_url,website_domain,description,
    publication_status,claimed_status,verification_status
  )
  values(
    v_candidate.legal_name,v_candidate.trading_name,v_candidate.country_code,
    v_candidate.registration_id,v_candidate.vat_id,
    v_candidate.website_url,v_candidate.canonical_domain,v_candidate.description,
    'published','unclaimed','unverified'
  )
  returning id into v_company_id;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,asserted_by,
    confidence,review_state
  )
  values(
    'company',v_company_id,'p3_2_discovery_snapshot',
    jsonb_build_object(
      'legal_name',v_candidate.legal_name,
      'trading_name',v_candidate.trading_name,
      'country_code',v_candidate.country_code,
      'vat_id',v_candidate.vat_id,
      'registration_id',v_candidate.registration_id,
      'website_url',v_candidate.website_url,
      'canonical_domain',v_candidate.canonical_domain,
      'description',v_candidate.description,
      'role_keys',to_jsonb(v_candidate.role_keys),
      'subtype_keys',to_jsonb(v_candidate.subtype_keys),
      'product_relations',v_candidate.product_relations,
      'evidence',v_candidate.evidence,
      'source_urls',v_candidate.source_urls,
      'crawler_candidate_id',v_candidate.id
    ),
    'public_web',v_candidate.source_url,'platform_curated',v_user_id,
    v_candidate.confidence,'accepted'
  )
  returning id into v_assertion_id;

  insert into public.network_company_role_assignments(
    company_id,role_id,is_primary,source_assertion_id
  )
  select
    v_company_id,r.id,(u.ordinality=1),v_assertion_id
  from unnest(v_candidate.role_keys) with ordinality u(key,ordinality)
  join public.network_company_roles r on r.canonical_key=u.key
  order by u.ordinality;

  insert into public.network_company_subtype_assignments(
    company_id,subtype_id,source_assertion_id
  )
  select v_company_id,s.id,v_assertion_id
  from unnest(v_candidate.subtype_keys) k
  join public.network_company_subtypes s on s.canonical_key=k;

  insert into public.network_company_products(
    company_id,product_family_id,relationship_type,source_assertion_id
  )
  select distinct
    v_company_id,p.id,e->>'relationship_type',v_assertion_id
  from jsonb_array_elements(v_candidate.product_relations) e
  join public.network_product_families p on p.canonical_key=e->>'key';

  update public.network_company_discovery_candidates
  set
    review_status='published',
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=v_note,
    promoted_company_id=v_company_id
  where id=p_candidate_id;

  return jsonb_build_object(
    'candidate_id',p_candidate_id,
    'status','published',
    'company_id',v_company_id,
    'claimed_status','unclaimed',
    'verification_status','unverified',
    'automatic_merge_performed',false
  );
end;
$function$;

revoke all on function private.p3_review_company_discovery_impl(uuid,text,uuid,text) from public,anon;
grant execute on function private.p3_review_company_discovery_impl(uuid,text,uuid,text) to authenticated,service_role;

create or replace function public.p3_review_company_discovery(
  p_candidate_id uuid,
  p_decision text,
  p_existing_company_id uuid default null,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_review_company_discovery_impl(
    p_candidate_id,p_decision,p_existing_company_id,p_note
  );
$function$;

revoke all on function public.p3_review_company_discovery(uuid,text,uuid,text) from public,anon;
grant execute on function public.p3_review_company_discovery(uuid,text,uuid,text) to authenticated,service_role;

comment on table public.network_company_discovery_runs is
  'P3.2 crawler run ledger. Superadmin requests work; the worker may update runtime state through service_role only.';
comment on table public.network_company_discovery_candidates is
  'P3.2 staging-only public-web candidates. No candidate is visible in the Network until explicit superadmin promotion.';
comment on function public.p3_review_company_discovery(uuid,text,uuid,text) is
  'P3.2 superadmin review/promotion. publish_new creates an unclaimed, unverified Network profile with immutable public-web provenance; duplicate_existing performs no merge.';
