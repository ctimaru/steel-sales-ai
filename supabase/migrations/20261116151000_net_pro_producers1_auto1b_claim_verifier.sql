-- NET-PRO-PRODUCERS1.AUTO1.B
-- Automated validation of *source mentions*, not manufacturing capabilities.
-- Each candidate must be traceable to an unchanged first-party URL/content hash
-- and anchored by a literal textual excerpt. A grade, norm and range mentioned
-- separately NEVER establishes a jointly manufacturable product.
alter table private.network_producer_auto1_candidates
  add column if not exists verification_reason text,
  add column if not exists verified_at timestamptz,
  add column if not exists verifier_version text,
  add column if not exists evidence_level text
    check (evidence_level in ('source_mention_only','insufficient'));

create table if not exists private.network_producer_auto1_verification_events (
  id bigint generated always as identity primary key,
  candidate_id uuid not null references private.network_producer_auto1_candidates(id)
    on delete cascade,
  company_id uuid not null references public.network_companies(id) on delete cascade,
  outcome text not null check (outcome in ('confirmed','rejected')),
  evidence_level text not null check (evidence_level in ('source_mention_only','insufficient')),
  reason text not null check (char_length(reason) between 4 and 90),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  verifier_version text not null,
  reviewed_at timestamptz not null default now(),
  unique(candidate_id,verifier_version)
);
alter table private.network_producer_auto1_verification_events enable row level security;
revoke all on private.network_producer_auto1_verification_events
  from public,anon,authenticated;
create index if not exists network_producer_auto1_events_company_idx
  on private.network_producer_auto1_verification_events(company_id,reviewed_at desc);

create or replace function private.netproducers1_auto1b_verify(p_limit integer default 100)
returns jsonb
language plpgsql security definer set search_path=''
as $body$
declare v_candidate record;
declare v_confirmed int:=0;
declare v_rejected int:=0;
declare v_reason text;
declare v_ok boolean;
declare v_current_domain text;
declare v_excerpt text;
declare v_host text;
begin
 if p_limit not between 1 and 100 then
   raise exception 'Verification batch must contain 1..100 candidates' using errcode='22023';
 end if;
 for v_candidate in
  select a.*,q.canonical_domain,q.source_url as queue_url,q.last_sha256 as queue_sha,
         q.last_checked_at,q.status as source_status,
         c.website_domain,c.website_url,c.country_code,c.publication_status,
         c.archived_at
  from private.network_producer_auto1_candidates a
  join private.network_producer_auto1_sources q on q.company_id=a.company_id
  join public.network_companies c on c.id=a.company_id
  where a.evidence_status='pending_verification'
  order by a.observed_at,a.id
  for update of a skip locked
  limit p_limit
 loop
  v_reason:='source_mention_verified';
  v_ok:=true;
  v_excerpt:=lower(v_candidate.evidence_excerpt);
  v_host:=lower(regexp_replace(split_part(split_part(v_candidate.source_url,'/',3),':',1),'^www[.]',''));
  if v_candidate.publication_status<>'published'
     or v_candidate.archived_at is not null
     or v_candidate.country_code<>'IT'
     or not exists (
       select 1 from public.network_company_role_assignments x
       join public.network_company_roles r on r.id=x.role_id
       where x.company_id=v_candidate.company_id
         and r.canonical_key='producer' and r.status='active'
     )
  then
    v_ok:=false; v_reason:='not_current_published_producer';
  elsif v_candidate.canonical_domain<>v_candidate.website_domain
     or v_candidate.source_url<>v_candidate.queue_url
     or v_candidate.website_url<>v_candidate.queue_url
     or v_host<>v_candidate.canonical_domain
  then
    v_ok:=false; v_reason:='official_domain_mismatch';
  elsif v_candidate.queue_sha is distinct from v_candidate.source_sha256
     or v_candidate.last_checked_at is null
     or v_candidate.last_checked_at<now()-interval '35 days'
     or v_candidate.source_status not in ('candidate_review','processed','unchanged')
  then
    v_ok:=false; v_reason:='unconfirmed_source_revision';
  elsif position(lower(v_candidate.claim_value) in v_excerpt)=0
  then
    v_ok:=false; v_reason:='literal_quote_mismatch';
  elsif v_excerpt !~ '(tub|tubo|tube|tubular|acciai|steel|hollow|profil|prodott|product|weld|seamless|manufactur|struttural|structural)'
  then
    v_ok:=false; v_reason:='insufficient_technical_context';
  elsif v_excerpt ~ '(non[[:space:]]+(produ|disponibil|conform)|not[[:space:]]+(produ|availab|manufactur)|without[[:space:]]+(certif|grade)|escluso|not[[:space:]]+suitable)'
  then
    v_ok:=false; v_reason:='negative_or_conflicting_context';
  elsif v_candidate.claim_kind='technical_standard'
    and v_candidate.claim_value !~* '^EN[[:space:]]+(10219|10210|10305)([-–][1-5])?$'
  then
    v_ok:=false; v_reason:='unrecognized_standard';
  elsif v_candidate.claim_kind='steel_grade'
    and v_candidate.claim_value !~* '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H$'
  then
    v_ok:=false; v_reason:='unrecognized_grade';
  elsif v_candidate.claim_kind='manufacturing_process'
    and lower(v_candidate.claim_value) not in (
      'tubi saldati','tubi senza saldatura','tubi elettrosaldati',
      'welded steel tubes','seamless steel tubes'
    )
  then
    v_ok:=false; v_reason:='unrecognized_manufacturing_process';
  elsif v_candidate.claim_kind in ('dimension_range','section_shape')
  then
    -- Do not confirm an exact dimension or section until the extractor
    -- provides a typed product scope AND explicitly links the value to it.
    v_ok:=false; v_reason:='product_scope_not_documented';
  end if;
  update private.network_producer_auto1_candidates a
  set evidence_status=case when v_ok then 'confirmed' else 'rejected' end,
      evidence_level=case when v_ok then 'source_mention_only' else 'insufficient' end,
      verification_reason=v_reason,
      verifier_version='netproducers-auto1b-v1',
      verified_at=now(),
      updated_at=now()
  where a.id=v_candidate.id and a.evidence_status='pending_verification';
  insert into private.network_producer_auto1_verification_events
    (candidate_id,company_id,outcome,evidence_level,reason,
     source_sha256,verifier_version)
  values (
    v_candidate.id,v_candidate.company_id,
    case when v_ok then 'confirmed' else 'rejected' end,
    case when v_ok then 'source_mention_only' else 'insufficient' end,
    v_reason,v_candidate.source_sha256,'netproducers-auto1b-v1'
  ) on conflict(candidate_id,verifier_version) do nothing;
  if v_ok then v_confirmed:=v_confirmed+1; else v_rejected:=v_rejected+1; end if;
 end loop;
 return jsonb_build_object('contract','netproducers-auto1b-verify-v1',
   'checked',v_confirmed+v_rejected,
   'source_mentions_confirmed',v_confirmed,
   'insufficient_or_rejected',v_rejected,
   'producibility_demonstrated',0,
   'manufacturing_capabilities_published',0);
