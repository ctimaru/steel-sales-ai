-- COMPACT4B hotfix: remove one unmatched regex closing parenthesis.
-- Safe idempotent CREATE OR REPLACE, preserves service-role-only EXECUTE.
-- NET-UX COMPACT4B: first-party Italian geographic observation intake.
-- Candidate-only: neither published facilities nor companies are modified.
-- Service-role invocation only; caller must provide an official-domain HTTPS source
-- explicitly naming one currently valid ISTAT city and province.
create or replace function public.netcompact4b_stage_canonical_geo(
  p_company_id uuid,
  p_source_url text,
  p_city text,
  p_province_code text,
  p_excerpt text
) returns jsonb
language plpgsql security invoker set search_path=''
as $function$
declare
  v_company public.network_companies%rowtype;
  v_municipality public.network_it_municipalities%rowtype;
  v_source_host text;
  v_count integer;
  v_code text;
  v_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'Service-only canonical geographic research' using errcode='42501';
  end if;
  select * into v_company from public.network_companies
   where id=p_company_id and country_code='IT'
     and publication_status='published' and archived_at is null
     and nullif(btrim(website_domain),'') is not null;
  if not found then raise exception 'Published Italian company with official domain required' using errcode='22023'; end if;

  if coalesce(p_source_url,'') !~* '^https://[a-z0-9][a-z0-9.-]+(/[^?#[[:space:]<>]*)?$'
      or length(p_source_url)>1800
      or position('@' in p_source_url)>0
      or position(':' in split_part(p_source_url,'/',3))>0 then
    raise exception 'Clean HTTPS source page required' using errcode='22023';
  end if;
  v_source_host:=regexp_replace(lower(split_part(p_source_url,'/',3)),'^www[.]','');
  if v_source_host <> regexp_replace(lower(v_company.website_domain),'^www[.]','')
    and right(v_source_host,length(regexp_replace(lower(v_company.website_domain),'^www[.]',''))+1)
      <> '.'||regexp_replace(lower(v_company.website_domain),'^www[.]','')
  then raise exception 'Source must belong to company website' using errcode='42501'; end if;

  if p_province_code !~ '^[A-Za-z]{2}$'
    or length(btrim(coalesce(p_city,''))) not between 2 and 120
    or length(btrim(coalesce(p_excerpt,''))) not between 20 and 1000
    or strpos(lower(p_excerpt),lower(btrim(p_city)))=0
  then raise exception 'City, province and source quotation required' using errcode='22023'; end if;

  select count(*),min(istat_code) into v_count,v_code
    from public.network_it_municipalities
    where is_current
      and municipality_normalized=lower(btrim(regexp_replace(p_city,'[[:space:]]+',' ','g')))
      and province_code=upper(btrim(p_province_code));
  if v_count<>1 then
    raise exception 'Current unambiguous ISTAT municipality+province required' using errcode='22023';
  end if;
  select * into v_municipality from public.network_it_municipalities
    where istat_code=v_code and is_current;
  if p_excerpt !~* ('(^|[^[:alpha:]])'||v_municipality.province_code||'([^[:alpha:]]|$)')
    and strpos(lower(p_excerpt),lower(v_municipality.province_name))=0
  then raise exception 'Official excerpt must also mention province' using errcode='22023'; end if;

  -- Serialize same-company writes and avoid producing competing office assertions.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text,4));
  if exists(select 1 from public.network_facilities
    where company_id=p_company_id and publication_status='published' and archived_at is null)
  then return jsonb_build_object('status','published_facility_exists','staged',false); end if;
  if exists(select 1 from public.network_it_geo_evidence_candidates
    where company_id=p_company_id)
  then return jsonb_build_object('status','existing_evidence','staged',false); end if;

  insert into public.network_it_geo_evidence_candidates(
    company_id,source_url,source_kind,source_company_domain,
    city,province_code,region,istat_code,evidence_snippet,status
  ) values (
    p_company_id,btrim(p_source_url),'company_official_site',
    regexp_replace(lower(v_company.website_domain),'^www[.]',''),
    v_municipality.municipality_name,v_municipality.province_code,
    v_municipality.region_name,v_municipality.istat_code,
    btrim(p_excerpt),'pending_review'
  ) returning id into v_id;
  return jsonb_build_object(
    'status','source_observed','staged',true,'candidate_id',v_id,
    'company_id',p_company_id,'city',v_municipality.municipality_name,
    'region',v_municipality.region_name,'verified',false,'published',false
  );
end;
$function$;
revoke all on function public.netcompact4b_stage_canonical_geo(uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.netcompact4b_stage_canonical_geo(uuid,text,text,text,text)
  to service_role;
comment on function public.netcompact4b_stage_canonical_geo(uuid,text,text,text,text)
  is 'Service-only ISTAT-validated evidence candidate, never publishes facilities or verifies companies.';
