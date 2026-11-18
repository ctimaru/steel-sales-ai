-- NET-EU-TUBIFICI1.D3.A: evidence-only European corporate recovery.
-- Immutable first-party URL/digest observations, no copied website content.
-- Existing publisher/PA1.5, Italian routes and EU group holds remain untouched.
create table if not exists private.net_eu_tubifici1_d3_recovery (
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references public.network_company_discovery_candidates(id) on delete restrict,
 legal_source_url text not null check (legal_source_url ~* '^https://' and length(legal_source_url)<=2000),
 legal_page_sha256 text not null check (legal_page_sha256 ~ '^[a-f0-9]{64}$'),
 manufacturing_source_url text not null check (manufacturing_source_url ~* '^https://' and length(manufacturing_source_url)<=2000),
 manufacturing_page_sha256 text not null check (manufacturing_page_sha256 ~ '^[a-f0-9]{64}$'),
 legal_name_observed boolean not null,
 manufacturing_observed boolean not null,
 reuse_restricted boolean not null,
 evidence_status text not null check (evidence_status in ('qualified_firstparty','hold_rights','hold_group_entity','hold_legal_identity','insufficient')),
 process_code text not null check (process_code in ('welded_steel_tubes','seamless_hot_rolled','group_division_unspecified')),
 factory_city text,
 evidence_note text not null check (char_length(evidence_note) between 20 and 600),
 identity_evidence_id uuid references private.net_eu_tubifici1_identity_evidence(id),
 checked_at timestamptz not null default now(),
 last_checked_at timestamptz not null default now(),
 unique(candidate_id,legal_page_sha256,manufacturing_page_sha256)
);
alter table private.net_eu_tubifici1_d3_recovery enable row level security;
revoke all on private.net_eu_tubifici1_d3_recovery from public,anon,authenticated,service_role;
create index if not exists net_eu_tubifici1_d3_recovery_latest on private.net_eu_tubifici1_d3_recovery(candidate_id,last_checked_at desc);

-- A bounded, service-JWT-only retry queue. It includes 6 inconclusive
-- batch-02 candidates plus Alleima/Ferpinta original group/identity holds.
-- A source remains in the queue at most once per 7 days; batch-01 candidates
-- and the already published EU cohort are otherwise unaffected.
create or replace function private.net_eu_tubifici1_d3_queue(p_max integer default 8)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_items jsonb;
begin
 if auth.role() is distinct from 'service_role' or auth.uid() is not null
    or p_max is null or p_max not between 1 and 8 then
    raise exception 'EU D3 service-only bounded recovery' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'country_code',q.country_code,'domain',q.canonical_domain,
   'company_name',q.legal_name,'source_url',q.source_url,
   'website_url',q.website_url,'source_run_id',q.run_id,
   'quality_flags',to_jsonb(q.quality_flags),
   'review_lane',q.identity_quality->>'review_lane'
 ) order by q.country_code,q.canonical_domain),'[]'::jsonb)
 into v_items
 from (
  select c.* from public.network_company_discovery_candidates c
  join public.network_company_discovery_runs r on r.id=c.run_id
  where r.source_reference in (
    'net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01',
    'net-eu-tubifici1:NET-EU-TUBIFICI-20261118-02')
   and c.canonical_domain in ('alleima.com','ferpinta.pt','mannesmann.com',
       'aratubo.com','tubulareurope.arcelormittal.com','tatasteeluk.com',
       'toptubes.co.uk','rsteel.pt')
   and c.extraction_version='net-eu-tubifici1-bridge-v1'
   and r.extraction_version='net-eu-tubifici1-bridge-v1'
   and c.country_code=r.country_code and c.country_code<>'IT'
   and c.review_status='pending_review'
   and c.governance_status='unreviewed'
   and c.publication_actor_type='platform'
   and not c.personal_data_detected
   and cardinality(c.personal_data_fields)=0
   and private.net_eu_tubifici1_seed_matches(
      c.country_code,c.canonical_domain,c.source_url,r.source_reference,
      c.identity_quality->>'seed_id',c.identity_quality->>'research_id')
   and not exists(
    select 1 from private.net_eu_tubifici1_d3_recovery v
    where v.candidate_id=c.id and v.last_checked_at>now()-interval '7 days'
   )
  order by c.country_code,c.canonical_domain limit p_max
 ) q;
 return jsonb_build_object('contract','net-eu-tubifici1-d3-queue-v1',
  'items',v_items,'count',jsonb_array_length(v_items),
  'publication_authorized',false);
end
$$;

