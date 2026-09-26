-- P3.3 — Discovery Quality Hardening & Italy Scale-Up
-- Adds extraction/classification observability, source provenance, run metrics,
-- and explicit bulk closure for exact-identity duplicates. No auto-publish or auto-merge.

alter table public.network_company_discovery_runs
  add column if not exists source_type text not null default 'manual_url',
  add column if not exists source_reference text null,
  add column if not exists label text null,
  add column if not exists skipped_count integer not null default 0,
  add column if not exists error_count integer not null default 0,
  add column if not exists exact_match_count integer not null default 0,
  add column if not exists extraction_version text not null default 'p3.2-v1',
  add column if not exists stats jsonb not null default '{}'::jsonb;

alter table public.network_company_discovery_runs
  drop constraint if exists network_company_discovery_runs_source_type_check;
alter table public.network_company_discovery_runs
  add constraint network_company_discovery_runs_source_type_check
  check (source_type in (
    'manual_url','web_search_curated','industry_directory',
    'association','registry','other'
  ));

alter table public.network_company_discovery_runs
  drop constraint if exists network_company_discovery_runs_p33_count_check;
alter table public.network_company_discovery_runs
  add constraint network_company_discovery_runs_p33_count_check
  check (skipped_count>=0 and error_count>=0 and exact_match_count>=0);

alter table public.network_company_discovery_runs
  drop constraint if exists network_company_discovery_runs_source_reference_check;
alter table public.network_company_discovery_runs
  add constraint network_company_discovery_runs_source_reference_check
  check (
    (source_reference is null or char_length(source_reference)<=2000)
    and (label is null or char_length(label)<=255)
    and char_length(extraction_version) between 1 and 64
    and jsonb_typeof(stats)='object'
    and pg_column_size(stats)<=16384
  );

alter table public.network_company_discovery_candidates
  add column if not exists extraction_version text not null default 'p3.2-v1',
  add column if not exists identity_quality jsonb not null default '{}'::jsonb,
  add column if not exists classification_scores jsonb not null default '{}'::jsonb,
  add column if not exists quality_flags text[] not null default '{}'::text[];

alter table public.network_company_discovery_candidates
  drop constraint if exists network_company_discovery_candidates_p33_quality_check;
alter table public.network_company_discovery_candidates
  add constraint network_company_discovery_candidates_p33_quality_check
  check (
    char_length(extraction_version) between 1 and 64
    and jsonb_typeof(identity_quality)='object'
    and jsonb_typeof(classification_scores)='object'
    and pg_column_size(identity_quality)<=8192
    and pg_column_size(classification_scores)<=8192
    and cardinality(quality_flags)<=32
    and array_position(quality_flags,null) is null
  );

create index if not exists network_company_discovery_candidates_quality_flags_idx
  on public.network_company_discovery_candidates using gin(quality_flags);

