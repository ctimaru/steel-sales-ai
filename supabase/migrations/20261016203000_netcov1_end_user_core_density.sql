-- NET-COV1: commercial liquidity starts with published-company scarcity:
-- source-screened official-site end-user leads, NEVER an automatic Network publication.
create table if not exists public.network_core_target_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check(length(btrim(company_name)) between 3 and 180),
  canonical_domain text not null unique
    check(canonical_domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' and canonical_domain not like '%..%'),
  evidence_url text not null,
  evidence_summary text not null check(length(btrim(evidence_summary)) between 25 and 1000),
  segment text not null check(segment in
    ('furniture','urban_furniture','scaffolding','industrial_equipment','agricultural_equipment','other')),
  proposed_role text not null default 'end_user'
    check(proposed_role in ('end_user','trader_distributor')),
  material_signal text not null
    check(material_signal in ('explicit_steel_tube_product','finished_equipment_only')),
  status text not null default 'needs_review'
    check(status in ('needs_review','ready_for_crawler','duplicate_existing','rejected','enqueued_for_crawler')),
  intake_batch text not null default 'manual',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  discovery_lead_id uuid references public.network_discovery_domain_leads(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(discovery_lead_id is null or status='enqueued_for_crawler')
);
create index if not exists network_core_target_leads_role_status_idx
  on public.network_core_target_leads(proposed_role,status,segment);
alter table public.network_core_target_leads enable row level security;
revoke all on public.network_core_target_leads from public,anon,authenticated;
-- Only privileged private functions may read/write. No direct client table grants.
create policy netcov1_explicit_deny_client_access
 on public.network_core_target_leads as restrictive for all to anon,authenticated
 using(false) with check(false);

create or replace function private.netcov1_stage_core(
 p_name text,p_domain text,p_evidence_url text,p_evidence_summary text,
 p_segment text,p_material_signal text,p_batch text default 'manual',
 p_role text default 'end_user'
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_domain text;v_host text;v_id uuid;v_existing text;
begin
 v_domain:=lower(btrim(coalesce(p_domain,'')));
 if v_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
    or v_domain like '%..%' or length(v_domain)>255
    or coalesce(p_evidence_url,'') !~* '^https://[a-z0-9][a-z0-9.-]+(/[^[:space:]<>]*)?$'
    or length(p_evidence_url)>1800 or position('@' in p_evidence_url)>0
    or position(':' in split_part(p_evidence_url,'/',3))>0
 then raise exception 'Unsafe company domain or first-party HTTPS evidence URL' using errcode='22023';end if;
 v_host:=regexp_replace(lower(split_part(p_evidence_url,'/',3)),'^www\.','');
 if v_host<>v_domain then
   raise exception 'Evidence must come from exact company website domain' using errcode='42501';
 end if;
 if length(btrim(coalesce(p_name,''))) not between 3 and 180
    or length(btrim(coalesce(p_evidence_summary,''))) not between 25 and 1000
    or p_name ~ '[[:cntrl:]<>@]' or p_evidence_summary ~ '[[:cntrl:]<>@]'
    or p_segment not in ('furniture','urban_furniture','scaffolding','industrial_equipment','agricultural_equipment','other')
    or p_material_signal not in ('explicit_steel_tube_product','finished_equipment_only')
    or p_role not in ('end_user','trader_distributor')
    or length(btrim(coalesce(p_batch,''))) not between 3 and 90
 then raise exception 'Missing/invalid business evidence or unsupported data' using errcode='22023';end if;

 select status into v_existing from public.network_core_target_leads where canonical_domain=v_domain;
 if found then return jsonb_build_object('status','already_staged','domain',v_domain,'published',0);end if;
 if exists(select 1 from public.network_companies c where c.archived_at is null
    and regexp_replace(lower(coalesce(c.website_domain,'')),'^www\.','')=v_domain)
    or exists(select 1 from public.network_company_discovery_candidates c
    where regexp_replace(lower(coalesce(c.canonical_domain,'')),'^www\.','')=v_domain)
 then v_existing:='duplicate_existing';
 else v_existing:='needs_review';end if;
 insert into public.network_core_target_leads(
  company_name,canonical_domain,evidence_url,evidence_summary,segment,
  proposed_role,material_signal,intake_batch,status
 ) values (
  btrim(p_name),v_domain,btrim(p_evidence_url),btrim(p_evidence_summary),
  p_segment,p_role,p_material_signal,btrim(p_batch),v_existing
 ) on conflict(canonical_domain) do nothing returning id into v_id;
 return jsonb_build_object('status',case when v_id is null then 'already_staged' else v_existing end,
    'target_id',v_id,'domain',v_domain,'published',0);
end;
$$;

create or replace function private.netcov1_targets_queue_impl()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_data jsonb;
begin
 perform private.require_platform_permission('discovery.read');
 select jsonb_build_object(
  'contract','netcov1-targets-v1',
  'total',(select count(*) from public.network_core_target_leads),
  'needs_review',(select count(*) from public.network_core_target_leads where status='needs_review'),
  'ready_for_crawler',(select count(*) from public.network_core_target_leads where status='ready_for_crawler'),
  'enqueued',(select count(*) from public.network_core_target_leads where status='enqueued_for_crawler'),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',t.id,'company_name',t.company_name,'canonical_domain',t.canonical_domain,
    'evidence_url',t.evidence_url,'evidence_summary',t.evidence_summary,
    'segment',t.segment,'proposed_role',t.proposed_role,
    'material_signal',t.material_signal,'status',t.status,'review_note',t.review_note
  ) order by case t.status when 'needs_review' then 0 when 'ready_for_crawler' then 1
    when 'enqueued_for_crawler' then 2 else 3 end,t.company_name,t.id)
    from (select * from public.network_core_target_leads
     order by case status when 'needs_review' then 0 when 'ready_for_crawler' then 1 else 2 end,
      created_at,id limit 100)t),'[]'::jsonb),
  'published_end_users',(select count(distinct c.id) from public.network_companies c
    join public.network_company_role_assignments a on a.company_id=c.id
    join public.network_company_roles r on r.id=a.role_id and r.canonical_key='end_user'
    where c.country_code='IT' and c.publication_status='published' and c.archived_at is null)
 ) into v_data;
 return v_data;
