begin;
create or replace function pg_temp.assert3(p boolean,r text)
returns void language plpgsql as $$
begin if not coalesce(p,false) then raise exception 'NET-FAST3 %',r;end if;end $$;
select pg_temp.assert3(
 not has_table_privilege('authenticated','public.network_netfast3_entities','SELECT')
 and not has_table_privilege('authenticated','public.network_netfast3_feed_grants','SELECT')
 and not has_table_privilege('anon','public.network_netfast3_import_batches','SELECT')
 and not has_table_privilege('anon','public.network_netfast3_suppressed_domains','SELECT'),
 'no client/private provider leakage');
select pg_temp.assert3(
 not has_function_privilege('anon','public.netfast3_grant_feed(uuid,text,text,timestamptz,boolean)','EXECUTE')
 and not has_function_privilege('anon','public.netfast3_bulk_import(uuid,text,jsonb)','EXECUTE')
 and not has_function_privilege('anon','public.netfast3_source_status()','EXECUTE')
 and not has_function_privilege('anon','public.netfast3_revoke_feed(uuid,text)','EXECUTE')
 and not has_function_privilege('anon','public.netfast3_suppress_domain(text,text)','EXECUTE'),
 'no anon actions');
select pg_temp.assert3(
 (select pg_get_viewdef('private.netfast_discovered_records'::regclass) like '%network_netfast3_entities%')
 and (select pg_get_viewdef('private.netfast_discovered_records'::regclass) like '%network_netfast3_suppressed_domains%'),
 'provisional import view and suppression');
select pg_temp.assert3(
 (select count(*) from public.network_netfast3_entities)=0 and
 (select count(*) from public.network_netfast3_feed_grants)=0,
 'no fictional licensed source seeded');
rollback;
