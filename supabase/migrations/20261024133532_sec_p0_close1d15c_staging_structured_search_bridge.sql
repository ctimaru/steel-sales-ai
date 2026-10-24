-- Reconciles existing STAGING migration ledger version 20261024133532.
-- SQL definition retrieved from staging pg_get_functiondef; default SECURITY INVOKER.
-- Any production promotion requires separate schema and security approval.
CREATE OR REPLACE FUNCTION public.p1_global_structured_search_bridge_v2(p_organization_id uuid, p_query text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[], p_filters jsonb DEFAULT '{}'::jsonb, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_types text[] := coalesce(p_types, array[]::text[]);
  v_base jsonb := '{"results":[],"counts":{},"total":0}'::jsonb;
  v_rfq_results jsonb := '[]'::jsonb;
  v_rfq_total bigint := 0;
  v_rfq_rows jsonb;
  v_all jsonb;
  v_counts jsonb;
begin
  if p_organization_id is null then
    raise exception 'An organization scope is required';
  end if;
  if cardinality(v_types)=0 or exists (select 1 from unnest(v_types) t where t <> 'rfq') then
    select public.p1_global_structured_search(
      p_organization_id,p_query,
      array(select t from unnest(v_types) t where t <> 'rfq'),
      p_filters,p_limit
    ) into v_base;
  end if;
  if cardinality(v_types)=0 or 'rfq'=any(v_types) then
    select count(*) into v_rfq_total
    from public.buyer_rfq_campaigns c
    where c.organization_id=p_organization_id
      and (nullif(btrim(coalesce(p_query,'')),'') is null
        or c.title ilike '%'||btrim(p_query)||'%');
    select coalesce(jsonb_agg(jsonb_build_object(
      'result_type','rfq',
      'result_id',c.id::text,
      'title',c.title,
      'subtitle',c.status,
      'snippet',null,
      'event_at',c.updated_at,
      'role','requested',
      'score',1.0,
      'metadata','{}'::jsonb
    ) order by c.updated_at desc),'[]'::jsonb)
    into v_rfq_results
    from (select * from public.buyer_rfq_campaigns c
       where c.organization_id=p_organization_id
         and (nullif(btrim(coalesce(p_query,'')),'') is null
              or c.title ilike '%'||btrim(p_query)||'%')
       order by c.updated_at desc limit greatest(1,least(coalesce(p_limit,50),100))) c;
  end if;
  select coalesce(jsonb_agg(item),'[]'::jsonb)
  into v_all from (
    select value as item from jsonb_array_elements(coalesce(v_base->'results','[]'::jsonb))
    union all
    select value as item from jsonb_array_elements(v_rfq_results)
  ) items;
  select coalesce(jsonb_object_agg(result_type,n),'{}'::jsonb)
  into v_counts
  from (select item->>'result_type' as result_type,count(*)::int as n
     from jsonb_array_elements(v_all) item
     group by 1) grouped;
  return jsonb_build_object(
    'results', (select coalesce(jsonb_agg(item),'[]'::jsonb) from
      (select item from jsonb_array_elements(v_all) item
       order by (item->>'score')::numeric desc nulls last
       limit greatest(1,least(coalesce(p_limit,50),100))) limited),
    'counts',v_counts,
    'total',coalesce((v_base->>'total')::bigint,0)+v_rfq_total
  );
end;
$function$;
revoke all on function public.p1_global_structured_search_bridge_v2(uuid,text,text[],jsonb,integer) from public, anon, authenticated;
grant execute on function public.p1_global_structured_search_bridge_v2(uuid,text,text[],jsonb,integer) to service_role;
comment on function public.p1_global_structured_search_bridge_v2(uuid,text,text[],jsonb,integer) is 'Staging controlled tenant-filtered RFQ bridge with legacy structured families. Restricted service role.';
