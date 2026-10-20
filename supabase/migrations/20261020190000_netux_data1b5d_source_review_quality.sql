-- NET-UX DATA1B.5D source-quality review ledger. Distinguish source observation from
-- legally verified identity, permission to reuse, and actual RFQ qualification.
create table if not exists private.netdata1b5_source_assessments (
 id uuid primary key default gen_random_uuid(),
 entity_kind text not null check(entity_kind in ('canonical','discovered')),
 entity_id uuid not null,
 assessment_batch text not null check(length(assessment_batch) between 8 and 96),
 audit_outcome text not null check(audit_outcome in
 ('source_observed','needs_followup','no_source_after_review','identity_review','rights_review')),
 source_url text check(source_url is null or
   (source_url ~ '^https://[^/?#@[:space:]]+' and length(source_url)<=500)),
 role_suggestion text check(role_suggestion is null or role_suggestion in
 ('producer','trader_distributor','processor_service_provider','end_user')),
 review_note text not null check(length(review_note) between 20 and 600),
 source_reuse_rights text not null default 'not_assessed'
   check(source_reuse_rights in ('not_assessed','requires_review')),
 legal_identity_verified boolean not null default false check(not legal_identity_verified),
 commercial_capability_verified boolean not null default false check(not commercial_capability_verified),
 observed_at timestamptz not null default now(),
 unique(entity_kind,entity_id,assessment_batch)
);
alter table private.netdata1b5_source_assessments enable row level security;
revoke all on private.netdata1b5_source_assessments from public,anon,authenticated;
grant select on private.netdata1b5_source_assessments to service_role;
comment on table private.netdata1b5_source_assessments is
'Immutable research observations, not Platform editorial acceptance or legal verification; up to one assessment per entity per batch.';
-- Seed only manually inspected sources; failure to fetch is needs_followup, not no_source.
with findings(kind,domain,company_name,outcome,url,note,role) as (values
('discovered','asgspa.it','ASG S.p.A.','source_observed','https://www.asgspa.it/it/company','Official ASG company page explicitly identifies distribution of semi-finished steels and carbon steel pipes; taxonomy reconciled from processor to trader.','trader_distributor'),
('canonical','bmlaser.com','BM Laser S.r.l.','source_observed','https://www.bmlaser.com/servizi/','Official company services page names cutting/processing of metal tubes and sheet; commercial capacity not validated.',null),
('discovered','metalplastsrl.it','metalplastsrl.','source_observed','https://metalplastsrl.it/','Official company page names tube laser processing, bending and welding; service evidence only.',null),
('discovered','blmgroup.com','BLM Group','source_observed','https://www.blmgroup.com/it/macchine-lasertube','Official source sells LASERTUBE machinery; not a subcontractor for tube cutting.','producer'),
('discovered','brvstampaggioacciai.it','B.R.V. Srl','source_observed','https://www.brvstampaggioacciai.it/stampaggio-acciai-a-caldo/','Company describes steel hot forging on customer drawings; no tube processing inferred.','processor_service_provider'),
('discovered','bellon.it','Bellon','source_observed','https://bellon.it/come-nascono-le-falciatrici-bellon/','Official account describes internal turning and welding used to manufacture mowers, not third-party services.',null),
('discovered','iaconoserre.it','Iacono Serre','source_observed','https://iaconoserre.it/','Website identifies Iacono Serre S.r.l.s. and sells metal greenhouses, shelters and metal profiles; no structural tube use demonstrated.','producer'),
('discovered','zorziinox.it','Zorzi Inox','source_observed','https://www.zorziinox.it/settori/farma-chimica/','Stainless steel tanks and process fabrication described, without tube stock/purchasing evidence.',null),
('discovered','moronicm.it','MORONI COSTRUZIONI MECCANICHE','source_observed','https://www.moronicm.it/scavatrice/','Manufacturer lists harvest machinery with Hardox steel cutting blade; tube geometry not proven.',null),
('discovered','aedes.bz','AEDES COSTRUZIONI Srl','source_observed','https://www.aedes.bz/','Company legal name is AEDES COSTRUZIONI but site activity is professional agricultural machinery production, not civil-building contractor.','producer'),
('discovered','adraxles.com','A.D.R. SpA','source_observed','https://www.adraxles.com/en/home/','Official ADR site documents Teknoax product with seamless tubular axle body; cannot infer tube procurement.','producer'),
('discovered','3f-filippi.com','3F FILIPPI SpA','needs_followup','https://3f-filippi.com/it','General website accessible, precise lamp-component page previously unavailable; check source text before approving material claims.',null),
('discovered','combimetalcarrera.it','Combimetal Carrera','needs_followup',null,'Company URL timed out during research; no conclusion about absence of steel tube evidence or rights.',null),
('discovered','medgroupsrl.it','Med Group Serre','needs_followup',null,'Exact greenhouse product page not retrievable in current source check; previous candidate evidence requires separate recheck.',null),
('discovered','argotractors.com','ARGO TRACTORS S.p.A.','needs_followup',null,'Cab production page failed retrieval; previous source claim remains candidate and requires another inspection.',null)
), entities as (
 select 'canonical'::text kind,id,legal_name as company_name,website_domain as domain
 from public.network_companies where publication_status='published' and archived_at is null
 union all
 select 'discovered',id,company_name,domain from private.netfast_discovered_records
), matched as (
 select f.*, e.id, count(*) over(partition by f.domain) domain_uses
 from findings f join entities e on e.kind=f.kind and e.domain=f.domain and e.company_name=f.company_name
)
insert into private.netdata1b5_source_assessments
 (entity_kind,entity_id,assessment_batch,audit_outcome,source_url,role_suggestion,review_note)
select m.kind,m.id,'netux-data1b5d-research-v1',m.outcome,m.url,m.role,m.note from matched m
where m.domain_uses=1 and (m.url is null or
 lower(regexp_replace(split_part(m.url,'/',3),'^www[.]',''))=m.domain)
on conflict (entity_kind,entity_id,assessment_batch) do nothing;

-- The ASG staging role is derived from a governed discovery candidate.
-- Keep the original source immutable; propose trader_distributor for
-- editorial review instead of mutating an aggregated view or its source.
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
   select x.*, a.audit_outcome, a.source_url as audit_source_url, a.role_suggestion,
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
   left join lateral (
     select z.audit_outcome,z.source_url,z.role_suggestion
     from private.netdata1b5_source_assessments z
     where z.entity_id=x.id and z.entity_kind=x.kind
     order by z.observed_at desc,z.id desc limit 1
   ) a on true
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
   'source_assessed_profiles',(select count(*)::integer from marked where audit_outcome='source_observed'),
   'audit_followup_profiles',(select count(*)::integer from marked where audit_outcome in ('needs_followup','identity_review','rights_review')),
   'role_suggestions_pending',(select count(*)::integer from marked where role_suggestion is not null),
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
     'audit_outcome',q.audit_outcome,'audit_source_url',q.audit_source_url,
     'role_suggestion',q.role_suggestion,
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