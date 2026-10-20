-- DATA1B.5C semantic ranking and privileges: read-only trust assertions.
begin;
do $$
declare v_function oid:=to_regprocedure('public.netdata1b4_steel_relevance_page(uuid,text,text,text,text,integer,integer)');
declare v_text text;
begin
 if v_function is null then raise exception 'Missing DATA1B.4 ranking function';end if;
 v_text:=pg_get_functiondef(v_function);
 if v_text not like '%deterministic-steel-tier-v2%' then
  raise exception 'DATA1B.5C semantic v2 was not applied';
 end if;
 if v_text like '%concat_ws('' '',e.field_value::text,e.evidence_excerpt)%' then
  raise exception 'Narrative negation still contributes to positive tube tiers';
 end if;
 if v_text not like '%field_key = ''products''%' and v_text not like '%field_key=''products''%' then
  raise exception 'No exclusion of manufacturers of equipment for tube work';
 end if;
 if has_function_privilege('anon',v_function,'EXECUTE') or
   not has_function_privilege('authenticated',v_function,'EXECUTE') then
  raise exception 'DATA1B.5C access boundary drift';
 end if;
 if exists(select 1 from private.network_company_enrichment where
  extractor_version='netux-data1b5c-buyers-processors-first-v1' and review_status<>'candidate') then
  raise exception 'DATA1B.5C evidence has been wrongly promoted';
 end if;
end $$;
rollback;
