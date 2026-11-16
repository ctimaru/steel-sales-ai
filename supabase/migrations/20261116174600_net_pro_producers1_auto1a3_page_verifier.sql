-- NET-PRO-PRODUCERS1.AUTO1.A.3 / AUTO1.B — per-page atomic verification.
-- Never equate a page mention with proven manufacturability of a specification.
create or replace function private.netproducers1_auto1a3_verify(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v record;
declare v_valid boolean;
declare v_reason text;
declare v_context text;
declare v_host text;
declare v_confirmed int:=0;
declare v_rejected int:=0;
begin
 if p_limit not between 1 and 100 then
   raise exception 'Verification batch must be between 1 and 100' using errcode='22023';
 end if;
 for v in
  select a.id,a.company_id,a.claim_kind,a.claim_value,a.source_url,
         a.source_sha256,a.evidence_excerpt,
         pg.id as page_id,pg.last_sha256 as page_sha,
         pg.last_checked_at as page_checked,pg.status as page_status,
         pg.root_sha256 as page_root_sha,
         pg.root_source_url as page_root_url,pg.canonical_domain as page_domain,
         q.source_url as company_root_url,q.last_sha256 as company_root_sha,
         q.canonical_domain as company_domain,q.last_checked_at as root_checked,
         c.website_url,c.website_domain,c.country_code,c.publication_status,
         c.archived_at
  from private.network_producer_auto1_candidates a
  left join private.network_producer_auto1_product_pages pg
    on pg.company_id=a.company_id and pg.source_url=a.source_url
  join private.network_producer_auto1_sources q on q.company_id=a.company_id
  join public.network_companies c on c.id=a.company_id
  where a.evidence_status='pending_page_verification'
  order by a.observed_at,a.id
  for update of a skip locked
  limit p_limit
 loop
  v_valid:=true;
  v_reason:='source_page_mention_verified';
  v_context:=lower(v.evidence_excerpt);
  v_host:=lower(regexp_replace(split_part(v.source_url,'/',3),'^www[.]',''));

  if v.country_code<>'IT' or v.publication_status<>'published'
    or v.archived_at is not null or not exists (
      select 1 from public.network_company_role_assignments rca
      join public.network_company_roles r on r.id=rca.role_id
      where rca.company_id=v.company_id and r.canonical_key='producer'
        and r.status='active'
    )
  then
    v_valid:=false; v_reason:='not_current_published_producer';
  elsif v.company_domain is distinct from v.website_domain
    or v.company_root_url is distinct from v.website_url
    or v.page_id is null
    or v.page_domain is distinct from v.company_domain
    or v_host is distinct from v.company_domain
    or v.page_root_url is distinct from v.company_root_url
    or v.page_root_sha is distinct from v.company_root_sha
  then
    v_valid:=false; v_reason:='official_page_provenance_mismatch';
  elsif v.page_sha is distinct from v.source_sha256
    or v.page_status not in ('candidate_review','processed','unchanged')
    or v.page_checked is null
    or v.page_checked<now()-interval '35 days'
    or v.root_checked is null
    or v.root_checked<now()-interval '35 days'
  then
    v_valid:=false; v_reason:='stale_or_changed_product_page';
  elsif position(lower(v.claim_value) in v_context)=0
  then
    v_valid:=false; v_reason:='literal_page_quote_mismatch';
  elsif v_context !~ '(tub|tubo|tube|tubular|acciai|steel|hollow|profil|prodott|product|weld|seamless|manufactur|struttural|structural)'
  then
    v_valid:=false; v_reason:='insufficient_product_context';
  elsif v_context ~ '(non[[:space:]]+(produ|disponibil|conform)|not[[:space:]]+(produ|availab|manufactur)|without[[:space:]]+(certif|grade)|escluso|not[[:space:]]+suitable)'
  then
    v_valid:=false; v_reason:='negative_or_conflicting_context';
  elsif v.claim_kind='technical_standard' and
    v.claim_value !~* '^EN[[:space:]]+(10219|10210|10305)([-–][1-5])?$'
  then
    v_valid:=false; v_reason:='unrecognized_standard';
  elsif v.claim_kind='steel_grade' and
    v.claim_value !~* '^S(235|275|355|420|460)(JR|J0|J2|M|ML|N|NL)?H$'
  then
    v_valid:=false; v_reason:='unrecognized_grade';
  elsif v.claim_kind='manufacturing_process' and lower(v.claim_value) not in (
    'tubi saldati','tubi senza saldatura','tubi elettrosaldati',
    'welded steel tubes','seamless steel tubes'
  )
  then
    v_valid:=false; v_reason:='unrecognized_manufacturing_process';
  elsif v.claim_kind in ('dimension_range','section_shape') then
    -- Dimension ranges and shapes need explicit product-scope assertions,
    -- a future verifier. They are NEVER inferred from separate text tokens.
    v_valid:=false; v_reason:='product_scope_not_documented';
  end if;

  update private.network_producer_auto1_candidates a
    set evidence_status=case when v_valid then 'confirmed' else 'rejected' end,
        evidence_level=case when v_valid then 'source_mention_only' else 'insufficient' end,
        verification_reason=v_reason,
        verified_at=now(),
        verifier_version='netproducers-auto1a3-v1',
        updated_at=now()
    where a.id=v.id and a.evidence_status='pending_page_verification';

  insert into private.network_producer_auto1_verification_events
    (candidate_id,company_id,outcome,evidence_level,
     reason,source_sha256,verifier_version)
  values(
     v.id,v.company_id,
     case when v_valid then 'confirmed' else 'rejected' end,
     case when v_valid then 'source_mention_only' else 'insufficient' end,
     v_reason,v.source_sha256,'netproducers-auto1a3-v1'
  ) on conflict(candidate_id,verifier_version) do nothing;

  if v_valid then v_confirmed:=v_confirmed+1;
  else v_rejected:=v_rejected+1; end if;
 end loop;
 return jsonb_build_object(
    'contract','netproducers-auto1a3-verify-v1',
    'checked',v_confirmed+v_rejected,
    'source_mentions_confirmed',v_confirmed,
    'rejected_or_insufficient',v_rejected,
    'producibility_demonstrated',0,
    'manufacturing_capabilities_published',0);
end;
$body$;

-- One existing entitlement-gated reader now includes verified product-page
-- observations, but ONLY while that very page and its canonical homepage
-- retain the same hashes. No unverified candidate or excerpt leaks.
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
   'id',t.id,'company_id',t.company_id,
   'claim_kind',t.claim_kind,'claim_value',t.claim_value,
   'source_url',t.source_url,'verified_at',t.verified_at,
   'evidence_level','source_mention_only'
 ) order by t.company_id,t.claim_kind,t.claim_value),'[]'::jsonb)
 into v_items
 from (
  select a.id,a.company_id,a.claim_kind,a.claim_value,a.source_url,a.verified_at
  from private.network_producer_auto1_candidates a
  join private.network_producer_auto1_sources q on q.company_id=a.company_id
  join public.network_companies c on c.id=a.company_id
  left join private.network_producer_auto1_product_pages pg
    on pg.company_id=a.company_id and pg.source_url=a.source_url
  where a.company_id=any(p_company_ids)
    and a.evidence_status='confirmed'
    and a.evidence_level='source_mention_only'
    and q.source_url=c.website_url and q.canonical_domain=c.website_domain
    and c.country_code='IT' and c.publication_status='published'
    and c.archived_at is null
    and q.last_checked_at>=now()-interval '35 days'
    and exists (
      select 1 from public.network_company_role_assignments x
      join public.network_company_roles r on r.id=x.role_id
      where x.company_id=c.id and r.canonical_key='producer' and r.status='active'
    )
    and (
      (
       a.verifier_version='netproducers-auto1b-v1'
       and a.source_url=q.source_url
       and a.source_sha256=q.last_sha256
      )
      or
      (
       a.verifier_version='netproducers-auto1a3-v1'
       and pg.id is not null
       and a.source_url=pg.source_url
       and a.source_sha256=pg.last_sha256
       and pg.status in ('candidate_review','processed','unchanged')
       and pg.last_checked_at>=now()-interval '35 days'
       and pg.root_sha256=q.last_sha256
       and pg.root_source_url=q.source_url
       and pg.canonical_domain=q.canonical_domain
      )
    )
  order by a.company_id,a.claim_kind,a.claim_value
  limit 160
 ) t;
 return jsonb_build_object('contract','netproducers-auto1b-mentions-v1',
                           'items',v_items,'total',jsonb_array_length(v_items));
end;
$body$;

-- Public verifier wrapper: only Railway service-role may execute.
create or replace function public.netproducers1_auto1a3_verify(
 p_limit integer default 100
) returns jsonb language sql security invoker set search_path=''
as $body$
 select private.netproducers1_auto1a3_verify(p_limit);
$body$;

revoke all on function private.netproducers1_auto1a3_verify(integer)
 from public,anon,authenticated;
revoke all on function public.netproducers1_auto1a3_verify(integer)
 from public,anon,authenticated;
grant execute on function private.netproducers1_auto1a3_verify(integer)
 to service_role;
grant execute on function public.netproducers1_auto1a3_verify(integer)
 to service_role;

-- Preserve the existing paid producers/IT reader grant and its JSON contract.
revoke all on function private.netproducers1_auto1b_mentions_impl(uuid,uuid[])
 from public,anon;
grant execute on function private.netproducers1_auto1b_mentions_impl(uuid,uuid[])
 to authenticated,service_role;

comment on function public.netproducers1_auto1a3_verify(integer) is
 'Service-role-only page-mention verifier. A first-party standard/grade mention is not proven tube producibility.';
