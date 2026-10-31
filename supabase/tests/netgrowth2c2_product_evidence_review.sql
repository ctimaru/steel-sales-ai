-- NET-GROWTH2C.2 local SQL acceptance, no production mutations.
begin;
do $test$
declare def text;
begin
 if to_regprocedure('public.netgrowth2c2_product_evidence_page(text,integer,integer)') is null then
  raise exception 'NET-GROWTH2C.2 RPC missing';
 end if;
 if has_function_privilege('anon','public.netgrowth2c2_product_evidence_page(text,integer,integer)','EXECUTE') then
  raise exception 'Anon must not invoke candidate product evidence review';
 end if;
 if not has_function_privilege('authenticated','public.netgrowth2c2_product_evidence_page(text,integer,integer)','EXECUTE') then
  raise exception 'Authenticated Platform RPC grant missing';
 end if;
 if has_table_privilege('anon','private.network_company_enrichment','SELECT')
    or has_table_privilege('authenticated','private.network_company_enrichment','SELECT') then
  raise exception 'Raw candidate evidence directly exposed to browsers';
 end if;
 select pg_get_functiondef('public.netgrowth2c2_product_evidence_page(text,integer,integer)'::regprocedure) into def;
 if position('private.require_platform_permission' in def)=0 or
    position('discovery.read' in def)=0 then
  raise exception 'Discovery permission guard missing';
 end if;
 if position('p_limit > 25' in def)=0 or
    position('p_offset > 10000' in def)=0 then
  raise exception 'Bounded read not enforced';
 end if;
 if position('e.review_status=''candidate''' in def)=0 or
    position('e.field_key=''products''' in def)=0 then
  raise exception 'Candidate products isolation missing';
 end if;
 if def ~* '(insert[[:space:]]+into|delete[[:space:]]+from|update[[:space:]]+public\.network)' then
  raise exception 'Candidate review must not alter catalog';
 end if;
 if position('''publication_performed'',false' in def)=0 then
  raise exception 'No-publication signal missing';
 end if;
end;
$test$;
rollback;
