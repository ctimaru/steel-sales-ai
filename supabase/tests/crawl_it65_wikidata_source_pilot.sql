-- CRAWL-IT6.5 synthetic acceptance of proposed source registry entry.
-- Read only, must not move governance/worker enablement.
begin;
do $$
declare v public.network_discovery_source_registry%rowtype;
begin
  select * into v from public.network_discovery_source_registry
  where source_url='https://query.wikidata.org/sparql';
  if not found then raise exception 'CRAWL-IT6.5 Wikidata candidate source absent'; end if;
  if v.country_code <> 'IT' or v.source_type <> 'curated_public_source'
     or v.max_domains_per_run <> 5 or v.minimum_interval_hours <> 168
     or v.governance_status <> 'unreviewed' or v.enabled_for_discovery
     or v.reviewed_by is not null or v.reviewed_at is not null then
    raise exception 'CRAWL-IT6.5 source must be unreviewed, disabled, tightly capped';
  end if;
  if v.rights_evidence_url <> 'https://www.wikidata.org/wiki/Wikidata:Licensing' then
    raise exception 'CRAWL-IT6.5 official license evidence missing';
  end if;
  if exists(select 1 from public.network_discovery_domain_leads
     where source_id=v.id) then
    raise exception 'CRAWL-IT6.5 migration must not create leads';
  end if;
  if has_function_privilege('anon','public.crawl_it3_claim_due_source()','EXECUTE')
     or has_function_privilege('authenticated','public.crawl_it3_claim_due_source()','EXECUTE') then
    raise exception 'worker lease accessible outside service role';
  end if;
end $$;
rollback;
