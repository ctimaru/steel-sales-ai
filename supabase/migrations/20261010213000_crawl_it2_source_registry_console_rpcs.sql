-- CRAWL-IT2.1: scoped, auditable source registry review functions.
create or replace function public.crawl_it2_list_sources()
returns setof public.network_discovery_source_registry
language plpgsql stable security definer set search_path=''
as $$
begin
  perform private.require_platform_permission('discovery.read');
  return query select * from public.network_discovery_source_registry order by created_at desc limit 200;
end; $$;

create or replace function public.crawl_it2_register_source(
  p_name text,p_url text,p_type text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  perform private.require_platform_permission('discovery.governance_review');
  if p_url !~* '^https://[a-z0-9.-]+(/[^[:space:]]*)?$'
    or p_url ~* '(localhost|127[.]0[.]0[.]1|169[.]254[.]|@)'
    or p_name is null or length(btrim(p_name)) < 2
  then raise exception 'invalid approved-source registration input' using errcode='22023'; end if;
  insert into public.network_discovery_source_registry(source_name,source_url,source_type)
  values (btrim(p_name),btrim(p_url),p_type)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.crawl_it2_review_source(
  p_id uuid,p_decision text,p_terms text,p_rights text,
  p_personal_data text,p_evidence_url text,p_note text,p_enable boolean default false
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  perform private.require_platform_permission('discovery.governance_review');
  if p_decision not in ('approved','restricted','blocked')
    or p_terms not in ('allows_reuse','allows_limited_reuse','restricts_reuse','unknown')
    or p_rights not in ('low_risk','licensed','restricted','unknown')
    or p_personal_data not in ('company_data_only','exclude_personal_data','legal_review_required')
    or nullif(btrim(coalesce(p_note,'')),'') is null
    or length(p_note) > 4000
  then raise exception 'invalid source review' using errcode='22023'; end if;
  update public.network_discovery_source_registry
  set governance_status=p_decision,terms_status=p_terms,
    database_rights_status=p_rights,personal_data_policy=p_personal_data,
    rights_evidence_url=nullif(btrim(p_evidence_url),''),
    review_note=btrim(p_note), reviewed_by=auth.uid(),reviewed_at=now(),
    enabled_for_discovery=p_enable,updated_at=now()
  where id=p_id;
  if not found then raise exception 'source not found' using errcode='P0002'; end if;
end; $$;
revoke all on function public.crawl_it2_list_sources() from public,anon;
revoke all on function public.crawl_it2_register_source(text,text,text) from public,anon;
revoke all on function public.crawl_it2_review_source(uuid,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.crawl_it2_list_sources() to authenticated,service_role;
grant execute on function public.crawl_it2_register_source(text,text,text) to authenticated,service_role;
grant execute on function public.crawl_it2_review_source(uuid,text,text,text,text,text,text,boolean) to authenticated,service_role;
