-- NET-UX DATA1B.4: stable, globally paginated source-backed steel relevance.
-- Ranked signal != verified buyer, certified manufacturer, production capacity or quote availability.
-- The source may be candidate/accepted only. Do not expose private excerpts/field values.
create or replace function public.netdata1b4_steel_relevance_page(
 p_organization_id uuid,
 p_access text,
 p_query text default null,
 p_role text default null,
 p_region text default null,
 p_limit integer default 6,
 p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare v_total integer;v_published integer;v_evidence_total integer;v_items jsonb;
begin
 if p_access='free' then
   perform private.netux11_require_active_company(p_organization_id);
 elsif p_access='pro' then
   perform private.pa1_3_require_network_access(p_organization_id);
 else
   raise exception 'Invalid access mode' using errcode='22023';
 end if;
 if p_limit is null or p_limit<1 or p_limit>18 or p_offset is null or p_offset<0 or p_offset>10000
   or length(coalesce(p_query,''))>120 or length(coalesce(p_region,''))>90
   or (nullif(p_role,'') is not null and p_role not in
     ('producer','trader_distributor','processor_service_provider','end_user')) then
   raise exception 'Invalid steel relevance page' using errcode='22023';
 end if;
 with visible as (
   select c.id, 'published'::text as source_kind, c.legal_name as name,
     c.trading_name,c.country_code,c.website_url,c.website_domain as domain,
     c.claimed_status,c.verification_status,r.canonical_key as role_key,
     r.display_name as role_name,
     f.city,f.region,'published'::text as geography_status
   from public.network_companies c
   left join lateral (
     select cr.canonical_key,cr.display_name
     from public.network_company_role_assignments ra
     join public.network_company_roles cr on cr.id=ra.role_id
     where ra.company_id=c.id and cr.status='active'
     order by ra.is_primary desc,ra.id limit 1
   ) r on true
   left join lateral (
     select city,region from public.network_facilities
     where company_id=c.id and publication_status='published' and archived_at is null
     order by created_at,id limit 1
   ) f on true
   where c.publication_status='published' and c.archived_at is null
   union all
   select d.id,'discovered',d.company_name,null::text,'IT',d.website_url,d.domain,
     'unclaimed','unverified',d.role_key,
     coalesce(rr.display_name,'Categoria indicativa'),
     g.city,g.region,
     case when g.city is not null or g.region is not null
       then 'sourced_unverified' else 'unknown' end
   from private.netfast_discovered_records d
   left join public.network_company_roles rr on rr.canonical_key=d.role_key and rr.status='active'
   left join lateral (
     select city,region from public.network_neteima2_provisional_geo
     where target_id=d.id and status='source_observed'
     order by created_at desc,id limit 1
   ) g on true
 ), unique_sources as (
   select v.*,count(*) over(partition by lower(coalesce(v.domain,''))) as domain_uses
   from visible v
 ), ranked as (
   select b.*,ev.evidence_url,ev.review_status,ev.field_key,ev.field_value_text,
     coalesce(ev.priority,5) as priority,
     case
       when ev.priority=1 and b.role_key='trader_distributor' then 'Gamma tubi citata da fonte aziendale'
       when ev.priority=1 then 'Tubi o tubolari citati da fonte aziendale'
       when ev.priority=2 then 'Strutture o manufatti metallici documentati'
       when ev.priority=3 then 'Lavorazioni metalliche citate da fonte aziendale'
       when ev.priority=4 then 'Prodotti industriali descritti da fonte aziendale'
       else 'Impiego di acciaio o tubi non documentato'
     end as reason
   from unique_sources b
   left join lateral (
     select e.evidence_url,e.review_status,e.field_key,
       e.field_value::text as field_value_text,
       case
         when concat_ws(' ',e.field_value::text,e.evidence_excerpt) ~*
          '(tub(i|o|olari|olato)|tubo e giunto|pipes?|tubular)' then 1
         when concat_ws(' ',e.field_value::text,e.evidence_excerpt) ~*
          '(struttur|carpenter|telaio|telai|pensilin|metallic|acciaio|inox|corten|steel|serbatoi)' then 2
         when concat_ws(' ',e.field_value::text,e.evidence_excerpt) ~*
          '(saldatur|curvatur|piegatur|calandrat|laminatur|taglio|tagli|lavorazion)' then 3
         else 4
       end as priority
     from private.network_company_enrichment e
     where (
       (b.source_kind='published' and e.canonical_company_id=b.id)
       or (b.source_kind='discovered' and e.discovered_record_id=b.id)
     ) and e.field_key in ('products','services','industry')
       and e.review_status in ('candidate','accepted')
       and b.domain_uses=1
       and e.evidence_url ~ '^https://[^/?#@[:space:]]+'
       and lower(regexp_replace(split_part(e.evidence_url,'/',3),'^www[.]',''))
         = lower(regexp_replace(coalesce(b.domain,''),'^www[.]',''))
     order by priority,
       case when e.review_status='accepted' then 0 else 1 end,
       e.fetched_at desc,e.id
     limit 1
   ) ev on true
 ), filtered as (
   select * from ranked r where
     (nullif(btrim(coalesce(p_role,'')),'') is null or r.role_key=p_role)
     and (nullif(btrim(coalesce(p_region,'')),'') is null or
       lower(coalesce(r.region,''))=lower(btrim(p_region)))
     and (nullif(btrim(coalesce(p_query,'')),'') is null
       or strpos(lower(r.name),lower(btrim(p_query)))>0
       or strpos(lower(coalesce(r.trading_name,'')),lower(btrim(p_query)))>0
       or strpos(lower(coalesce(r.domain,'')),lower(btrim(p_query)))>0
       or strpos(lower(coalesce(r.field_value_text,'')),lower(btrim(p_query)))>0)
 ), selected as (
   select * from filtered
   order by priority,case when review_status='accepted' then 0 else 1 end,
     lower(name),id
   limit p_limit offset p_offset
 )
 select (select count(*)::integer from filtered),
   (select count(*)::integer from filtered where source_kind='published'),
   (select count(*)::integer from filtered where priority<5),
   coalesce((select jsonb_agg(jsonb_build_object(
     'id',s.id,'legal_name',s.name,'trading_name',s.trading_name,
     'country_code',s.country_code,'website_url',s.website_url,
     'claimed_status',s.claimed_status,'verification_status',s.verification_status,
     'discovery_status',case when s.source_kind='discovered' then 'unconfirmed' else null end,
     'roles',case when s.role_key is not null then jsonb_build_array(
       jsonb_build_object('key',s.role_key,'name',s.role_name,'is_primary',true)
     ) else '[]'::jsonb end,
     'products','[]'::jsonb,
     'location',case when s.region is not null or s.city is not null then
       jsonb_build_object('city',s.city,'region',s.region) else null end,
     'geography_status',s.geography_status,
     'steel_priority',s.priority,'steel_reason',s.reason,
     'steel_source_url',s.evidence_url,'steel_evidence_status',s.review_status
   ) order by s.priority,case when s.review_status='accepted' then 0 else 1 end,
     lower(s.name),s.id) from selected s),'[]'::jsonb)
 into v_total,v_published,v_evidence_total,v_items;
 return jsonb_build_object(
   'contract','netdata1b4-steel-ranking-v1','total',v_total,
   'published',v_published,'discovered',v_total-v_published,
   'evidence_total',v_evidence_total,'limit',p_limit,'offset',p_offset,
   'items',v_items,'candidate_not_verified',true,
   'score_version','deterministic-steel-tier-v1'
 );
end;
$function$;
revoke all on function public.netdata1b4_steel_relevance_page(
 uuid,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.netdata1b4_steel_relevance_page(
 uuid,text,text,text,text,integer,integer) to authenticated;
comment on function public.netdata1b4_steel_relevance_page(uuid,text,text,text,text,integer,integer) is
'Bounded, tenant-gated deterministic steel priority over published + governed discovered. Candidate sources unverified, no capacity inference.';