end;
$$;
create or replace function public.netcov1_targets_queue()
returns jsonb language sql stable security invoker set search_path=''
as 'select private.netcov1_targets_queue_impl();';

create or replace function private.netcov1_operator_stage_impl(
 p_name text,p_domain text,p_evidence_url text,p_evidence_summary text,
 p_segment text,p_material_signal text,p_role text
) returns jsonb language plpgsql security definer set search_path=''
as $$
begin
 perform private.require_platform_permission('discovery.enrich');
 return private.netcov1_stage_core(p_name,p_domain,p_evidence_url,p_evidence_summary,
    p_segment,p_material_signal,'platform-manual',p_role);
end;
$$;
create or replace function public.netcov1_operator_stage(
 p_name text,p_domain text,p_evidence_url text,p_evidence_summary text,
 p_segment text,p_material_signal text,p_role text
) returns jsonb language sql security invoker set search_path=''
as 'select private.netcov1_operator_stage_impl(p_name,p_domain,p_evidence_url,p_evidence_summary,p_segment,p_material_signal,p_role);';

create or replace function public.netcov1_seed_official_cohort(p_items jsonb,p_batch text)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_item jsonb;v_summary jsonb:='[]'::jsonb;v_count integer;
begin
 if current_user<>'service_role' then raise exception 'service_role only cohort staging' using errcode='42501';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 40 then
  raise exception 'Batch must contain 1-40 first-party business references' using errcode='22023';end if;
 if length(btrim(coalesce(p_batch,''))) not between 3 and 90 then raise exception 'Invalid batch' using errcode='22023';end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_item)<>'object' or (select count(*) from jsonb_object_keys(v_item))<>7
      or not (v_item ?& array['name','domain','evidence_url','summary','segment','material_signal','role'])
   then raise exception 'Unexpected company fields' using errcode='22023';end if;
   v_summary:=v_summary||jsonb_build_array(private.netcov1_stage_core(
      v_item->>'name',v_item->>'domain',v_item->>'evidence_url',
      v_item->>'summary',v_item->>'segment',v_item->>'material_signal',p_batch,v_item->>'role'
   ));
 end loop;
 return jsonb_build_object('status','staged_for_platform_review','items',v_summary,
   'requested',jsonb_array_length(p_items),'published',0);
