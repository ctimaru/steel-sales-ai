-- CRAWL-IT6.10b.2: atomic insertion into the existing human-review Candidate Gate.
-- An operator-created and linked discovery run is required; never invent operator identity.
create or replace function public.crawl_it610b2_stage_candidate(
 p_lead_id uuid, p_candidate jsonb
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 v_lead public.network_discovery_domain_leads%rowtype;
 v_source public.network_discovery_source_registry%rowtype;
 v_run public.network_company_discovery_runs%rowtype;
 v_id uuid;
 v_domain text;
 v_name text;
 v_evidence jsonb;
 v_roles text[];
begin
 if current_user <> 'service_role' then
  raise exception 'service_role required' using errcode='42501';
 end if;
 if jsonb_typeof(p_candidate) <> 'object' then
  raise exception 'candidate object required' using errcode='22023';
 end if;
 select * into v_lead from public.network_discovery_domain_leads
  where id=p_lead_id for update;
 if not found or v_lead.status <> 'pending_review' or v_lead.intake_run_id is null then
  return jsonb_build_object('status','not_linked_or_not_pending','inserted',0,'published',0);
 end if;
 select * into v_source from public.network_discovery_source_registry
  where id=v_lead.source_id for share;
 if not found or not v_source.enabled_for_discovery
   or v_source.governance_status <> 'approved'
   or v_source.terms_status not in ('allows_reuse','allows_limited_reuse')
   or v_source.database_rights_status not in ('low_risk','licensed')
   or v_source.personal_data_policy not in ('company_data_only','exclude_personal_data')
   or v_source.reviewed_by is null or v_source.reviewed_at is null
   or nullif(btrim(coalesce(v_source.rights_evidence_url,'')),'') is null
 then raise exception 'source governance not approved' using errcode='42501'; end if;
 select * into v_run from public.network_company_discovery_runs
  where id=v_lead.intake_run_id for update;
 if not found or v_run.country_code <> 'IT'
   or v_run.status not in ('running','completed')
   or v_run.governance_status <> 'approved'
   or v_run.terms_status not in ('allows_reuse','allows_limited_reuse')
   or v_run.database_rights_status not in ('low_risk','licensed')
   or v_run.personal_data_policy not in ('company_data_only','exclude_personal_data')
 then raise exception 'approved discovery run required' using errcode='42501'; end if;
 v_domain := lower(btrim(coalesce(p_candidate->>'canonical_domain','')));
 v_name := btrim(coalesce(p_candidate->>'legal_name',''));
 v_evidence := p_candidate->'evidence';
 if v_domain <> v_lead.domain or v_name = '' or char_length(v_name)>255
   or coalesce(p_candidate->>'website_url','') !~ '^https://'
   or coalesce(p_candidate->>'source_url','') !~ '^https://'
   or jsonb_typeof(v_evidence) <> 'array'
   or jsonb_array_length(v_evidence) not between 1 and 3
 then raise exception 'invalid candidate evidence' using errcode='22023'; end if;
 if exists (select 1 from jsonb_array_elements(v_evidence) e
  where e->>'url' not like 'https://' || v_domain || '/%'
    and e->>'url' <> 'https://' || v_domain)
 then raise exception 'external evidence domain' using errcode='22023'; end if;
 select array_agg(r) into v_roles
 from jsonb_array_elements_text(coalesce(p_candidate->'role_keys','[]'::jsonb)) r;
 if coalesce(cardinality(v_roles),0) not between 1 and 4
  or exists(select 1 from unnest(v_roles) r where r not in
   ('producer','trader_distributor','processor_service_provider','end_user'))
 then raise exception 'invalid role evidence' using errcode='22023'; end if;
 if exists(select 1 from public.network_companies c
  where c.website_domain=v_domain and c.archived_at is null)
 then return jsonb_build_object('status','duplicate_existing_company','inserted',0,'published',0); end if;
 if exists(select 1 from public.network_company_discovery_candidates c
  where c.canonical_domain=v_domain)
 then return jsonb_build_object('status','duplicate_candidate','inserted',0,'published',0); end if;
 insert into public.network_company_discovery_candidates(
  run_id,source_url,canonical_domain,website_url,legal_name,country_code,
  role_keys,product_relations,evidence,source_urls,confidence,review_status,
  extraction_version,identity_quality,classification_scores,quality_flags,
  facility_candidates,capability_keys,market_keys,enrichment_quality)
 values(
  v_run.id,p_candidate->>'source_url',v_domain,p_candidate->>'website_url',v_name,'IT',
  v_roles,coalesce(p_candidate->'product_relations','[]'::jsonb),v_evidence,
  coalesce(p_candidate->'source_urls','[]'::jsonb),
  greatest(0,least(1,coalesce((p_candidate->>'confidence')::numeric,0))),
  'pending_review','p3.4-crawl-it610b2',
  coalesce(p_candidate->'identity_quality','{}'::jsonb),
  coalesce(p_candidate->'classification_scores','{}'::jsonb),
  coalesce(array(select jsonb_array_elements_text(coalesce(p_candidate->'quality_flags','[]'::jsonb))),array[]::text[]),
  coalesce(p_candidate->'facility_candidates','[]'::jsonb),
  coalesce(array(select jsonb_array_elements_text(coalesce(p_candidate->'capability_keys','[]'::jsonb))),array[]::text[]),
  coalesce(array(select jsonb_array_elements_text(coalesce(p_candidate->'market_keys','[]'::jsonb))),array[]::text[]),
  coalesce(p_candidate->'enrichment_quality','{}'::jsonb)
 ) returning id into v_id;
 update public.network_company_discovery_runs set candidate_count=candidate_count+1, updated_at=now()
 where id=v_run.id;
 return jsonb_build_object('status','pending_review','candidate_id',v_id,
   'inserted',1,'published',0);
end $$;
revoke all on function public.crawl_it610b2_stage_candidate(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.crawl_it610b2_stage_candidate(uuid,jsonb) to service_role;
comment on function public.crawl_it610b2_stage_candidate(uuid,jsonb) is
'Atomic governed bridge: only already linked approved discovery runs; human review required; never publish.';
