
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


-- Preserve the exact 25-company November 15 canary as previously attempted,
-- including the seven with insufficient steel evidence; no redundant recrawl.
insert into private.netintel1_enrichment_attempts(company_id,last_attempt_at,last_status)
select c.id,now(),
       case when exists(select 1 from private.network_company_enrichment e
                         where e.canonical_company_id=c.id
                           and e.extractor_version='net-intel1-b-description-v1')
            then 'candidate_only' else 'insufficient_steel_evidence' end
from public.network_companies c
where c.id in ('00214597-458d-43d4-8c60-45e99d02a655'::uuid,'00b02f0d-d1c6-46c4-80d0-8c0f8155dd01'::uuid,'00b609ce-09e0-4b87-9370-fd0e141babb9'::uuid,'0103eac0-c9f3-400b-b1d6-caa47d399bc6'::uuid,'014ca708-8b58-4ba4-8c7c-58aa5486e6c3'::uuid,'0158107c-3bc3-4644-bbb3-603cd83a78be'::uuid,'01744e1c-8ae8-426a-aafe-71c744058ec7'::uuid,'019be528-2887-4cc8-aa6d-297453b6fdeb'::uuid,'01a8211b-0311-4a2a-90ba-ce9e1681d68e'::uuid,'01ecc0c3-9aa7-4965-8497-59cb4d70f918'::uuid,'0213dfcf-a0cc-41a1-87a9-cd13def9ed59'::uuid,'02dad880-99fc-4eba-a4c1-38aeb40900e5'::uuid,'0357927c-7ebf-49e7-a29a-9e2b245da5f0'::uuid,'03c64860-0c6f-48ca-a14a-1318c7186c84'::uuid,'03cb701b-7331-4d93-8871-5922194cf200'::uuid,'04af956d-6563-4d2b-8ae3-2bc75a33df05'::uuid,'050f23fc-ca27-450f-ae84-31ff2e46f2aa'::uuid,'05c09b67-b0a4-484a-ac1b-51939f0dae27'::uuid,'063c52bc-6b65-4e82-a859-d3342f2af582'::uuid,'06462f5b-c851-476c-9ce5-bd13b667a867'::uuid,'06c52f1a-5e75-4cc5-930d-16b2e96ab996'::uuid,'06c8b69c-0760-497a-9cbe-beac45626bde'::uuid,'072a138e-219f-4f83-acb8-a8f7864fd934'::uuid,'073e8c4d-25e0-4e93-918d-e5b360dad2c0'::uuid,'074bbfcb-3014-4c7c-86c2-b05a371081a7'::uuid)
  and c.publication_status='published' and c.archived_at is null
on conflict(company_id) do nothing;

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
      and lower(regexp_replace(split_part(split_part(c.website_url,'://',2),'/',1),'^www[.]','')) =
          lower(regexp_replace(split_part(split_part(e.evidence_url,'://',2),'/',1),'^www[.]',''))
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
