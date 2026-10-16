-- NET-FAST3: one authorization of a commercial redistribution feed; no domain crawl grants.
create or replace function private.netfast3_grant_feed_impl(
 p_source_id uuid,p_license_url text,p_note text,p_expires_at timestamptz,p_attested boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare s public.network_discovery_source_registry%rowtype;
begin
 perform private.require_platform_permission('discovery.governance_review');
 if auth.uid() is null or p_attested is distinct from true
  or p_expires_at <= now() or p_expires_at>now()+interval '366 days'
  or length(btrim(coalesce(p_note,''))) not between 60 and 3000
  or p_license_url !~* '^https://[a-z0-9][a-z0-9.-]+(/[^[:space:]<>]*)?$'
  or position('@' in p_license_url)>0 or length(p_license_url)>1800
 then raise exception 'Time-limited explicit redistribution rights attestation required' using errcode='42501';end if;
 select * into s from public.network_discovery_source_registry where id=p_source_id for share;
 if not found or s.country_code<>'IT'
  or s.source_type not in ('licensed_search','curated_public_source')
  or s.source_url='https://query.wikidata.org/sparql'
  or s.governance_status<>'approved'
  or s.terms_status not in ('allows_reuse','allows_limited_reuse')
  or s.database_rights_status not in ('licensed','low_risk')
  or s.personal_data_policy not in ('company_data_only','exclude_personal_data')
  or s.reviewed_at is null or s.reviewed_by is null
  or nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is null
  or nullif(btrim(coalesce(s.review_note,'')),'') is null
 then raise exception 'Separately reviewed structured-data source required' using errcode='42501';end if;
 insert into public.network_netfast3_feed_grants(source_id,license_url,permission_note,approved_by,expires_at)
 values(p_source_id,p_license_url,btrim(p_note),auth.uid(),p_expires_at)
 on conflict(source_id) do update
  set license_url=excluded.license_url,permission_note=excluded.permission_note,
   approved_by=excluded.approved_by,approved_at=now(),expires_at=excluded.expires_at,
   revoked_at=null,revoked_reason=null;
 return jsonb_build_object('status','feed_approved_for_structured_import_only',
  'source_id',p_source_id,'site_crawling_enabled',false,'canonical_published',0);
end $$;
create or replace function public.netfast3_grant_feed(
 p_source_id uuid,p_license_url text,p_note text,p_expires_at timestamptz,
 p_attested boolean default false)
returns jsonb language sql security invoker set search_path=''
as 'select private.netfast3_grant_feed_impl(p_source_id,p_license_url,p_note,p_expires_at,p_attested);';

create or replace function private.netfast3_revoke_feed_impl(
 p_source_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v integer;
begin
 perform private.require_platform_permission('discovery.governance_review');
 if auth.uid() is null or length(btrim(coalesce(p_reason,''))) not between 15 and 1000
 then raise exception 'Revocation reason required' using errcode='42501';end if;
 update public.network_netfast3_feed_grants
 set revoked_at=now(),revoked_reason=btrim(p_reason)
 where source_id=p_source_id and revoked_at is null;
 get diagnostics v=row_count;
 if v<>1 then raise exception 'Active license grant not found' using errcode='22023';end if;
 return jsonb_build_object('status','feed_revoked','visible_feed_records',0);
end $$;
create or replace function public.netfast3_revoke_feed(p_source_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=''
as 'select private.netfast3_revoke_feed_impl(p_source_id,p_reason);';

create or replace function private.netfast3_suppress_domain_impl(p_domain text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare d text:=lower(btrim(coalesce(p_domain,'')));
begin
 perform private.require_platform_permission('discovery.governance_review');
 if auth.uid() is null or d !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
  or length(btrim(coalesce(p_reason,''))) not between 15 and 1000
 then raise exception 'Valid domain and suppression reason required' using errcode='42501';end if;
 insert into public.network_netfast3_suppressed_domains(domain,reason,suppressed_by)
 values(d,btrim(p_reason),auth.uid())
 on conflict(domain) do update set reason=excluded.reason,
  suppressed_by=excluded.suppressed_by,suppressed_at=now();
 update public.network_netfast3_entities set removed_at=now(),removal_reason=p_reason
 where domain=d and removed_at is null;
 return jsonb_build_object('status','suppressed','domain',d);
end $$;
create or replace function public.netfast3_suppress_domain(p_domain text,p_reason text)
returns jsonb language sql security invoker set search_path=''
as 'select private.netfast3_suppress_domain_impl(p_domain,p_reason);';

revoke all on function private.netfast3_grant_feed_impl(uuid,text,text,timestamptz,boolean) from public,anon,authenticated;
revoke all on function private.netfast3_revoke_feed_impl(uuid,text) from public,anon,authenticated;
revoke all on function private.netfast3_suppress_domain_impl(text,text) from public,anon,authenticated;
revoke all on function public.netfast3_grant_feed(uuid,text,text,timestamptz,boolean) from public,anon;
revoke all on function public.netfast3_revoke_feed(uuid,text) from public,anon;
revoke all on function public.netfast3_suppress_domain(text,text) from public,anon;
grant execute on function private.netfast3_grant_feed_impl(uuid,text,text,timestamptz,boolean) to authenticated;
grant execute on function private.netfast3_revoke_feed_impl(uuid,text) to authenticated;
grant execute on function private.netfast3_suppress_domain_impl(text,text) to authenticated;
grant execute on function public.netfast3_grant_feed(uuid,text,text,timestamptz,boolean) to authenticated;
grant execute on function public.netfast3_revoke_feed(uuid,text) to authenticated;
grant execute on function public.netfast3_suppress_domain(text,text) to authenticated;
