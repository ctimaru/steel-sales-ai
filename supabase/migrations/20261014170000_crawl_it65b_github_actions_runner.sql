-- CRAWL-IT6.5b: GitHub Actions low-volume Wikidata ingestion.
-- SECURITY INVOKER; only a backend service_role key may call these public RPCs.
-- Source's human review and weekly cadence remain the authorization boundary.
create or replace function public.crawl_it65b_source_preflight()
returns jsonb
language plpgsql stable security invoker set search_path=''
as $$
declare v public.network_discovery_source_registry%rowtype;
        v_ready boolean;
begin
  if current_user <> 'service_role' then
    raise exception 'crawler service role required' using errcode='42501';
  end if;
  select * into v from public.network_discovery_source_registry
   where source_url='https://query.wikidata.org/sparql'
   and country_code='IT' limit 1;
  if not found then
    return jsonb_build_object('eligible',false,'reason','source_absent');
  end if;
  v_ready := v.enabled_for_discovery
    and v.governance_status='approved'
    and v.terms_status in ('allows_reuse','allows_limited_reuse')
    and v.database_rights_status in ('low_risk','licensed')
    and v.personal_data_policy in ('company_data_only','exclude_personal_data')
    and v.reviewed_by is not null and v.reviewed_at is not null
    and nullif(btrim(coalesce(v.rights_evidence_url,'')),'') is not null
    and v.max_domains_per_run between 1 and 5
    and v.minimum_interval_hours >= 168;
  return jsonb_build_object(
    'eligible',v_ready and
      (v.last_discovered_at is null or
       v.last_discovered_at <= now()-make_interval(hours=>v.minimum_interval_hours)),
    'reason',case when not v_ready then 'governance_or_budget_gate'
                 when v.last_discovered_at is not null and
                   v.last_discovered_at > now()-make_interval(hours=>v.minimum_interval_hours)
                   then 'not_due' else 'due' end,
    'max_domains',least(v.max_domains_per_run,5),
    'next_due_at',case when v.last_discovered_at is null then null
      else v.last_discovered_at+make_interval(hours=>v.minimum_interval_hours) end);
end $$;
revoke all on function public.crawl_it65b_source_preflight() from public,anon,authenticated;
grant execute on function public.crawl_it65b_source_preflight() to service_role;

create or replace function public.crawl_it65b_commit_wikidata_leads(p_items jsonb)
returns jsonb
language plpgsql volatile security invoker set search_path=''
as $$
declare
  v_source public.network_discovery_source_registry%rowtype;
  v_item jsonb;
  v_domain text;
  v_label text;
  v_url text;
  v_evidence text;
  v_seen text[] := '{}'::text[];
  v_attempted integer;
  v_new integer := 0;
  v_existing integer := 0;
  v_network integer := 0;
  v_candidate integer := 0;
  v_rowcount integer;
begin
  if current_user <> 'service_role' then
    raise exception 'crawler service role required' using errcode='42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 5 then
    raise exception 'crawler batch must contain zero to five items' using errcode='22023';
  end if;
  v_attempted := jsonb_array_length(p_items);
  -- Select exactly the one rights-approved Wikidata source; wait on a
  -- conflicting lock, then recheck last_discovered_at after it releases.
  select * into v_source from public.network_discovery_source_registry
    where source_url='https://query.wikidata.org/sparql'
      and country_code='IT'
    for update;
  if not found
     or v_source.enabled_for_discovery is distinct from true
     or v_source.governance_status <> 'approved'
     or v_source.terms_status not in ('allows_reuse','allows_limited_reuse')
     or v_source.database_rights_status not in ('low_risk','licensed')
     or v_source.personal_data_policy not in ('company_data_only','exclude_personal_data')
     or v_source.reviewed_by is null or v_source.reviewed_at is null
     or nullif(btrim(coalesce(v_source.rights_evidence_url,'')),'') is null
     or v_source.max_domains_per_run not between 1 and 5
     or v_source.minimum_interval_hours < 168
     or (v_source.last_discovered_at is not null and
         v_source.last_discovered_at > now()-make_interval(hours=>v_source.minimum_interval_hours))
  then
    raise exception 'crawler source not approved or weekly interval not due' using errcode='42501';
  end if;
  if v_attempted > v_source.max_domains_per_run then
    raise exception 'batch exceeds source budget' using errcode='22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' or
       (select count(*) from jsonb_object_keys(v_item)) <> 3 or
       not (v_item ?& array['domain','website','evidence']) then
      raise exception 'lead contains unexpected fields or missing evidence' using errcode='22023';
    end if;
    v_domain := v_item->>'domain';
    v_url := v_item->>'website';
    v_evidence := v_item->>'evidence';
    if v_domain is null or length(v_domain) not between 4 and 255
       or v_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
       or v_domain like '%..%' or
       v_url is distinct from 'https://' || v_domain || '/' or
       v_evidence is null or v_evidence !~ '^https://www[.]wikidata[.]org/wiki/Q[1-9][0-9]{0,13}$'
    then
      raise exception 'unsafe lead or Wikidata Q evidence' using errcode='22023';
    end if;
    foreach v_label in array string_to_array(v_domain,'.') loop
      if length(v_label) > 63 or v_label !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' then
        raise exception 'unsafe hostname label' using errcode='22023';
      end if;
    end loop;
    if v_domain = any(v_seen) then
      raise exception 'duplicate domain inside a batch' using errcode='22023';
    end if;
    v_seen := array_append(v_seen,v_domain);
    if exists (select 1 from public.network_companies c
               where c.archived_at is null and lower(c.website_domain)=v_domain) then
      v_network := v_network+1;
      continue;
    end if;
    if exists (select 1 from public.network_company_discovery_candidates c
               where c.canonical_domain=v_domain) then
      v_candidate := v_candidate+1;
      continue;
    end if;
    if exists (select 1 from public.network_discovery_domain_leads l
               where l.domain=v_domain) then
      v_existing := v_existing+1;
      continue;
    end if;
    insert into public.network_discovery_domain_leads
        (source_id,country_code,domain,proposed_url,evidence_url,status)
    values (v_source.id,'IT',v_domain,v_url,v_evidence,'pending_review')
    on conflict(source_id,domain) do nothing;
    get diagnostics v_rowcount = row_count;
    if v_rowcount = 1 then v_new := v_new+1;
    else v_existing := v_existing+1; end if;
  end loop;
  update public.network_discovery_source_registry
    set last_discovered_at=now(),updated_at=now()
    where id=v_source.id;
  return jsonb_build_object(
    'status','staged_for_human_review',
    'attempted',v_attempted,'inserted',v_new,'existing_leads',v_existing,
    'existing_network',v_network,'existing_candidates',v_candidate,
    'published',0,'next_due_at',now()+make_interval(hours=>v_source.minimum_interval_hours));
end $$;
revoke all on function public.crawl_it65b_commit_wikidata_leads(jsonb) from public,anon,authenticated;
grant execute on function public.crawl_it65b_commit_wikidata_leads(jsonb) to service_role;
comment on function public.crawl_it65b_commit_wikidata_leads(jsonb) is
'CRAWL-IT6.5b: service-only source-reviewed 5/domain 7d atomic staging. Never publishes or fetches companies.';
