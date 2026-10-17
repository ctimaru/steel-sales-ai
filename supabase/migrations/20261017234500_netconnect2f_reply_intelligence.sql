-- NET-CONNECT2F — workspace-private decision intelligence and explainable
-- overlap of PUBLIC company-product families. No inferred supplier quality,
-- outbound messaging, vendor response leaderboard or personally identifiable data.
create or replace function private.netconnect2f_intelligence_impl(
 p_organization_id uuid,p_company_ids uuid[]
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_owned uuid;
 v_sent integer:=0;
 v_accepted integer:=0;
 v_declined integer:=0;
 v_decided integer:=0;
 v_pending_old integer:=0;
 v_median numeric;
 v_company uuid;
 v_products jsonb;
 v_items jsonb:='[]'::jsonb;
begin
 perform private.netux11_require_active_company(p_organization_id);
 if p_company_ids is null or coalesce(array_length(p_company_ids,1),0)>24
    or array_position(p_company_ids,null) is not null then
   raise exception 'Invalid intelligence batch' using errcode='22023';
 end if;
 -- Only a governed, APPROVED claim grants owner-specific company signals.
 select l.network_company_id into v_owned
 from public.organization_network_company_links l
 join public.network_company_claims cl on cl.organization_id=l.organization_id
   and cl.network_company_id=l.network_company_id and cl.status='approved'
 join public.network_companies c on c.id=l.network_company_id
   and c.publication_status='published' and c.archived_at is null
 where l.organization_id=p_organization_id and l.link_status='active'
 order by l.created_at desc limit 1;

 -- Aggregates only this sender organization's real decisions. Never expose
 -- per-recipient reply performance; decisions != messages or replies.
 select count(*)::integer,
        count(*) filter(where r.status='accepted')::integer,
        count(*) filter(where r.status='declined')::integer,
        count(*) filter(where r.status in ('accepted','declined') and
                            r.decided_at is not null and r.decided_at>=r.created_at)::integer,
        percentile_cont(0.5) within group
          (order by extract(epoch from (r.decided_at-r.created_at))/3600.0)
          filter(where r.status in ('accepted','declined') and
                 r.decided_at is not null and r.decided_at>=r.created_at)
 into v_sent,v_accepted,v_declined,v_decided,v_median
 from public.network_connection_requests r
 where r.sender_organization_id=p_organization_id
   and r.created_at>=now()-interval '90 days';

 select count(*)::integer into v_pending_old
 from public.network_connection_requests r
 where r.sender_organization_id=p_organization_id
   and r.status='pending' and r.created_at<=now()-interval '7 days';

 for v_company in select distinct x from unnest(p_company_ids) as x loop
   v_products:='[]'::jsonb;
   if v_owned is not null and v_company<>v_owned and exists(
     select 1 from public.network_companies c
     where c.id=v_company and c.publication_status='published'
       and c.archived_at is null
   ) then
     select coalesce(jsonb_agg(p.display_name order by p.display_name),'[]'::jsonb)
       into v_products from (
       select distinct pf.display_name
       from public.network_company_products own_p
       join public.network_company_products target_p
         on target_p.product_family_id=own_p.product_family_id
        and target_p.company_id=v_company
       join public.network_product_families pf on pf.id=own_p.product_family_id
         and pf.status='active'
       where own_p.company_id=v_owned
       order by pf.display_name limit 2
     ) p;
   end if;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'company_id',v_company,'shared_public_products',v_products
   ));
 end loop;
 return jsonb_build_object(
  'contract','netconnect2f-intelligence-v1','organization_id',p_organization_id,
  'period_days',90,'sent',v_sent,'accepted',v_accepted,'declined',v_declined,
  'decided_with_timestamp',v_decided,
  'median_decision_hours',case when v_decided>=3
    then round(v_median::numeric,1) else null end,
  'pending_over_7_days',v_pending_old,'items',v_items
 );
end $$;
revoke all on function private.netconnect2f_intelligence_impl(uuid,uuid[]) from public,anon,authenticated;

create or replace function public.netconnect2f_intelligence(
 p_organization_id uuid,p_company_ids uuid[]
) returns jsonb language sql stable security definer set search_path='' as $$
 select private.netconnect2f_intelligence_impl(p_organization_id,p_company_ids);
$$;
revoke all on function public.netconnect2f_intelligence(uuid,uuid[]) from public,anon;
grant execute on function public.netconnect2f_intelligence(uuid,uuid[]) to authenticated;