create or replace function private.p3_start_company_discovery_batch_impl(
  p_country_code text,
  p_seed_urls jsonb,
  p_source_type text,
  p_source_reference text default null,
  p_label text default null
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
  v_source_type text;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  v_country:=upper(btrim(coalesce(p_country_code,'IT')));
  v_source_type:=lower(btrim(coalesce(p_source_type,'manual_url')));

  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'invalid country code' using errcode='22023';
  end if;

  if v_source_type not in (
    'manual_url','web_search_curated','industry_directory',
    'association','registry','other'
  ) then
    raise exception 'invalid discovery source type' using errcode='22023';
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

  if p_source_reference is not null and char_length(p_source_reference)>2000 then
    raise exception 'source reference exceeds 2000 characters' using errcode='22023';
  end if;
  if p_label is not null and char_length(p_label)>255 then
    raise exception 'label exceeds 255 characters' using errcode='22023';
  end if;

  insert into public.network_company_discovery_runs(
    requested_by,country_code,seed_urls,status,
    source_type,source_reference,label,extraction_version
  )
  values(
    v_user_id,v_country,p_seed_urls,'queued',
    v_source_type,nullif(btrim(coalesce(p_source_reference,'')),''),
    nullif(btrim(coalesce(p_label,'')),''),
    'p3.3-v2'
  )
  returning id into v_run_id;

  return jsonb_build_object(
    'run_id',v_run_id,
    'status','queued',
    'country_code',v_country,
    'seed_count',jsonb_array_length(p_seed_urls),
    'source_type',v_source_type,
    'extraction_version','p3.3-v2'
  );
end;
$function$;

revoke all on function private.p3_start_company_discovery_batch_impl(
  text,jsonb,text,text,text
) from public,anon;
grant execute on function private.p3_start_company_discovery_batch_impl(
  text,jsonb,text,text,text
) to authenticated,service_role;

create or replace function public.p3_start_company_discovery_batch(
  p_country_code text,
  p_seed_urls jsonb,
  p_source_type text default 'manual_url',
  p_source_reference text default null,
  p_label text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_start_company_discovery_batch_impl(
    p_country_code,p_seed_urls,p_source_type,p_source_reference,p_label
  );
$function$;

revoke all on function public.p3_start_company_discovery_batch(
  text,jsonb,text,text,text
) from public,anon;
grant execute on function public.p3_start_company_discovery_batch(
  text,jsonb,text,text,text
) to authenticated,service_role;

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

  if p_status is not null and p_status not in (
    'pending_review','published','rejected','duplicate_existing'
  ) then
    raise exception 'invalid candidate status' using errcode='22023';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  select count(*)::integer into v_total
  from public.network_company_discovery_candidates c
  where p_status is null or c.review_status=p_status;

  select coalesce(
    jsonb_agg(to_jsonb(q) order by q.confidence desc,q.created_at desc),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      c.id,c.run_id,c.legal_name,c.trading_name,c.country_code,
      c.website_url,c.canonical_domain,c.description,
      c.role_keys,c.subtype_keys,c.product_relations,c.evidence,c.source_urls,
      c.match_company_id,c.match_signals,c.confidence,c.review_status,
      c.extraction_version,c.identity_quality,c.classification_scores,c.quality_flags,
      c.reviewed_at,c.review_note,c.promoted_company_id,c.created_at
    from public.network_company_discovery_candidates c
    where p_status is null or c.review_status=p_status
    order by c.confidence desc,c.created_at desc
    limit v_limit
  ) q;

  return jsonb_build_object(
    'items',v_items,
    'total',v_total,
    'limit',v_limit,
    'quality',jsonb_build_object(
      'flagged',(
        select count(*) from public.network_company_discovery_candidates c
        where (p_status is null or c.review_status=p_status)
          and cardinality(c.quality_flags)>0
      ),
      'exact_identity_matches',(
        select count(*) from public.network_company_discovery_candidates c
        where (p_status is null or c.review_status=p_status)
          and c.match_company_id is not null
          and (
            c.match_signals ? 'website_domain_exact'
            or c.match_signals ? 'country_vat_exact'
          )
      )
    )
  );
end;
$function$;

create or replace function private.p3_admin_discovery_runs_impl(
  p_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_limit integer;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,25),1),100);

  return (
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb)
    from (
      select
        r.id,r.label,r.source_type,r.source_reference,r.country_code,r.status,
        jsonb_array_length(r.seed_urls) seed_count,
        r.candidate_count,r.skipped_count,r.error_count,r.exact_match_count,
        r.extraction_version,r.stats,r.error,r.started_at,r.completed_at,r.created_at
      from public.network_company_discovery_runs r
      order by r.created_at desc
      limit v_limit
    ) q
  );
end;
$function$;

revoke all on function private.p3_admin_discovery_runs_impl(integer) from public,anon;
grant execute on function private.p3_admin_discovery_runs_impl(integer) to authenticated,service_role;

create or replace function public.p3_admin_discovery_runs(
  p_limit integer default 25
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_admin_discovery_runs_impl(p_limit);
$function$;

revoke all on function public.p3_admin_discovery_runs(integer) from public,anon;
grant execute on function public.p3_admin_discovery_runs(integer) to authenticated,service_role;

create or replace function private.p3_close_exact_discovery_duplicates_impl(
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_count integer;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  if p_note is not null and char_length(p_note)>2000 then
    raise exception 'review note exceeds 2000 characters' using errcode='22023';
  end if;

  update public.network_company_discovery_candidates c
  set
    review_status='duplicate_existing',
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=coalesce(
      nullif(btrim(coalesce(p_note,'')),''),
      'P3.3 bulk review: exact identity match.'
    )
  where c.review_status='pending_review'
    and c.match_company_id is not null
    and (
      c.match_signals ? 'website_domain_exact'
      or c.match_signals ? 'country_vat_exact'
    );

  get diagnostics v_count=row_count;

  return jsonb_build_object(
    'status','completed',
    'closed_count',v_count,
    'merge_performed',false,
    'hard_signals',jsonb_build_array('website_domain_exact','country_vat_exact')
  );
end;
$function$;

revoke all on function private.p3_close_exact_discovery_duplicates_impl(text)
  from public,anon;
grant execute on function private.p3_close_exact_discovery_duplicates_impl(text)
  to authenticated,service_role;

create or replace function public.p3_close_exact_discovery_duplicates(
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_close_exact_discovery_duplicates_impl(p_note);
$function$;

revoke all on function public.p3_close_exact_discovery_duplicates(text)
  from public,anon;
grant execute on function public.p3_close_exact_discovery_duplicates(text)
  to authenticated,service_role;

comment on function public.p3_start_company_discovery_batch(text,jsonb,text,text,text) is
  'P3.3 starts provenance-labelled discovery batches. Only platform superadmin can enqueue.';
comment on function public.p3_close_exact_discovery_duplicates(text) is
  'P3.3 explicit superadmin bulk closure for hard exact identity matches only. Never merges profiles.';