end;
$body$;
revoke all on function private.netproducers1_auto1b_verify(integer)
  from public,anon,authenticated;
grant execute on function private.netproducers1_auto1b_verify(integer)
  to service_role;

create or replace function public.netproducers1_auto1b_verify(p_limit integer default 100)
returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1b_verify(p_limit);
$body$;
revoke all on function public.netproducers1_auto1b_verify(integer)
  from public,anon,authenticated;
grant execute on function public.netproducers1_auto1b_verify(integer)
  to service_role;

-- Subscription-scoped source mentions: URL + literal value only, never evidence
-- text, extraction notes, document bodies or an alleged exact SKU. No
-- service-role read path in the web app; entitlement checked on each call.
create or replace function private.netproducers1_auto1b_mentions_impl(
 p_organization_id uuid,p_company_ids uuid[]
) returns jsonb
language plpgsql stable security definer set search_path=''
as $body$
declare v_items jsonb;
begin
 if not private.netpro1b_allowed_for(p_organization_id,'producers','IT') then
   raise exception 'Producers IT entitlement required' using errcode='42501';
 end if;
 if p_company_ids is null or cardinality(p_company_ids) not between 1 and 24 then
   raise exception 'Scoped company IDs required' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
     'id',t.id,'company_id',t.company_id,'claim_kind',t.claim_kind,
     'claim_value',t.claim_value,'source_url',t.source_url,
     'verified_at',t.verified_at,
     'evidence_level','source_mention_only'
   ) order by t.company_id,t.claim_kind,t.claim_value),'[]'::jsonb)
 into v_items
 from (
   select a.* from private.network_producer_auto1_candidates a
   join private.network_producer_auto1_sources q on q.company_id=a.company_id
   join public.network_companies c on c.id=a.company_id
   where a.company_id=any(p_company_ids)
     and a.evidence_status='confirmed'
     and a.evidence_level='source_mention_only'
     and a.verifier_version='netproducers-auto1b-v1'
     and a.source_sha256=q.last_sha256
     and a.source_url=q.source_url
     and q.source_url=c.website_url
     and q.canonical_domain=c.website_domain
     and q.last_checked_at>=now()-interval '35 days'
     and c.country_code='IT' and c.publication_status='published'
     and c.archived_at is null
     and exists (
       select 1 from public.network_company_role_assignments x
       join public.network_company_roles r on r.id=x.role_id
       where x.company_id=c.id and r.canonical_key='producer' and r.status='active'
     )
   order by a.company_id,a.claim_kind,a.claim_value
   limit 160
 ) t;
 return jsonb_build_object(
   'contract','netproducers-auto1b-mentions-v1',
   'items',v_items,'total',jsonb_array_length(v_items));
end;
$body$;

create or replace function public.netproducers1_auto1b_mentions(
 p_organization_id uuid,p_company_ids uuid[]
) returns jsonb
language sql stable security invoker set search_path=''
as $body$
 select private.netproducers1_auto1b_mentions_impl(p_organization_id,p_company_ids);
$body$;
revoke all on function private.netproducers1_auto1b_mentions_impl(uuid,uuid[])
  from public,anon;
revoke all on function public.netproducers1_auto1b_mentions(uuid,uuid[])
  from public,anon;
grant execute on function private.netproducers1_auto1b_mentions_impl(uuid,uuid[])
  to authenticated,service_role;
grant execute on function public.netproducers1_auto1b_mentions(uuid,uuid[])
  to authenticated,service_role;

comment on function public.netproducers1_auto1b_mentions(uuid,uuid[]) is
  'Paid producers/IT source mentions only. A mention NEVER proves a manufacturable grade-size combination.';
