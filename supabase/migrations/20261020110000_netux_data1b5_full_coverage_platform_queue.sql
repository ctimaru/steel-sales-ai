-- NET-UX DATA1B.5: dynamic, platform-only, read-only 508+ steel source coverage.
-- IMPORTANT: count of source evidence is not number of legally verified companies.
-- No scan, claim, publication, credential exposure, or manual review implied.
create or replace function public.netdata1b5_coverage_queue(
 p_limit integer default 25,
 p_offset integer default 0,
 p_only_missing boolean default true
) returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_payload jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 if p_limit is null or p_limit < 1 or p_limit > 25
   or p_offset is null or p_offset < 0 or p_offset > 10000
   or p_only_missing is null then
   raise exception 'Invalid bounded source coverage request' using errcode='22023';
 end if;
 with entities as (
   select c.id,'canonical'::text kind,c.legal_name name,c.website_domain domain,
          c.website_url,null::text role_key
   from public.network_companies c
   where c.publication_status='published' and c.archived_at is null
   union all
   select d.id,'discovered',d.company_name,d.domain,d.website_url,d.role_key
   from private.netfast_discovered_records d
 ), candidates as (
   select e.*,lower(regexp_replace(coalesce(e.domain,''),'^www[.]','')) domain_norm,
     lower(regexp_replace(split_part(coalesce(e.website_url,''),'/',3),'^www[.]','')) site_host,
     count(*) over(partition by lower(regexp_replace(coalesce(e.domain,''),'^www[.]',''))) domain_uses,
     exists(select 1 from private.network_company_enrichment n where
        ((e.kind='canonical' and n.canonical_company_id=e.id)
          or (e.kind='discovered' and n.discovered_record_id=e.id))
        and n.field_key in ('products','services','industry')
        and n.review_status in ('candidate','accepted')) source_backed,
     exists(select 1 from private.network_company_enrichment n where
        ((e.kind='canonical' and n.canonical_company_id=e.id)
          or (e.kind='discovered' and n.discovered_record_id=e.id))
        and n.field_key in ('products','services','industry')
        and n.review_status='accepted') accepted_evidence
   from entities e
 ), marked as (
   select x.*,
     (x.website_url ~ '^https://[^/?#[:space:]]+' and x.domain_norm<>''
       and x.site_host=x.domain_norm and x.domain_uses=1) as scan_candidate,
     case when x.domain_uses>1 then 'shared_domain_identity_review'
       when x.site_host<>x.domain_norm or x.website_url !~ '^https://' then 'needs_official_site'
       when x.source_backed then 'technical_source_candidate_or_accepted'
       else 'needs_technical_source' end source_state,
     case when lower(x.name) ~
       '(tub(i|o|if|olari)|steel|metall|acciai|carpenter|curv|sald|pieg|pontegg|rimorch|serre|scaff|struttur|agri|macchin)'
       then 0 else 1 end as priority_band
   from candidates x
 ), chosen as (
   select * from marked
   where not p_only_missing or not source_backed
   order by case when domain_uses>1 then 0 else 1 end,
     priority_band,case when kind='canonical' then 0 else 1 end,
     lower(name),id
   limit p_limit offset p_offset
 )
 select jsonb_build_object(
   'contract','netux-data1b5-source-coverage-v1',
   'total',(select count(*)::integer from marked),
   'published',(select count(*)::integer from marked where kind='canonical'),
   'discovered',(select count(*)::integer from marked where kind='discovered'),
   'source_backed',(select count(*)::integer from marked where source_backed),
   'accepted_source_profiles',(select count(*)::integer from marked where accepted_evidence),
   'missing_technical',(select count(*)::integer from marked where not source_backed),
   'shared_domain_profiles',(select count(*)::integer from marked where domain_uses>1),
   'scan_candidates',(select count(*)::integer from marked where scan_candidate and not source_backed),
   'selected_total',(select count(*)::integer from marked where not p_only_missing or not source_backed),
   'source_rights_verified',false,
   'companies_verified_by_data1b5',0,
   'only_missing',p_only_missing,'offset',p_offset,'limit',p_limit,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
     'company_id',q.id,'kind',q.kind,'name',q.name,'domain',q.domain_norm,
     'role_key',q.role_key,
     'site',case when q.scan_candidate then q.website_url else null end,
     'source_state',q.source_state,
     'technical_source_present',q.source_backed,
     'accepted_source_present',q.accepted_evidence,
     'reuse_rights','not_assessed',
     'company_identity_verified',false,
     'commercial_capability_verified',false,
     'priority_band',q.priority_band
   ) order by case when q.domain_uses>1 then 0 else 1 end,
     q.priority_band,case when q.kind='canonical' then 0 else 1 end,lower(q.name),q.id)
    from chosen q),'[]'::jsonb)
 ) into v_payload;
 return v_payload;
end;
$function$;
revoke all on function public.netdata1b5_coverage_queue(integer,integer,boolean) from public,anon;
grant execute on function public.netdata1b5_coverage_queue(integer,integer,boolean) to authenticated;
comment on function public.netdata1b5_coverage_queue(integer,integer,boolean) is
'Platform-only dynamic source coverage of Network profiles. Neither URLs nor candidate technical evidence constitute verified company, rights or RFQ capability.';