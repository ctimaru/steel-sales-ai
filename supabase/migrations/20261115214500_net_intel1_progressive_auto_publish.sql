
-- NET-INTEL1.C: automatic, traceable publication and progressive batches.
-- The source profile stays published; only an empty description may be filled.
create table if not exists private.netintel1_enrichment_attempts (
  company_id uuid primary key references public.network_companies(id) on delete cascade,
  last_attempt_at timestamptz not null default now(),
  last_status text not null check (last_status in
    ('candidate_only','insufficient_steel_evidence','unavailable',
     'domain_mismatch','error','ingest_error','no_safe_evidence')),
  attempts integer not null default 1 check (attempts > 0),
  extractor_version text not null default 'net-intel1-c-v1'
);
alter table private.netintel1_enrichment_attempts enable row level security;
revoke all on private.netintel1_enrichment_attempts from public, anon, authenticated;
grant select, insert, update on private.netintel1_enrichment_attempts to service_role;

create or replace function public.netintel1_next_batch(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role required' using errcode='42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'limit must be between 1 and 100' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) into v_result
  from (
    select c.id,c.legal_name,c.website_url,c.country_code,
           c.publication_status,c.archived_at,c.description
    from public.network_companies c
    left join private.netintel1_enrichment_attempts a on a.company_id=c.id
    where c.publication_status='published'
      and c.archived_at is null
      and c.country_code='IT'
      and nullif(btrim(c.description),'') is null
      and c.website_url ~* '^https?://'
      and (a.company_id is null or a.last_attempt_at < now() - interval '30 days')
    order by c.id
    limit p_limit
  ) q;
  return v_result;
end
$$;
revoke all on function public.netintel1_next_batch(integer) from public, anon, authenticated;
grant execute on function public.netintel1_next_batch(integer) to service_role;

create or replace function public.netintel1_record_attempt(p_company_id uuid,p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role required' using errcode='42501';
  end if;
  if p_status not in
    ('candidate_only','insufficient_steel_evidence','unavailable',
     'domain_mismatch','error','ingest_error','no_safe_evidence') then
    raise exception 'Invalid attempt status' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.network_companies c
    where c.id=p_company_id and c.publication_status='published' and c.archived_at is null
  ) then
    raise exception 'Company is not published' using errcode='22023';
  end if;
  insert into private.netintel1_enrichment_attempts(company_id,last_status)
  values (p_company_id,p_status)
  on conflict (company_id) do update
    set last_attempt_at=now(),last_status=excluded.last_status,
        attempts=private.netintel1_enrichment_attempts.attempts+1;
end
$$;
revoke all on function public.netintel1_record_attempt(uuid,text) from public, anon, authenticated;
grant execute on function public.netintel1_record_attempt(uuid,text) to service_role;

create or replace function public.netintel1_publish_safe_descriptions()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_count integer; v_accepted integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role required' using errcode='42501';
  end if;

  with eligible as materialized (
    select e.id as evidence_id,c.id as company_id,
           e.field_value #>> '{}' as proposed,
           row_number() over (partition by c.id order by e.fetched_at desc,e.id desc) as rn
    from private.network_company_enrichment e
    join public.network_companies c on c.id=e.canonical_company_id
    where e.extractor_version in ('net-intel1-b-description-v1','net-intel1-c-description-v1')
      and e.field_key='description' and e.review_status='candidate'
      and c.publication_status='published' and c.archived_at is null
      and nullif(btrim(c.description),'') is null
      and c.website_url ~* '^https://' and e.evidence_url ~* '^https://'
      and lower(regexp_replace(split_part(split_part(c.website_url,'://',2),'/',1),'^www\\.','')) =
          lower(regexp_replace(split_part(split_part(e.evidence_url,'://',2),'/',1),'^www\\.',''))
      and length(coalesce(e.evidence_excerpt,'')) >= 60
      and length(e.field_value #>> '{}') between 65 and 270
      and (e.field_value #>> '{}') !~* '(home|menu|skip|button|contatt|telefona|visita il sito|chi siamo|vai al contenuto|search|toggle|cookies)'
      and (e.field_value #>> '{}') !~ '[[:cntrl:]]'
  ), updated as (
    update public.network_companies c
    set description=e.proposed
    from eligible e
    where e.rn=1 and c.id=e.company_id
      and c.publication_status='published' and c.archived_at is null
      and nullif(btrim(c.description),'') is null
    returning c.id
  ), marked as (
    update private.network_company_enrichment e
    set review_status='accepted'
    from eligible elig join updated u on u.id=elig.company_id
    where elig.rn=1 and e.id=elig.evidence_id and e.review_status='candidate'
    returning e.id
  )
  select (select count(*) from updated), (select count(*) from marked)
  into v_count,v_accepted;
  return jsonb_build_object('published',v_count,'accepted',v_accepted);
end
$$;
revoke all on function public.netintel1_publish_safe_descriptions() from public, anon, authenticated;
grant execute on function public.netintel1_publish_safe_descriptions() to service_role;
