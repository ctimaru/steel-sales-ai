-- NET-GROWTH2C.3 — private, immutable review decisions for product evidence.
-- Deliberately does NOT change network_company_enrichment.review_status,
-- network_company_products, network_companies, the publisher, or any public profile.
create table if not exists private.netgrowth2c3_product_review_events (
 id uuid primary key default gen_random_uuid(),
 evidence_id uuid not null references private.network_company_enrichment(id) on delete restrict,
 decision text not null check (decision in ('accepted','hold','rejected')),
 reviewer_role text not null check (reviewer_role in (
   'unclassified','tube_producer','trader_distributor','processor_service_provider',
   'end_user','tube_machinery_maker','finished_equipment_maker'
 )),
 reason text not null check (length(btrim(reason)) between 20 and 1000),
 source_url_snapshot text not null,
 value_snapshot jsonb not null,
 identity_confirmed boolean not null default false,
 source_rights_confirmed boolean not null default false,
 attribute_confirmed boolean not null default false,
 reviewed_by uuid not null references auth.users(id),
 recorded_at timestamptz not null default now(),
 constraint netgrowth2c3_acceptance_guard check (
   decision<>'accepted' or (
     reviewer_role<>'unclassified' and identity_confirmed
     and source_rights_confirmed and attribute_confirmed
     and source_url_snapshot ~* '^https://'
   )
 )
);
create index if not exists netgrowth2c3_review_latest
 on private.netgrowth2c3_product_review_events(evidence_id,recorded_at desc,id desc);
alter table private.netgrowth2c3_product_review_events enable row level security;
revoke all on private.netgrowth2c3_product_review_events from public,anon,authenticated;

create or replace function private.netgrowth2c3_no_mutation()
returns trigger language plpgsql set search_path='' as $f$
begin
 raise exception 'NET-GROWTH2C.3 review ledger is append-only' using errcode='42501';
end;$f$;
revoke all on function private.netgrowth2c3_no_mutation() from public,anon,authenticated;
drop trigger if exists netgrowth2c3_reviews_immutable on private.netgrowth2c3_product_review_events;
create trigger netgrowth2c3_reviews_immutable
before update or delete on private.netgrowth2c3_product_review_events
for each row execute function private.netgrowth2c3_no_mutation();

create or replace function public.netgrowth2c3_record_product_review(
 p_evidence_id uuid,p_decision text,p_reason text,p_role text,
 p_identity_confirmed boolean default false,
 p_source_rights_confirmed boolean default false,
 p_attribute_confirmed boolean default false
) returns jsonb language plpgsql volatile security definer set search_path='' as $f$
declare
 v_e private.network_company_enrichment%rowtype;
 v_company record;
 v_actor uuid;
 v_prior private.netgrowth2c3_product_review_events%rowtype;
 v_id uuid;
begin
 perform private.require_platform_permission('discovery.review');
 if p_decision='accepted' then
   perform private.require_platform_permission('discovery.enrich');
 end if;
 v_actor:=auth.uid();
 if v_actor is null then raise exception 'Authenticated reviewer required' using errcode='42501'; end if;
 if p_evidence_id is null or p_decision is null or p_decision not in ('accepted','hold','rejected')
   or p_role is null or p_role not in (
    'unclassified','tube_producer','trader_distributor','processor_service_provider',
    'end_user','tube_machinery_maker','finished_equipment_maker')
   or p_reason is null or length(btrim(p_reason)) not between 20 and 1000
   or p_identity_confirmed is null or p_source_rights_confirmed is null
   or p_attribute_confirmed is null then
   raise exception 'Invalid review decision and rationale' using errcode='22023';
 end if;
 -- Serializes concurrent submissions for the same evidence without touching original evidence.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_evidence_id::text));
 select * into v_e from private.network_company_enrichment
 where id=p_evidence_id and field_key='products' and review_status='candidate'
 for share;
 if not found then raise exception 'Candidate product evidence not available' using errcode='22023'; end if;
 if p_decision='accepted' then
   if v_e.canonical_company_id is null or
      not p_identity_confirmed or not p_source_rights_confirmed or not p_attribute_confirmed
      or p_role='unclassified' or v_e.evidence_url !~* '^https://' then
      raise exception 'Acceptance requires canonical identity, HTTPS source, rights and field attribution' using errcode='22023';
   end if;
   select publication_status,archived_at into v_company
   from public.network_companies where id=v_e.canonical_company_id;
   if not found or v_company.publication_status<>'published' or v_company.archived_at is not null then
      raise exception 'Acceptance restricted to active published canonical companies' using errcode='22023';
   end if;
 end if;

 select * into v_prior from private.netgrowth2c3_product_review_events
 where evidence_id=p_evidence_id order by recorded_at desc,id desc limit 1;
 if found and v_prior.decision=p_decision and v_prior.reason=btrim(p_reason)
   and v_prior.reviewer_role=p_role
   and v_prior.identity_confirmed=p_identity_confirmed
   and v_prior.source_rights_confirmed=p_source_rights_confirmed
   and v_prior.attribute_confirmed=p_attribute_confirmed
   and v_prior.source_url_snapshot=v_e.evidence_url
   and v_prior.value_snapshot=v_e.field_value then
   return jsonb_build_object('event_id',v_prior.id,'decision',v_prior.decision,
     'idempotent',true,'publication_performed',false);
 end if;
 insert into private.netgrowth2c3_product_review_events
 (evidence_id,decision,reviewer_role,reason,source_url_snapshot,value_snapshot,
  identity_confirmed,source_rights_confirmed,attribute_confirmed,reviewed_by)
 values (p_evidence_id,p_decision,p_role,btrim(p_reason),v_e.evidence_url,v_e.field_value,
   p_identity_confirmed,p_source_rights_confirmed,p_attribute_confirmed,v_actor)
 returning id into v_id;
 return jsonb_build_object('event_id',v_id,'decision',p_decision,
   'idempotent',false,'publication_performed',false);
