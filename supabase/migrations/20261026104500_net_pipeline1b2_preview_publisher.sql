-- NET-PIPELINE1B.2B — Preview publisher, protected by explicit feature gate.
-- Apply on STAGING first. No production publication or scheduling in this migration.
-- Precondition: public.network_company_discovery_candidates and public.network_companies.
-- Rollback: update private.net_pipeline1b2_settings set enabled=false; (requires admin);
-- then drop functions/table only after separately deciding treatment of published records.

create table if not exists private.net_pipeline1b2_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  batch_limit integer not null default 10 check (batch_limit between 1 and 50),
  updated_at timestamptz not null default now()
);
insert into private.net_pipeline1b2_settings(singleton,enabled)
values(true,false) on conflict(singleton) do nothing;
revoke all on private.net_pipeline1b2_settings from public, anon, authenticated;

create table if not exists private.net_pipeline1b2_publication_ledger (
  candidate_id uuid primary key references public.network_company_discovery_candidates(id),
  company_id uuid not null references public.network_companies(id),
  source_url text not null,
  source_domain text not null,
  classification text not null check(classification='minimal_unverified'),
  executed_by uuid,
  published_at timestamptz not null default now()
);
revoke all on private.net_pipeline1b2_publication_ledger from public, anon, authenticated;

create or replace function private.net_pipeline1b2_eligibility(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare d public.network_company_discovery_candidates%rowtype;
        existing_count integer;
        reason text;
begin
  select * into d from public.network_company_discovery_candidates where id=p_id;
  if not found then return jsonb_build_object('eligible',false,'reason','candidate_not_found'); end if;
  select count(*) into existing_count from public.network_companies c
    where c.archived_at is null
      and lower(trim(c.website_domain))=lower(trim(d.canonical_domain));
  reason:=case
    when d.review_status<>'pending_review' then 'not_pending'
    when d.governance_status<>'approved_company_data' or d.governance_reviewed_by is null then 'source_governance_not_approved'
    when d.match_company_id is not null or existing_count>0 then 'existing_identity_or_domain_collision'
    when d.personal_data_detected or cardinality(d.personal_data_fields)>0 then 'personal_data_hold'
    when cardinality(d.quality_flags)>0 then 'quality_flags_hold'
    when nullif(trim(d.legal_name),'') is null or nullif(trim(d.canonical_domain),'') is null
        or nullif(trim(d.country_code),'') is null or nullif(trim(d.source_url),'') is null then 'missing_required_fields'
    when lower(split_part(split_part(d.source_url,'/',3),':',1))
         not in (lower(d.canonical_domain),'www.'||lower(d.canonical_domain)) then 'official_domain_mismatch'
    when lower(split_part(split_part(d.website_url,'/',3),':',1))
         not in (lower(d.canonical_domain),'www.'||lower(d.canonical_domain)) then 'website_domain_mismatch'
    when d.country_code<>'IT' then 'country_not_yet_covered'
    else null end;
  return jsonb_build_object('eligible',reason is null,'reason',coalesce(reason,'eligible_minimal_preview'),
    'candidate_id',d.id,'matched_catalog_domains',existing_count);
end;$$;
revoke all on function private.net_pipeline1b2_eligibility(uuid) from public, anon, authenticated;

create or replace function public.net_pipeline1b2_preview_batch(p_limit integer default 10)
returns table(candidate_id uuid,eligible boolean,reason text)
language plpgsql stable security definer set search_path=''
as $$
declare rec record; v jsonb;
begin
  perform private.require_platform_permission('discovery.read');
  if p_limit<1 or p_limit>50 then raise exception 'invalid limit'; end if;
  for rec in select d.id from public.network_company_discovery_candidates d
    where d.review_status='pending_review' and d.governance_status='approved_company_data'
    order by d.created_at,d.id limit p_limit loop
    v:=private.net_pipeline1b2_eligibility(rec.id);
    candidate_id:=rec.id; eligible:=(v->>'eligible')::boolean; reason:=v->>'reason';
    return next;
  end loop;
end;$$;
revoke all on function public.net_pipeline1b2_preview_batch(integer) from public, anon;
grant execute on function public.net_pipeline1b2_preview_batch(integer) to authenticated;

create or replace function public.net_pipeline1b2_publish_one(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare d public.network_company_discovery_candidates%rowtype;
        eligibility jsonb; result_id uuid; v_enabled boolean;
begin
  perform private.require_platform_permission('discovery.publish');
  perform private.require_platform_permission('discovery.governance_review');
  select enabled into v_enabled from private.net_pipeline1b2_settings where singleton=true;
  if coalesce(v_enabled,false)=false then raise exception 'preview publisher disabled'; end if;
  -- Serialize publisher calls, including calls with distinct candidate IDs.
  perform pg_advisory_xact_lock(810021, 20262);
  select company_id into result_id from private.net_pipeline1b2_publication_ledger where candidate_id=p_candidate_id;
  if found then return jsonb_build_object('status','already_published','company_id',result_id); end if;
  select * into d from public.network_company_discovery_candidates where id=p_candidate_id for update;
  eligibility:=private.net_pipeline1b2_eligibility(p_candidate_id);
  if not (eligibility->>'eligible')::boolean then
    raise exception 'not eligible: %',eligibility->>'reason' using errcode='22023';
  end if;
  -- Publish a MINIMAL profile. Never copy personal details, descriptions,
  -- categories, extracted marketing copy, contacts, address, logo or capabilities.
  insert into public.network_companies(legal_name,country_code,website_url,website_domain,
      publication_status,claimed_status,verification_status)
  values (trim(d.legal_name),d.country_code,d.website_url,lower(trim(d.canonical_domain)),
      'published','unclaimed','unverified')
  returning id into result_id;
  insert into private.net_pipeline1b2_publication_ledger(
      candidate_id,company_id,source_url,source_domain,classification,executed_by)
  values(p_candidate_id,result_id,d.source_url,lower(trim(d.canonical_domain)),'minimal_unverified',auth.uid());
  update public.network_company_discovery_candidates
   set review_status='published',promoted_company_id=result_id,
       reviewed_by=auth.uid(),reviewed_at=now(),
       review_note='NET-PIPELINE1B.2B governed minimal preview publisher'
   where id=p_candidate_id;
  return jsonb_build_object('status','published','company_id',result_id,'verification_status','unverified');
end;$$;
revoke all on function public.net_pipeline1b2_publish_one(uuid) from public, anon;
grant execute on function public.net_pipeline1b2_publish_one(uuid) to authenticated;
