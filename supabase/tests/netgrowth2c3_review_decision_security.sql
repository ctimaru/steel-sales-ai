-- NET-GROWTH2C.3 negative security / immutable decision contract (isolated CI).
begin;
do $test$
declare src text;
begin
 if to_regprocedure('public.netgrowth2c3_record_product_review(uuid,text,text,text,boolean,boolean,boolean)') is null
  then raise exception 'Reviewer RPC missing'; end if;
 if has_function_privilege('anon','public.netgrowth2c3_record_product_review(uuid,text,text,text,boolean,boolean,boolean)','EXECUTE')
  then raise exception 'Anon may submit decisions'; end if;
 if not has_function_privilege('authenticated','public.netgrowth2c3_record_product_review(uuid,text,text,text,boolean,boolean,boolean)','EXECUTE')
  then raise exception 'Platform reviewer has no invoke grant'; end if;
 if has_table_privilege('authenticated','private.netgrowth2c3_product_review_events','SELECT')
   or has_table_privilege('authenticated','private.netgrowth2c3_product_review_events','INSERT')
   or has_table_privilege('anon','private.netgrowth2c3_product_review_events','SELECT')
   then raise exception 'Review event ledger directly exposed to browser roles'; end if;
 if not (select relrowsecurity from pg_class where oid='private.netgrowth2c3_product_review_events'::regclass)
   then raise exception 'Reviewer evidence RLS missing'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='private.netgrowth2c3_product_review_events'::regclass and
   tgname='netgrowth2c3_reviews_immutable' and not tgisinternal) then
   raise exception 'Append-only review trigger missing';
 end if;
 select pg_get_functiondef('public.netgrowth2c3_record_product_review(uuid,text,text,text,boolean,boolean,boolean)'::regprocedure) into src;
 if position('private.require_platform_permission(''discovery.review'')' in src)=0
  or position('private.require_platform_permission(''discovery.enrich'')' in src)=0
  or position('v_e.canonical_company_id is null' in src)=0
  or position('source_rights_confirmed' in src)=0
  or position('attribute_confirmed' in src)=0
  or position('review_status=''candidate''' in src)=0
  or position('publication_performed'',false' in src)=0 then
   raise exception 'Mandatory human review gate missing';
 end if;
 if src ~* 'update[[:space:]]+(public[.])?network_companies'
  or src ~* 'insert[[:space:]]+into[[:space:]]+(public[.])?network_company_products'
   then raise exception 'Human review RPC would alter published catalog'; end if;
 select pg_get_functiondef('public.netgrowth2c2_product_evidence_page(text,integer,integer)'::regprocedure) into src;
 if position('private.require_platform_permission(''discovery.read'')' in src)=0
  or position('netgrowth2c3_product_review_events' in src)=0
  or position('latest_decision' in src)=0 then
   raise exception 'Candidate reader missing review history';
 end if;
end;$test$;
rollback;