end;$f$;
revoke all on function public.netgrowth2c3_record_product_review(uuid,text,text,text,boolean,boolean,boolean)
 from public,anon,authenticated;
grant execute on function public.netgrowth2c3_record_product_review(uuid,text,text,text,boolean,boolean,boolean)
 to authenticated,service_role;
comment on function public.netgrowth2c3_record_product_review(uuid,text,text,text,boolean,boolean,boolean) is
 'Human Platform reviewer; accepted requires discovery.review + discovery.enrich and independent source/identity/rights confirmation. Records audit event only; NEVER publishes.';


-- Extend the read-only candidate queue with latest human review state. Original
-- evidence remains candidate even after review and MUST NOT enter public profiles.
-- NET-GROWTH2C.2 — governed product evidence triage, read-only.
-- This migration DOES NOT accept any evidence, create companies or publish data.
create or replace function public.netgrowth2c2_product_evidence_page(
  p_lane text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $function$
declare payload jsonb;
begin
  perform private.require_platform_permission('discovery.read');
  if p_lane is null or p_lane not in ('all','canonical','provisional')
    or p_limit is null or p_limit < 1 or p_limit > 25
    or p_offset is null or p_offset < 0 or p_offset > 10000 then
    raise exception 'Invalid bounded product evidence page' using errcode='22023';
  end if;

  with candidate as (
    select e.id,e.field_key,e.field_value,e.evidence_url,e.confidence,e.fetched_at,
      e.extractor_version,e.review_status,e.canonical_company_id,e.discovered_record_id,
      lr.decision as latest_decision, lr.reason as latest_reason, lr.recorded_at as last_reviewed_at, lr.reviewer_role as last_reviewer_role,
      case when e.canonical_company_id is not null then 'canonical' else 'provisional' end as lane,
      coalesce(c.legal_name,d.company_name,'Identità da riconciliare') as company_name,
      coalesce(c.website_domain,d.domain,'') as domain,
      (c.id is not null and c.publication_status='published' and c.archived_at is null) as is_published
    from private.network_company_enrichment e
    left join public.network_companies c on c.id=e.canonical_company_id
    left join private.netfast_discovered_records d on d.id=e.discovered_record_id
    left join lateral (
      select re.decision,re.reason,re.recorded_at,re.reviewer_role
      from private.netgrowth2c3_product_review_events re where re.evidence_id=e.id
      order by re.recorded_at desc,re.id desc limit 1
    ) lr on true
    where e.field_key='products' and e.review_status='candidate'
  ), filtered as (
    select * from candidate where p_lane='all' or lane=p_lane
  ), page as (
    select * from filtered
    order by case when lane='canonical' then 0 else 1 end,
      confidence desc nulls last,company_name,id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'contract','net-growth2c2-product-review-v1',
    'total_candidates',(select count(*) from candidate),
    'canonical_candidates',(select count(*) from candidate where lane='canonical'),
    'provisional_candidates',(select count(*) from candidate where lane='provisional'),
    'selected_total',(select count(*) from filtered),
    'accepted_by_this_process',(select count(*) from candidate where latest_decision='accepted'),
    'on_hold',(select count(*) from candidate where latest_decision='hold'),
    'rejected_after_review',(select count(*) from candidate where latest_decision='rejected'),
    'not_yet_reviewed',(select count(*) from candidate where latest_decision is null),
    'publication_performed',false,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.company_name,'domain',p.domain,
      'lane',p.lane,'is_published',p.is_published,
      'review_status',p.review_status,'latest_decision',p.latest_decision,
      'latest_reason',p.latest_reason,'last_reviewed_at',p.last_reviewed_at,
      'last_reviewer_role',p.last_reviewer_role,'confidence',p.confidence,
      'fetched_at',p.fetched_at,'source_url',p.evidence_url,
      'extractor_version',p.extractor_version,
      'products',coalesce((
        select jsonb_agg(left(x.value,140) order by x.ordinality)
        from jsonb_array_elements_text(
          case when jsonb_typeof(p.field_value)='array' then p.field_value else '[]'::jsonb end
        ) with ordinality as x(value,ordinality)
        where x.ordinality<=4
      ),'[]'::jsonb)
    ) order by case when p.lane='canonical' then 0 else 1 end,
      p.confidence desc nulls last,p.company_name,p.id) from page p),'[]'::jsonb)
  ) into payload;
  return payload;
end;
$function$;
revoke all on function public.netgrowth2c2_product_evidence_page(text,integer,integer)
from public,anon,authenticated;
grant execute on function public.netgrowth2c2_product_evidence_page(text,integer,integer)
to authenticated,service_role;
comment on function public.netgrowth2c2_product_evidence_page(text,integer,integer) is
 'Platform discovery.read only. Candidate product excerpts (max 4 brief phrases), no acceptance, rights approval or company publication.';
