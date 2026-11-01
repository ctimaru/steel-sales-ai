-- NET-GROWTH2C.1 — source-backed identity recovery, Italian Network.
-- Private, append-only review events; never resolve legal identity or publish by inference.
-- This migration creates NO company, claim, verification, facility or connection.

create table if not exists private.netgrowth2c1_identity_evidence (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.network_core_target_leads(id),
  event_state text not null check (event_state in (
    'review_started','source_observed','needs_more_evidence',
    'duplicate_risk_hold','group_structure_hold'
  )),
  observed_legal_name text check (
    observed_legal_name is null or length(btrim(observed_legal_name)) between 3 and 180
  ),
  source_url text check (
    source_url is null or (length(source_url)<=2000 and source_url ~* '^https://[^[:space:]]+$')
  ),
  evidence_note text not null default '' check (length(evidence_note)<=1000),
  reviewed_by uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  constraint netgrowth2c1_source_observation_guard check (
    event_state <> 'source_observed'
    or (source_url is not null and length(btrim(evidence_note))>=12 and reviewed_by is not null)
  ),
  constraint netgrowth2c1_observed_name_guard check (
    observed_legal_name is null or source_url is not null
  )
);
create index if not exists netgrowth2c1_identity_evidence_latest_idx
  on private.netgrowth2c1_identity_evidence(lead_id,recorded_at desc,id desc);
alter table private.netgrowth2c1_identity_evidence enable row level security;
revoke all on private.netgrowth2c1_identity_evidence from public,anon,authenticated;

create or replace function private.netgrowth2c1_no_event_mutation()
returns trigger language plpgsql set search_path='' as $function$
begin
 raise exception 'NET-GROWTH2C identity evidence is append-only' using errcode='42501';
end
$function$;
revoke all on function private.netgrowth2c1_no_event_mutation() from public,anon,authenticated;
drop trigger if exists netgrowth2c1_identity_evidence_immutable
  on private.netgrowth2c1_identity_evidence;
create trigger netgrowth2c1_identity_evidence_immutable
before update or delete on private.netgrowth2c1_identity_evidence
for each row execute function private.netgrowth2c1_no_event_mutation();

-- Platform-only, read-only and bounded: review work, NOT a publishing queue.
create or replace function public.netgrowth2c1_identity_recovery_page(
 p_kind text default 'all',
 p_limit integer default 25,
 p_offset integer default 0
) returns jsonb language plpgsql stable security definer
set search_path=''
as $function$
declare v jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 if p_kind is null or p_kind not in (
   'all','identity_collision_review','group_or_brand_review',
   'legal_identity_enrichment','corporate_form_source_review'
 ) or p_limit is null or p_limit<1 or p_limit>25
   or p_offset is null or p_offset<0 or p_offset>10000 then
   raise exception 'Invalid bounded identity recovery request' using errcode='22023';
 end if;

 with base as (
   select r.lead_id,r.company_name,r.canonical_domain,r.evidence_url,
          r.next_action,r.name_in_catalog,r.domain_in_catalog,r.lead_name_collision,
          e.event_state,e.observed_legal_name,e.source_url as review_source_url,
          e.evidence_note as review_note,e.recorded_at as reviewed_at
   from private.net_growth2b_identity_recovery r
   left join lateral (
     select i.event_state,i.observed_legal_name,i.source_url,i.evidence_note,i.recorded_at
     from private.netgrowth2c1_identity_evidence i where i.lead_id=r.lead_id
     order by i.recorded_at desc,i.id desc limit 1
   ) e on true
 ), selected as (
   select * from base where p_kind='all' or next_action=p_kind
 ), page as (
   select * from selected
   order by case next_action
     when 'identity_collision_review' then 0
     when 'group_or_brand_review' then 1
     when 'corporate_form_source_review' then 2
     else 3 end,company_name,lead_id
   limit p_limit offset p_offset
 )
 select jsonb_build_object(
   'contract','net-growth2c1-identity-recovery-v1',
   'total',(select count(*) from base),
   'selected_total',(select count(*) from selected),
   'by_action',coalesce((select jsonb_object_agg(next_action,n)
      from (select next_action,count(*) as n from base group by next_action) counts),'{}'::jsonb),
   'events_recorded',(select count(distinct lead_id) from private.netgrowth2c1_identity_evidence),
   'publisher_enabled',coalesce((select enabled from private.net_pipeline1b2_settings where singleton=true),false),
   'identity_verified_by_this_process',0,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
      'lead_id',lead_id,'company_name',company_name,'domain',canonical_domain,
      'source_url',evidence_url,'next_action',next_action,
      'name_in_catalog',name_in_catalog,'domain_in_catalog',domain_in_catalog,
      'lead_name_collision',lead_name_collision,'review_state',event_state,
      'observed_legal_name',observed_legal_name,
      'review_source_url',review_source_url,'review_note',review_note,
      'reviewed_at',reviewed_at
   ) order by case next_action
      when 'identity_collision_review' then 0
      when 'group_or_brand_review' then 1
      when 'corporate_form_source_review' then 2
      else 3 end,company_name,lead_id) from page),'[]'::jsonb)
 ) into v;
 return v;
end
$function$;
revoke all on function public.netgrowth2c1_identity_recovery_page(text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.netgrowth2c1_identity_recovery_page(text,integer,integer)
  to authenticated,service_role;
comment on function public.netgrowth2c1_identity_recovery_page(text,integer,integer) is
 'discovery.read-only source-linked 25-row identity triage. Never merges, verifies, claims or publishes companies.';
