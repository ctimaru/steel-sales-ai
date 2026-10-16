-- NET-COV2B: private first-party website permission ledger.
-- The normal source-registry approval alone never grants permission to crawl sites.
create table if not exists public.network_netcov2b_domain_permissions(
 source_id uuid not null references public.network_discovery_source_registry(id),
 domain text not null,
 permission_url text not null,
 expires_at timestamptz not null,
 approval_note text not null check(length(btrim(approval_note)) >= 40),
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key(source_id,domain),
 check(domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' and domain not like '%..%')
);
alter table public.network_netcov2b_domain_permissions enable row level security;
revoke all on public.network_netcov2b_domain_permissions from public,anon,authenticated;
grant select,insert,update on public.network_netcov2b_domain_permissions to service_role;
create index if not exists netcov2b_grant_expiry_idx
 on public.network_netcov2b_domain_permissions(source_id,expires_at) where revoked_at is null;

create or replace function private.netcov2b_record_permission_impl(
 p_source_id uuid,p_domain text,p_permission_url text,p_expires_at timestamptz,
 p_note text,p_attested boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare s public.network_discovery_source_registry%rowtype; d text; host text; u text;
begin
 perform private.require_platform_permission('discovery.governance_review');
 d:=lower(btrim(coalesce(p_domain,'')));u:=btrim(coalesce(p_permission_url,''));
 if auth.uid() is null or p_attested is distinct from true
 or length(btrim(coalesce(p_note,''))) not between 40 and 2000
 or p_expires_at<=now() or p_expires_at>now()+interval '366 days'
 or d !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' or d like '%..%'
 or u !~* '^https://[a-z0-9][a-z0-9.-]+(/[^[:space:]<>]*)?$'
 or length(u)>1800 or position('@' in u)>0
 or position(':' in split_part(u,'/',3))>0
 then raise exception 'Explicit, time-limited first-party permission needed' using errcode='42501';end if;
 host:=regexp_replace(lower(split_part(u,'/',3)),'^www[.]','');
 if host<>d then raise exception 'Permission reference must be on the exact company domain' using errcode='42501';end if;
 select * into s from public.network_discovery_source_registry where id=p_source_id for share;
 if not found or s.source_type<>'company_submission'
  or s.governance_status<>'approved' or s.country_code<>'IT'
  or s.terms_status not in ('allows_reuse','allows_limited_reuse')
  or s.database_rights_status not in ('licensed','low_risk')
  or s.personal_data_policy not in ('company_data_only','exclude_personal_data')
  or s.reviewed_by is null or s.reviewed_at is null
  or nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is null
  or s.rights_evidence_url='https://www.wikidata.org/wiki/Wikidata:Licensing'
 then raise exception 'Reviewed company-submission source required' using errcode='42501';end if;
 if not exists(select 1 from public.network_core_target_leads t
  where t.canonical_domain=d and t.status in ('ready_for_crawler','enqueued_for_crawler')
    and t.material_signal='explicit_steel_tube_product' and t.evidence_url<>u)
 then raise exception 'Qualified first-party target and distinct permission proof required' using errcode='42501';end if;
 insert into public.network_netcov2b_domain_permissions
  (source_id,domain,permission_url,expires_at,approval_note,approved_by)
 values(p_source_id,d,u,p_expires_at,btrim(p_note),auth.uid())
 on conflict(source_id,domain) do update set permission_url=excluded.permission_url,
  expires_at=excluded.expires_at,approval_note=excluded.approval_note,
  approved_by=excluded.approved_by,approved_at=now(),revoked_at=null;
 return jsonb_build_object('status','permission_recorded','domain',d,'crawler_executed',false,'published',0);
end $$;
create or replace function public.netcov2b_record_permission(
 p_source_id uuid,p_domain text,p_permission_url text,p_expires_at timestamptz,
 p_note text,p_attested boolean default false
) returns jsonb language sql security invoker set search_path=''
as 'select private.netcov2b_record_permission_impl(p_source_id,p_domain,p_permission_url,p_expires_at,p_note,p_attested);';
revoke all on function private.netcov2b_record_permission_impl(uuid,text,text,timestamptz,text,boolean) from public,anon,authenticated;
revoke all on function public.netcov2b_record_permission(uuid,text,text,timestamptz,text,boolean) from public,anon;
grant execute on function private.netcov2b_record_permission_impl(uuid,text,text,timestamptz,text,boolean) to authenticated;
grant execute on function public.netcov2b_record_permission(uuid,text,text,timestamptz,text,boolean) to authenticated;
