-- NET-EIMA2B: repair malformed URL regex that aborted the first official-source geo import.
-- Non-breaking CREATE OR REPLACE retains existing grants and all source/ISTAT checks.
-- The pattern accepts company-domain HTTPS and clean path segments, rejects query, fragment and spaces.
create or replace function public.neteima2_stage_provisional_geo(
  p_target_id uuid,p_source_url text,p_city text,p_province_code text,p_excerpt text
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare t public.network_core_target_leads%rowtype;
 m public.network_it_municipalities%rowtype;
 v_host text; v_count integer;v_code text;
begin
 if current_user<>'service_role' then
   raise exception 'Service-only sourced research geography' using errcode='42501';
 end if;
 select * into t from public.network_core_target_leads where id=p_target_id
  and status in ('needs_review','ready_for_crawler','enqueued_for_crawler')
  and proposed_role='end_user';
 if not found then raise exception 'Eligible unconfirmed end-user target required' using errcode='22023';end if;
 if coalesce(p_source_url,'') !~* '^https://[a-z0-9][a-z0-9.-]+(/[a-z0-9._~/%-]*)?
    or length(p_source_url)>1800 or position('@' in p_source_url)>0
    or position(':' in split_part(p_source_url,'/',3))>0
 then raise exception 'First-party clean HTTPS source required' using errcode='22023';end if;
 v_host:=regexp_replace(lower(split_part(p_source_url,'/',3)),'^www[.]','');
 if v_host<>t.canonical_domain and right(v_host,length(t.canonical_domain)+1)<>'.'||t.canonical_domain
 then raise exception 'Source host must match target domain' using errcode='42501';end if;
 if p_province_code !~ '^[A-Za-z]{2}$'
   or length(btrim(coalesce(p_city,''))) not between 2 and 120
   or length(btrim(coalesce(p_excerpt,''))) not between 20 and 1000
   or strpos(lower(p_excerpt),lower(btrim(p_city)))=0
 then raise exception 'Source must include municipality and precise province' using errcode='22023';end if;
 select count(*),min(istat_code) into v_count,v_code
 from public.network_it_municipalities
 where is_current
   and municipality_normalized=lower(btrim(regexp_replace(p_city,'[[:space:]]+',' ','g')))
   and province_code=upper(btrim(p_province_code));
 if v_count<>1 then raise exception 'Unambiguous current ISTAT municipality required' using errcode='22023';end if;
 select * into m from public.network_it_municipalities where istat_code=v_code and is_current;
 if p_excerpt !~* ('(^|[^[:alpha:]])'||m.province_code||'([^[:alpha:]]|$)')
    and strpos(lower(p_excerpt),lower(m.province_name))=0
 then raise exception 'Source must explicitly mention province (name or abbreviation)' using errcode='22023';end if;
 if exists(select 1 from public.network_companies c where c.archived_at is null
    and regexp_replace(lower(coalesce(c.website_domain,'')),'^www[.]','')=t.canonical_domain)
 then raise exception 'Existing canonical company: reconcile, do not duplicate' using errcode='23505';end if;
 insert into public.network_neteima2_provisional_geo(
   target_id,source_url,source_excerpt,istat_code,city,province_code,region
 ) values(p_target_id,btrim(p_source_url),btrim(p_excerpt),m.istat_code,
   m.municipality_name,m.province_code,m.region_name)
 on conflict(target_id) do nothing;
 return jsonb_build_object('status','staged_or_existing','target_id',p_target_id,
   'city',m.municipality_name,'region',m.region_name,'verified',false,'published',false);
end $$;
    or length(p_source_url)>1800 or position('@' in p_source_url)>0
    or position(':' in split_part(p_source_url,'/',3))>0
 then raise exception 'First-party clean HTTPS source required' using errcode='22023';end if;
 v_host:=regexp_replace(lower(split_part(p_source_url,'/',3)),'^www[.]','');
 if v_host<>t.canonical_domain and right(v_host,length(t.canonical_domain)+1)<>'.'||t.canonical_domain
 then raise exception 'Source host must match target domain' using errcode='42501';end if;
 if p_province_code !~ '^[A-Za-z]{2}$'
   or length(btrim(coalesce(p_city,''))) not between 2 and 120
   or length(btrim(coalesce(p_excerpt,''))) not between 20 and 1000
   or strpos(lower(p_excerpt),lower(btrim(p_city)))=0
 then raise exception 'Source must include municipality and precise province' using errcode='22023';end if;
 select count(*),min(istat_code) into v_count,v_code
 from public.network_it_municipalities
 where is_current
   and municipality_normalized=lower(btrim(regexp_replace(p_city,'[[:space:]]+',' ','g')))
   and province_code=upper(btrim(p_province_code));
 if v_count<>1 then raise exception 'Unambiguous current ISTAT municipality required' using errcode='22023';end if;
 select * into m from public.network_it_municipalities where istat_code=v_code and is_current;
 if p_excerpt !~* ('(^|[^[:alpha:]])'||m.province_code||'([^[:alpha:]]|$)')
    and strpos(lower(p_excerpt),lower(m.province_name))=0
 then raise exception 'Source must explicitly mention province (name or abbreviation)' using errcode='22023';end if;
 if exists(select 1 from public.network_companies c where c.archived_at is null
    and regexp_replace(lower(coalesce(c.website_domain,'')),'^www[.]','')=t.canonical_domain)
 then raise exception 'Existing canonical company: reconcile, do not duplicate' using errcode='23505';end if;
 insert into public.network_neteima2_provisional_geo(
   target_id,source_url,source_excerpt,istat_code,city,province_code,region
 ) values(p_target_id,btrim(p_source_url),btrim(p_excerpt),m.istat_code,
   m.municipality_name,m.province_code,m.region_name)
 on conflict(target_id) do nothing;
 return jsonb_build_object('status','staged_or_existing','target_id',p_target_id,
   'city',m.municipality_name,'region',m.region_name,'verified',false,'published',false);
end $$;
