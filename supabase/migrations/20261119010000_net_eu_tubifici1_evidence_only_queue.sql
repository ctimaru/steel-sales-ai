-- NET-EU-TUBIFICI1.B1 — European, evidence-only producer identity canary.
-- Reuses existing discovery candidates already staged with extraction_version
-- 'net-eu-tubifici1-bridge-v1'. It does NOT alter Italy's AUTO2/AUTO3.
-- No promotion, publication, identity correction or catalogue grant in this migration.

create table if not exists private.net_eu_tubifici1_identity_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.network_company_discovery_candidates(id) on delete restrict,
  run_id uuid not null references public.network_company_discovery_runs(id) on delete restrict,
  country_code text not null check (country_code ~ '^[A-Z]{2}$' and country_code <> 'IT'),
  reviewer_version text not null check (char_length(reviewer_version) between 5 and 80),
  verdict text not null check (verdict in ('observed_match','insufficient','blocked')),
  reason_codes text[] not null default '{}'::text[] check (cardinality(reason_codes) <= 20),
  observed_domain text,
  observed_name text,
  page_url text,
  page_sha256 text check (page_sha256 is null or page_sha256 ~ '^[a-f0-9]{64}$'),
  name_matched boolean not null default false,
  source_rights_state text not null default 'unknown'
    check (source_rights_state in ('unknown','restricts_reuse')),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  first_checked_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now()
);
alter table private.net_eu_tubifici1_identity_evidence enable row level security;
revoke all on table private.net_eu_tubifici1_identity_evidence from public, anon, authenticated;
grant select, insert, update on private.net_eu_tubifici1_identity_evidence to service_role;
create unique index if not exists net_eu_tubifici1_evidence_idempotent
  on private.net_eu_tubifici1_identity_evidence
  (candidate_id, reviewer_version, coalesce(page_sha256,''), verdict);
create index if not exists net_eu_tubifici1_evidence_candidate_checked
  on private.net_eu_tubifici1_identity_evidence(candidate_id,last_checked_at desc);

create or replace function private.net_eu_tubifici1_queue(p_max integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_items jsonb;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
     or auth.uid() is not null or p_max is null or p_max not between 1 and 50 then
    raise exception 'Service-only European identity research required'
      using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'domain', q.canonical_domain, 'url', q.source_url,
    'website_url', q.website_url, 'company_name', q.legal_name,
    'country_code', q.country_code, 'source_run_id', q.run_id,
    'quality_flags', to_jsonb(q.quality_flags)
  ) order by q.created_at,q.id),'[]'::jsonb)
  into v_items
  from (
    select c.id,c.canonical_domain,c.source_url,c.website_url,c.legal_name,
      c.country_code,c.run_id,c.quality_flags,c.created_at
    from public.network_company_discovery_candidates c
    join public.network_company_discovery_runs r on r.id=c.run_id
    where c.extraction_version='net-eu-tubifici1-bridge-v1'
      and r.extraction_version='net-eu-tubifici1-bridge-v1'
      and c.country_code=r.country_code and c.country_code <> 'IT'
      and c.review_status='pending_review' and c.governance_status='unreviewed'
      and not c.personal_data_detected and cardinality(c.personal_data_fields)=0
      and c.source_url ~* '^https://' and c.website_url ~* '^https://'
      and r.source_reference='net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01'
      and not exists(
        select 1 from private.net_eu_tubifici1_identity_evidence e
        where e.candidate_id=c.id and e.last_checked_at > now() - interval '3 days'
      )
    order by c.created_at,c.id limit p_max
  ) q;
  return jsonb_build_object(
     'contract','net-eu-tubifici1-identity-queue-v1',
     'items',v_items,'count',jsonb_array_length(v_items),
     'publication_authorized',false);
end
$$;