end;
$$;

create or replace function private.netcov1_review_targets_impl(
 p_target_ids uuid[],p_decision text,p_note text,p_attested boolean
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid;v_count integer;v_rows integer;t record;
begin
 perform private.require_platform_permission('discovery.governance_review');
 v_actor:=auth.uid();
 if v_actor is null or coalesce(p_attested,false) is not true
   or cardinality(p_target_ids) not between 1 and 40
   or length(btrim(coalesce(p_note,''))) not between 15 and 2000
   or p_decision not in ('ready_for_crawler','rejected','duplicate_existing')
 then raise exception 'Authenticated attested Platform cohort decision required' using errcode='42501';end if;
 if (select count(distinct x) from unnest(p_target_ids)x)<>cardinality(p_target_ids)
 then raise exception 'Duplicate target IDs' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtext('netcov1-reviewed-targets'));
 select count(*) into v_count from public.network_core_target_leads
  where id=any(p_target_ids) and status='needs_review';
 if v_count<>cardinality(p_target_ids) then raise exception 'Some targets already reviewed or missing' using errcode='22023';end if;
 if p_decision='ready_for_crawler' then
   for t in select * from public.network_core_target_leads where id=any(p_target_ids) loop
     if t.material_signal<>'explicit_steel_tube_product'
       or exists(select 1 from public.network_companies c where c.archived_at is null
             and lower(c.website_domain)=t.canonical_domain)
       or exists(select 1 from public.network_company_discovery_candidates c
             where lower(c.canonical_domain)=t.canonical_domain)
     then raise exception 'Target needs direct materials evidence or is duplicate: %',t.canonical_domain using errcode='22023';end if;
   end loop;
 end if;
 update public.network_core_target_leads set
  status=p_decision,reviewed_by=v_actor,reviewed_at=now(),review_note=btrim(p_note),updated_at=now()
 where id=any(p_target_ids) and status='needs_review';
 get diagnostics v_rows=row_count;
 return jsonb_build_object('status',p_decision,'reviewed',v_rows,'published',0,'crawler_executed',false);
end;
$$;
create or replace function public.netcov1_review_targets(
 p_target_ids uuid[],p_decision text,p_note text,p_attested boolean default false
) returns jsonb language sql security invoker set search_path=''
as 'select private.netcov1_review_targets_impl(p_target_ids,p_decision,p_note,p_attested);';

