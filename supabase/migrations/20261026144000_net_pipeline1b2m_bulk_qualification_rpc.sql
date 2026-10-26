-- Read-only bulk qualification exposed exclusively to server-side service-role callers.
create or replace function public.net_pipeline1b2m_bulk_qualification(p_offset integer default 0,p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_rows jsonb; v_counts jsonb; v_total bigint;
begin
 if (select auth.role()) is distinct from 'service_role' then
   raise exception 'service role required' using errcode='42501';
 end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>1000 then
   raise exception 'invalid pagination' using errcode='22023';
 end if;
 select count(*) into v_total from private.net_pipeline1b2l_bulk_qualification;
 select coalesce(jsonb_object_agg(qualification,n),'{}'::jsonb) into v_counts
 from (select qualification,count(*) n from private.net_pipeline1b2l_bulk_qualification group by 1) x;
 select coalesce(jsonb_agg(jsonb_build_object('lead_id',lead_id,'company_name',company_name,
   'canonical_domain',canonical_domain,'qualification',qualification)
   order by canonical_domain),'[]'::jsonb) into v_rows
 from (select lead_id,company_name,canonical_domain,qualification
       from private.net_pipeline1b2l_bulk_qualification
       order by canonical_domain,lead_id limit p_limit offset p_offset) x;
 return jsonb_build_object('total',v_total,'offset',p_offset,'limit',p_limit,'by_status',v_counts,'rows',v_rows);
end;$$;
revoke all on function public.net_pipeline1b2m_bulk_qualification(integer,integer) from public,anon,authenticated;
grant execute on function public.net_pipeline1b2m_bulk_qualification(integer,integer) to service_role;
