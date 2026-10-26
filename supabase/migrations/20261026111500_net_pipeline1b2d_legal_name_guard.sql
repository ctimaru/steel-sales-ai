-- Hold malformed names such as usasrl. and metalplastsrl.; publisher remains disabled.
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
    when lower(trim(d.legal_name)) ~ '^[[:alnum:]]+(srl|spa)[.]$' then 'malformed_extracted_legal_name'
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
