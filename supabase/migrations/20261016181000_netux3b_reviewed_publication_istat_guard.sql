-- NET-UX3B: second human publication gate revalidates current ISTAT for staged 2026 evidence.
create or replace function private.netux3_publish_reviewed_geo_impl(
  p_evidence_id uuid,p_publication_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v public.network_it_geo_evidence_candidates%rowtype;
  c public.network_companies%rowtype;
  v_facility_id uuid;
  v_host text;
  v_domain text;
begin
  perform private.require_platform_permission('discovery.publish');
  perform private.require_platform_permission('discovery.governance_review');
  if length(btrim(coalesce(p_publication_note,''))) not between 12 and 2000 then
    raise exception 'A separate explicit publication note is required' using errcode='22023';
  end if;
  select * into v from public.network_it_geo_evidence_candidates
  where id=p_evidence_id for update;
  if not found or v.status<>'approved_for_facility_review'
    or v.reviewed_by is null or v.reviewed_at is null then
    raise exception 'Reviewed and approved geographic evidence required' using errcode='42501';
  end if;
  select facility_id into v_facility_id from public.network_it_geo_publication_ledger
  where evidence_id=v.id;
  if found then return jsonb_build_object('status','already_published','facility_id',v_facility_id); end if;
  select * into c from public.network_companies
  where id=v.company_id and publication_status='published'
    and archived_at is null and country_code='IT';
  if not found then raise exception 'Target company no longer published' using errcode='42501'; end if;
  if v.source_kind <> 'company_official_site' or v.region is null or v.city is null
     or length(btrim(v.city))<2 or
     strpos(lower(v.evidence_snippet),lower(btrim(v.city)))=0
     or not exists (
       select 1 from unnest(array[
         'Abruzzo','Basilicata','Calabria','Campania','Emilia-Romagna',
         'Friuli-Venezia Giulia','Lazio','Liguria','Lombardia','Marche',
         'Molise','Piemonte','Puglia','Sardegna','Sicilia','Toscana',
         'Trentino-Alto Adige','Umbria','Valle d''Aosta','Veneto'
       ]) region where lower(region)=lower(btrim(v.region))
     ) then
    raise exception 'Official website, observed city and canonical region required' using errcode='42501';
  end if;
  v_host:=regexp_replace(lower(split_part(split_part(v.source_url,'/',3),':',1)),'^www\.','');
  v_domain:=regexp_replace(lower(coalesce(c.website_domain,'')),'^www\.','');
  if length(v_domain)<4 or
     (v_host<>v_domain and right(v_host,length(v_domain)+1)<>'.'||v_domain) then
    raise exception 'Company website identity mismatch' using errcode='42501';
  end if;
  perform private.netux3b_check_istat_before_publish(p_evidence_id);
  -- Recheck for duplicate publication: an approved candidate is not an override
  -- of a facility modified by the owning company since evidence review.
  select f.id into v_facility_id from public.network_facilities f
  where f.company_id=v.company_id and f.publication_status='published' and f.archived_at is null
    and lower(btrim(f.city))=lower(btrim(v.city))
    and lower(btrim(f.region))=lower(btrim(v.region))
  order by f.created_at limit 1;
  if v_facility_id is null then
    insert into public.network_facilities(
      company_id,name,facility_type,city,region,country_code,
      publication_status,verification_status
    ) values(
      v.company_id,'Sede — '||v.city,'site',v.city,v.region,'IT',
      'published','unverified'
    ) returning id into v_facility_id;
    insert into public.network_data_assertions(
      entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
      ownership_type,asserted_by,review_state
    ) values (
      'facility',v_facility_id,'location',
      jsonb_build_object('city',v.city,'region',v.region,'evidence_id',v.id),
      'public_web',v.source_url,'platform_curated',auth.uid(),'accepted'
    );
  end if;
  insert into public.network_it_geo_publication_ledger(
    evidence_id,company_id,facility_id,published_by,publication_note
  ) values (v.id,v.company_id,v_facility_id,auth.uid(),btrim(p_publication_note));
  return jsonb_build_object('status','published','facility_id',v_facility_id,'evidence_id',v.id);
end;
$$;