-- Bridge to existing governed domain lead path, only after an approved source
-- already exists. No automatic source approval, run linkage, review or publication.
create or replace function private.netcov1_enqueue_reviewed_impl(
 p_source_id uuid,p_limit integer
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare s public.network_discovery_source_registry%rowtype;t record;v_new integer:=0;
 v_duplicate integer:=0;v_id uuid;
begin
 perform private.require_platform_permission('discovery.run');
 perform private.require_platform_permission('discovery.governance_review');
 if p_limit not between 1 and 40 then raise exception 'Limit 1-40 required' using errcode='22023';end if;
 select * into s from public.network_discovery_source_registry where id=p_source_id for share;
 if not found or s.country_code<>'IT' or not s.enabled_for_discovery
 or s.governance_status<>'approved' or s.terms_status not in ('allows_reuse','allows_limited_reuse')
 or s.database_rights_status not in ('low_risk','licensed')
 or s.personal_data_policy not in ('exclude_personal_data','company_data_only')
 or s.reviewed_by is null or s.reviewed_at is null
 or nullif(btrim(coalesce(s.rights_evidence_url,'')),'') is null
 or nullif(btrim(coalesce(s.review_note,'')),'') is null
 or s.source_url='https://query.wikidata.org/sparql'
 then raise exception 'Approved, properly licensed official-site curation source required' using errcode='42501';end if;
 for t in select * from public.network_core_target_leads
   where status='ready_for_crawler' order by reviewed_at,id limit p_limit for update
 loop
   if exists(select 1 from public.network_discovery_domain_leads l where l.domain=t.canonical_domain)
      or exists(select 1 from public.network_companies c where c.archived_at is null and lower(c.website_domain)=t.canonical_domain)
      or exists(select 1 from public.network_company_discovery_candidates c where lower(c.canonical_domain)=t.canonical_domain)
   then v_duplicate:=v_duplicate+1;continue;end if;
   insert into public.network_discovery_domain_leads(source_id,country_code,domain,proposed_url,evidence_url,status)
   values(s.id,'IT',t.canonical_domain,'https://'||t.canonical_domain||'/',t.evidence_url,'pending_review')
   on conflict(source_id,domain) do nothing returning id into v_id;
   if v_id is not null then
     update public.network_core_target_leads set
      status='enqueued_for_crawler',discovery_lead_id=v_id,updated_at=now()
      where id=t.id;
     v_new:=v_new+1;
   else v_duplicate:=v_duplicate+1;end if;
   v_id:=null;
 end loop;
 return jsonb_build_object('status','enqueued_pending_lead_review',
     'inserted',v_new,'skipped_duplicates',v_duplicate,
     'approved_company_count',0,'published',0);
end;
$$;
create or replace function public.netcov1_enqueue_reviewed(p_source_id uuid,p_limit integer default 40)
returns jsonb language sql security invoker set search_path=''
as 'select private.netcov1_enqueue_reviewed_impl(p_source_id,p_limit);';

-- RPC grants: only auth-approved Platform staff or dedicated service on seed.
revoke all on public.network_core_target_leads from public,anon,authenticated;
revoke all on function private.netcov1_stage_core(text,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function private.netcov1_targets_queue_impl() from public,anon,authenticated;
revoke all on function private.netcov1_operator_stage_impl(text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function private.netcov1_review_targets_impl(uuid[],text,text,boolean) from public,anon,authenticated;
revoke all on function private.netcov1_enqueue_reviewed_impl(uuid,integer) from public,anon,authenticated;
revoke all on function public.netcov1_targets_queue() from public,anon;
revoke all on function public.netcov1_operator_stage(text,text,text,text,text,text,text) from public,anon;
revoke all on function public.netcov1_seed_official_cohort(jsonb,text) from public,anon,authenticated;
revoke all on function public.netcov1_review_targets(uuid[],text,text,boolean) from public,anon;
revoke all on function public.netcov1_enqueue_reviewed(uuid,integer) from public,anon;
grant execute on function private.netcov1_stage_core(text,text,text,text,text,text,text,text) to authenticated,service_role;
grant execute on function private.netcov1_targets_queue_impl() to authenticated;
grant execute on function private.netcov1_operator_stage_impl(text,text,text,text,text,text,text) to authenticated;
grant execute on function private.netcov1_review_targets_impl(uuid[],text,text,boolean) to authenticated;
grant execute on function private.netcov1_enqueue_reviewed_impl(uuid,integer) to authenticated;
grant execute on function public.netcov1_targets_queue() to authenticated;
grant execute on function public.netcov1_operator_stage(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.netcov1_seed_official_cohort(jsonb,text) to service_role;
grant execute on function public.netcov1_review_targets(uuid[],text,text,boolean) to authenticated;
grant execute on function public.netcov1_enqueue_reviewed(uuid,integer) to authenticated;
