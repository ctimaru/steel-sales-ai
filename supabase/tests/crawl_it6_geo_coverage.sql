-- CRAWL-IT6 local transaction-only regression; no public company auto-enrichment.
begin;
do $$
begin
 if has_table_privilege('authenticated','public.network_it_geo_evidence_candidates','SELECT')
 or has_table_privilege('anon','public.network_it_geo_evidence_candidates','SELECT')
 then raise exception 'geo evidence leaked to public users'; end if;
 if has_table_privilege('authenticated','public.network_it_geographic_coverage_v','SELECT')
 then raise exception 'coverage view leaked to tenants'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='network_it_geographic_coverage_v'
 and c.reloptions @> array['security_invoker=true'])
 then raise exception 'coverage view must be security_invoker'; end if;
end $$;
rollback;
