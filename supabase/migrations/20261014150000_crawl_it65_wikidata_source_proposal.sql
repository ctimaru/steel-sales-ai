-- CRAWL-IT6.5: stage Wikidata's CC0 structured data endpoint for an
-- explicit human source-governance decision. This migration does NOT approve
-- or enable anything and does not claim the human review actor.
insert into public.network_discovery_source_registry(
  source_name,source_url,source_type,country_code,
  governance_status,terms_status,database_rights_status,
  personal_data_policy,rights_evidence_url,review_note,
  enabled_for_discovery,max_domains_per_run,minimum_interval_hours
)
select
  'Wikidata CC0 — aziende siderurgiche Italia (pilot)',
  'https://query.wikidata.org/sparql',
  'curated_public_source','IT',
  'unreviewed','not_checked','not_assessed','not_assessed',
  'https://www.wikidata.org/wiki/Wikidata:Licensing',
  'PROPOSTA, NON APPROVAZIONE: dati strutturati CC0 Wikidata; valutare separatamente limiti WDQS, natura aziendale, provenance e assenza di dati personali. Solo 5 domini, nessuna pubblicazione.',
  false,5,168
where not exists(
  select 1 from public.network_discovery_source_registry
  where lower(source_url)='https://query.wikidata.org/sparql'
);
