-- NET-UX DATA1B.5: dynamic, platform-only, read-only 508+ steel source coverage.
-- IMPORTANT: count of source evidence is not number of legally verified companies.
-- No scan, claim, publication, credential exposure, or manual review implied.
-- Existing identity/rights conflicts stay on manual hold, NEVER scanned by default.
-- Holds are conservative workflow blockers; they do not decide legal identity or license.
create table if not exists private.netdata1b5_source_holds (
 entity_kind text not null check (entity_kind in ('canonical','discovered')),
 entity_id uuid not null,
 hold_reason text not null check (hold_reason in ('identity_conflict','rights_review')),
 note text not null check (length(note) between 12 and 300),
 created_at timestamptz not null default now(),
 primary key(entity_kind,entity_id)
);
alter table private.netdata1b5_source_holds enable row level security;
revoke all on private.netdata1b5_source_holds from public,anon,authenticated;
grant select on private.netdata1b5_source_holds to service_role;
comment on table private.netdata1b5_source_holds is
 'DATA1B.5 manual hold: no auto scan, promotion, company identity assertion or license clearance.';
with manual_holds(kind,domain,name,reason,note) as (values
 ('discovered','cmscinox.it','CMC Costruzioni Metalliche','identity_conflict','Nome scheda CMC e sito CMSC richiedono riconciliazione societaria prima di ogni import.'),
 ('discovered','tekna.it','Tekna S.p.A.','identity_conflict','Relazione tra Tekna e Voilap da riconciliare prima di attribuire informazioni societarie.'),
 ('discovered','orsigroup.it','ORSI Group S.r.l.','rights_review','Condizioni di riutilizzo sito da verificare: nessun crawling o ripubblicazione automatica.'),
 ('discovered','carraro.com','Carraro Group','rights_review','Condizioni di riutilizzo sito da verificare prima di estrarre evidenze industriali.'),
 ('discovered','dallara.it','Dallara','rights_review','Condizioni di riutilizzo sito da verificare prima di estrarre evidenze industriali.')
)
insert into private.netdata1b5_source_holds(entity_kind,entity_id,hold_reason,note)
select m.kind,d.id,m.reason,m.note from manual_holds m
join private.netfast_discovered_records d on m.kind='discovered'
 and d.domain=m.domain and d.company_name=m.name
on conflict do nothing;

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
       and x.site_host=x.domain_norm and x.domain_uses=1
       and h.entity_id is null) as scan_candidate,
     h.hold_reason,
     case when h.hold_reason='identity_conflict' then 'identity_hold_manual_review'
       when h.hold_reason='rights_review' then 'source_reuse_rights_hold'
       when x.domain_uses>1 then 'shared_domain_identity_review'
       when x.site_host<>x.domain_norm or x.website_url !~ '^https://' then 'needs_official_site'
       when x.source_backed then 'technical_source_candidate_or_accepted'
       else 'needs_technical_source' end source_state,
     case when lower(x.name) ~
       '(tub(i|o|if|olari)|steel|metall|acciai|carpenter|curv|sald|pieg|pontegg|rimorch|serre|scaff|struttur|agri|macchin)'
       then 0 else 1 end as priority_band
   from candidates x
   left join private.netdata1b5_source_holds h on h.entity_id=x.id and h.entity_kind=x.kind
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
   'explicit_governance_holds',(select count(*)::integer from marked where hold_reason is not null),
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
     'reuse_rights',case when q.hold_reason='rights_review' then 'requires_review' else 'not_assessed' end,
     'governance_hold',q.hold_reason,
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