-- Only an authenticated server worker can register fresh identity and factory
-- URL fingerprints. For ordinary unambiguous candidates it also writes a
-- *first-party observation*, which the existing PA1.5 publisher independently
-- validates; it NEVER promotes a company, changes quality flags, or closes a
-- corporate-group/legal mismatch. Explicit rights restrictions fail closed.
create or replace function private.net_eu_tubifici1_d3_record(
 p_candidate_id uuid,p_legal_url text,p_legal_hash text,
 p_factory_url text,p_factory_hash text,
 p_name_observed boolean,p_manufacturing_observed boolean,
 p_rights_restricted boolean,p_process_code text,
 p_factory_city text,p_note text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 c public.network_company_discovery_candidates%rowtype;
 r public.network_company_discovery_runs%rowtype;
 v_status text;
 v_identity uuid;
 v_audit uuid;
 v_qualified boolean;
begin
 if auth.role() is distinct from 'service_role' or auth.uid() is not null then
   raise exception 'EU D3 first-party identity recorder is service-only' using errcode='42501';
 end if;
 if p_candidate_id is null or p_legal_url is null or p_factory_url is null
   or p_legal_url !~* '^https://' or p_factory_url !~* '^https://'
   or length(p_legal_url)>2000 or length(p_factory_url)>2000
   or p_legal_hash !~ '^[a-f0-9]{64}$' or p_factory_hash !~ '^[a-f0-9]{64}$'
   or p_name_observed is null or p_manufacturing_observed is null or p_rights_restricted is null
   or p_process_code not in ('welded_steel_tubes','seamless_hot_rolled','group_division_unspecified')
   or p_note is null or char_length(p_note) not between 20 and 600
   or (p_factory_city is not null and char_length(p_factory_city) not between 2 and 160)
 then raise exception 'Malformed EU D3 source evidence' using errcode='22023'; end if;

 select * into c from public.network_company_discovery_candidates where id=p_candidate_id for update;
 select * into r from public.network_company_discovery_runs where id=c.run_id;
 if not found or c.id is null or c.review_status<>'pending_review'
    or c.governance_status<>'unreviewed' or c.publication_actor_type<>'platform'
    or c.extraction_version<>'net-eu-tubifici1-bridge-v1'
    or r.extraction_version<>'net-eu-tubifici1-bridge-v1'
    or c.country_code='IT' or c.country_code<>r.country_code
    or r.source_reference not in (
      'net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01',
      'net-eu-tubifici1:NET-EU-TUBIFICI-20261118-02')
    or c.canonical_domain not in ('alleima.com','ferpinta.pt','mannesmann.com',
       'aratubo.com','tubulareurope.arcelormittal.com','tatasteeluk.com',
       'toptubes.co.uk','rsteel.pt')
    or not private.net_eu_tubifici1_seed_matches(
      c.country_code,c.canonical_domain,c.source_url,r.source_reference,
      c.identity_quality->>'seed_id',c.identity_quality->>'research_id')
    or c.personal_data_detected or cardinality(c.personal_data_fields)>0
    or lower(regexp_replace(split_part(split_part(p_legal_url,'/',3),':',1),'^www[.]',''))
       <>lower(c.canonical_domain)
    or lower(regexp_replace(split_part(split_part(p_factory_url,'/',3),':',1),'^www[.]',''))
       <>lower(c.canonical_domain)
 then raise exception 'EU D3 candidate is out of source scope' using errcode='22023'; end if;

 v_qualified := p_name_observed and p_manufacturing_observed
   and not p_rights_restricted and p_process_code<>'group_division_unspecified'
   and c.identity_quality->>'review_lane'='web_profile_review_pending'
   and c.quality_flags <@ array['legal_identity_not_verified','producer_role_not_verified']::text[]
   and not exists(select 1 from private.net_eu_tubifici1_manufacturing_proofs m
     where m.candidate_id=c.id)
   and not exists(select 1 from public.network_companies n
     where n.publication_status<>'archived' and (
       lower(regexp_replace(coalesce(n.website_domain,''),'^www[.]',''))=lower(c.canonical_domain)
       or (n.country_code=c.country_code and
       lower(regexp_replace(btrim(n.legal_name),'[^[:alnum:]]','','g'))
       =lower(regexp_replace(btrim(c.legal_name),'[^[:alnum:]]','','g')))))
   and not exists(select 1 from public.network_netfast3_suppressed_domains s
       where lower(s.domain)=lower(c.canonical_domain));

 v_status := case
   when p_rights_restricted then 'hold_rights'
   when c.canonical_domain in ('alleima.com','ferpinta.pt')
     or c.identity_quality ? 'legal_entity_resolution'
     then 'hold_legal_identity'
   when c.quality_flags && array['group_or_legal_entity_review']::text[]
     or c.identity_quality->>'review_lane' in ('group_facility_review','legal_identity_review')
     then 'hold_group_entity'
   when v_qualified then 'qualified_firstparty'
   else 'insufficient'
 end;

 if v_status='qualified_firstparty' then
   insert into private.net_eu_tubifici1_identity_evidence(
     candidate_id,run_id,country_code,reviewer_version,verdict,reason_codes,
     observed_domain,observed_name,page_url,page_sha256,name_matched,
     source_rights_state,confidence
   ) values(c.id,c.run_id,c.country_code,'net-eu-tubifici1-firstparty-v1',
      'observed_match',array[]::text[],lower(c.canonical_domain),c.legal_name,
      p_legal_url,p_legal_hash,true,'unknown',0.95)
   on conflict (candidate_id,reviewer_version,(coalesce(page_sha256,'')),verdict)
   do update set last_checked_at=now()
   returning id into v_identity;

   insert into private.net_eu_tubifici1_manufacturing_proofs(
    candidate_id,identity_evidence_id,factory_country_code,factory_city,
    process_code,source_url,source_kind,proof_note,proof_status)
   values(c.id,v_identity,c.country_code,p_factory_city,
    p_process_code,p_factory_url,'first_party_html',p_note,'qualified_firstparty')
   on conflict(candidate_id) do nothing;
 end if;

 insert into private.net_eu_tubifici1_d3_recovery(
   candidate_id,legal_source_url,legal_page_sha256,
   manufacturing_source_url,manufacturing_page_sha256,
   legal_name_observed,manufacturing_observed,reuse_restricted,
   evidence_status,process_code,factory_city,evidence_note,identity_evidence_id)
 values (c.id,p_legal_url,p_legal_hash,p_factory_url,p_factory_hash,
   p_name_observed,p_manufacturing_observed,p_rights_restricted,v_status,
   p_process_code,p_factory_city,p_note,v_identity)
 on conflict(candidate_id,legal_page_sha256,manufacturing_page_sha256)
 do update set last_checked_at=now()
 returning id into v_audit;

 return jsonb_build_object('contract','net-eu-tubifici1-d3-observation-v1',
   'candidate_id',c.id,'evidence_id',v_audit,'status',v_status,
   'qualified',v_status='qualified_firstparty','published',0,
   'legal_certification',false,'manufacturer_confirmed',false);
end
$$;

revoke all on function private.net_eu_tubifici1_d3_queue(integer)
 from public,anon,authenticated;
revoke all on function private.net_eu_tubifici1_d3_record(
 uuid,text,text,text,text,boolean,boolean,boolean,text,text,text
) from public,anon,authenticated;
grant execute on function private.net_eu_tubifici1_d3_queue(integer) to service_role;
grant execute on function private.net_eu_tubifici1_d3_record(
 uuid,text,text,text,text,boolean,boolean,boolean,text,text,text
) to service_role;

create or replace function public.net_eu_tubifici1_d3_queue(p_max integer default 8)
returns jsonb language sql security invoker set search_path=''
as $$ select private.net_eu_tubifici1_d3_queue(p_max) $$;
create or replace function public.net_eu_tubifici1_d3_record(
 p_candidate_id uuid,p_legal_url text,p_legal_hash text,
 p_factory_url text,p_factory_hash text,
 p_name_observed boolean,p_manufacturing_observed boolean,
 p_rights_restricted boolean,p_process_code text,
 p_factory_city text,p_note text
)
returns jsonb language sql security invoker set search_path=''
as $$ select private.net_eu_tubifici1_d3_record(
p_candidate_id,p_legal_url,p_legal_hash,p_factory_url,p_factory_hash,
p_name_observed,p_manufacturing_observed,p_rights_restricted,
p_process_code,p_factory_city,p_note) $$;

revoke all on function public.net_eu_tubifici1_d3_queue(integer)
 from public,anon,authenticated;
revoke all on function public.net_eu_tubifici1_d3_record(
 uuid,text,text,text,text,boolean,boolean,boolean,text,text,text
) from public,anon,authenticated;
grant execute on function public.net_eu_tubifici1_d3_queue(integer) to service_role;
grant execute on function public.net_eu_tubifici1_d3_record(
 uuid,text,text,text,text,boolean,boolean,boolean,text,text,text
) to service_role;
