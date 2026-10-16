-- NET-UX3A.1: require the province sigla as a separate explicit token, not a
-- substring of a city name (MI within Milano). Existing grants/ACL are unchanged.
create or replace function private.netux3a_stage_facility_match_impl(
 p_facility_id uuid,p_province_code text,p_source_url text,p_evidence_snippet text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  f public.network_facilities%rowtype;
  c public.network_companies%rowtype;
  m public.network_it_municipalities%rowtype;
  v_host text; v_domain text; v_count integer; v_review uuid; v_code text;
begin
  perform private.require_platform_permission('discovery.enrich');
  select * into f from public.network_facilities
   where id=p_facility_id and publication_status='published' and archived_at is null
     and country_code='IT' and nullif(btrim(city),'') is not null;
  if not found then raise exception 'Published Italian facility with city required' using errcode='22023'; end if;
  select * into c from public.network_companies where id=f.company_id
   and publication_status='published' and archived_at is null and country_code='IT';
  if not found then raise exception 'Published company required' using errcode='22023'; end if;
  if p_province_code !~ '^[A-Za-z]{2}$'
    or p_source_url !~* '^https://[a-z0-9][a-z0-9.-]+(/[^[:space:]]*)?$'
    or length(p_source_url)>1800
    or length(btrim(coalesce(p_evidence_snippet,''))) not between 20 and 1500
    or strpos(lower(p_evidence_snippet),lower(btrim(f.city)))=0
    or p_evidence_snippet !~* ('(^|[^[:alpha:]])' || upper(btrim(p_province_code)) || '([^[:alpha:]]|$)')
  then raise exception 'Official company site must document city and province code' using errcode='22023'; end if;
  v_host:=regexp_replace(lower(split_part(split_part(p_source_url,'/',3),':',1)),'^www\.','');
  v_domain:=regexp_replace(lower(coalesce(c.website_domain,'')),'^www\.','');
  if length(v_domain)<4 or position('.' in v_domain)=0
     or (v_host<>v_domain and right(v_host,length(v_domain)+1)<>'.'||v_domain)
  then raise exception 'Evidence URL does not match company official domain' using errcode='42501'; end if;
  select count(*),min(istat_code) into v_count,v_code
  from public.network_it_municipalities
  where is_current
    and municipality_normalized=lower(btrim(regexp_replace(f.city,'[[:space:]]+',' ','g')))
    and province_code=upper(p_province_code);
  if v_count<>1 then raise exception 'No unambiguous active ISTAT city+province match' using errcode='22023'; end if;
  select * into m from public.network_it_municipalities where istat_code=v_code and is_current;
  if lower(btrim(coalesce(f.region,'')))<>lower(btrim(m.region_name)) then
    raise exception 'Published facility region conflicts with ISTAT; manual correction required'
      using errcode='22023';
  end if;
  if exists(select 1 from public.network_it_facility_geo_reviews
      where facility_id=p_facility_id and status='approved') then
     raise exception 'Facility already has an approved municipality' using errcode='23505';
  end if;
  insert into public.network_it_facility_geo_reviews(
    facility_id,proposed_istat_code,source_url,matching_basis,
    status,evidence_snippet
  ) values(
    p_facility_id,m.istat_code,btrim(p_source_url),'municipality_and_province',
    'pending_review',btrim(p_evidence_snippet)
  ) on conflict(facility_id,proposed_istat_code) do update
     set source_url=excluded.source_url,evidence_snippet=excluded.evidence_snippet,
         created_at=now()
     where public.network_it_facility_geo_reviews.status='pending_review'
  returning id into v_review;
  if v_review is null then
    raise exception 'A previously decided match cannot be restaged' using errcode='22023';
  end if;
  return jsonb_build_object('status','pending_review','review_id',v_review,
                            'istat_code',m.istat_code,'municipality',m.municipality_name,
                            'province_code',m.province_code,'facility_changed',false);
end $$;


comment on function private.netux3a_stage_facility_match_impl(uuid,text,text,text) is
 'NET-UX3A matching: region verified with active ISTAT, company official evidence states city and standalone 2-letter province code; only pending review, no publication.';