create or replace function private.net_eu_tubifici1_record(
 p_candidate_id uuid, p_reviewer_version text, p_verdict text,
 p_reasons text[], p_observed_domain text, p_observed_name text,
 p_page_url text, p_hash text, p_name_matched boolean,
 p_confidence numeric, p_rights_state text default 'unknown'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_candidate public.network_company_discovery_candidates%rowtype;
 v_run public.network_company_discovery_runs%rowtype;
 v_host text;
 v_verdict text := p_verdict;
 v_id uuid;
begin
 if current_setting('request.jwt.claim.role', true) is distinct from 'service_role'
    or auth.uid() is not null then
   raise exception 'Service-only first-party identity research required'
     using errcode='42501';
 end if;
 if p_reviewer_version is distinct from 'net-eu-tubifici1-firstparty-v1'
    or p_verdict not in ('observed_match','insufficient','blocked')
    or p_reasons is null or cardinality(p_reasons)>20
    or p_confidence is null or p_confidence not between 0 and 1
    or p_rights_state not in ('unknown','restricts_reuse')
    or (p_hash is not null and p_hash !~ '^[a-f0-9]{64}$')
    or (p_page_url is not null and p_page_url !~* '^https://')
 then raise exception 'Invalid European identity evidence' using errcode='22023';
 end if;
 select * into v_candidate from public.network_company_discovery_candidates
   where id=p_candidate_id for share;
 if not found or v_candidate.extraction_version<>'net-eu-tubifici1-bridge-v1'
    or v_candidate.country_code='IT'
    or v_candidate.review_status <> 'pending_review'
    or v_candidate.governance_status <> 'unreviewed'
    or v_candidate.personal_data_detected
    or cardinality(v_candidate.personal_data_fields)>0 then
   raise exception 'Candidate not eligible for European research' using errcode='22023';
 end if;
 select * into v_run from public.network_company_discovery_runs where id=v_candidate.run_id;
 if not found or v_run.extraction_version<>'net-eu-tubifici1-bridge-v1'
   or v_run.country_code<>v_candidate.country_code
   or v_run.source_reference<>'net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01' then
   raise exception 'Out-of-scope research batch' using errcode='22023';
 end if;
 v_host := lower(regexp_replace(split_part(split_part(coalesce(p_page_url,''),'/',3),':',1),'^www[.]',''));
 if p_page_url is not null and v_host <> lower(v_candidate.canonical_domain) then
   raise exception 'Evidence must be first party on the recorded corporate domain' using errcode='22023';
 end if;
 if p_verdict='observed_match' and (
   p_page_url is null or p_hash is null or not coalesce(p_name_matched,false)
   or p_observed_domain is distinct from v_candidate.canonical_domain
   or lower(btrim(coalesce(p_observed_name,''))) <> lower(btrim(v_candidate.legal_name))
   or p_confidence<0.9 or p_rights_state='restricts_reuse'
 ) then
   raise exception 'Unproven corporate identity match' using errcode='22023';
 end if;
 if p_rights_state='restricts_reuse' then v_verdict:='blocked'; end if;
 insert into private.net_eu_tubifici1_identity_evidence(
  candidate_id,run_id,country_code,reviewer_version,verdict,reason_codes,
  observed_domain,observed_name,page_url,page_sha256,name_matched,
  source_rights_state,confidence
 ) values (
  v_candidate.id,v_candidate.run_id,v_candidate.country_code,p_reviewer_version,
  v_verdict,p_reasons,left(p_observed_domain,255),left(p_observed_name,255),
  left(p_page_url,2000),p_hash,coalesce(p_name_matched,false),p_rights_state,p_confidence
 )
 on conflict (candidate_id, reviewer_version, coalesce(page_sha256,''), verdict)
 do update set last_checked_at=now()
 returning id into v_id;
 return jsonb_build_object(
  'contract','net-eu-tubifici1-identity-observation-v1',
  'evidence_id',v_id,'candidate_id',v_candidate.id,'verdict',v_verdict,
  'identity_verified',false,'manufacturer_verified',false,
  'published',0,'publication_authorized',false);
end
$$;

revoke all on function private.net_eu_tubifici1_queue(integer) from public, anon, authenticated;
grant execute on function private.net_eu_tubifici1_queue(integer) to service_role;
revoke all on function private.net_eu_tubifici1_record(
 uuid,text,text,text[],text,text,text,text,boolean,numeric,text) from public, anon, authenticated;
grant execute on function private.net_eu_tubifici1_record(
 uuid,text,text,text[],text,text,text,text,boolean,numeric,text) to service_role;

comment on table private.net_eu_tubifici1_identity_evidence is
 'EU1.B first-party identity observations only. Not a legal verification, producer proof, publication decision or catalog license.';
