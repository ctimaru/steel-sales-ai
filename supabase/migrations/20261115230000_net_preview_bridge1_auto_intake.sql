-- NET-PREVIEW-BRIDGE1: stage existing visible IT research leads in batches of 100.
-- This is NOT publication. AUTO2 independently verifies first-party corporate identity;
-- AUTO3 may publish only minimal factual fields under an active, expiring owner policy.
-- Never copy source page text, personal contacts or unverified role/product claims to public companies.

create table if not exists private.net_preview_bridge1_ledger (
  lead_id uuid primary key references public.network_core_target_leads(id),
  candidate_id uuid not null unique references public.network_company_discovery_candidates(id),
  run_id uuid not null references public.network_company_discovery_runs(id),
  staged_at timestamptz not null default now()
);
alter table private.net_preview_bridge1_ledger enable row level security;
revoke all on table private.net_preview_bridge1_ledger from public,anon,authenticated,service_role;

create or replace function private.net_preview_bridge1_stage(
  p_max integer default 100,
  p_dry_run boolean default true
) returns jsonb
language plpgsql security definer set search_path to ''
as $stage$
declare
  v_owner uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_names text[] := '{}'::text[];
  v_seed_urls jsonb := '[]'::jsonb;
  v_row record;
  v_normalized text;
  v_count integer := 0;
  v_inserted integer := 0;
  v_run uuid;
begin
  if session_user <> 'postgres' or auth.uid() is not null then
    raise exception 'Maintenance-only agent; no browser or service JWT'
      using errcode='42501';
  end if;
  if p_max is null or p_max not between 1 and 100 or p_dry_run is null then
    raise exception 'Bounded 1..100 intake required' using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(810021,20262);
  select authorized_by into v_owner
  from private.net_it_auto3_policy
  where singleton=true and enabled and expires_at > now();
  if v_owner is null then
    return jsonb_build_object('contract','net-preview-bridge1-v1',
      'status','owner_policy_inactive','staged',0);
  end if;

  for v_row in
    select t.id,t.company_name,t.canonical_domain,t.evidence_url
    from public.network_core_target_leads t
    where t.status in ('needs_review','ready_for_crawler','enqueued_for_crawler')
      and t.evidence_url ~* '^https://'
      and lower(regexp_replace(split_part(split_part(t.evidence_url,'://',2),'/',1),'^www[.]',''))
          = lower(t.canonical_domain)
      and t.proposed_role in ('producer','trader_distributor','processor_service_provider','end_user')
      and not exists (select 1 from private.net_preview_bridge1_ledger l where l.lead_id=t.id)
      and not exists (
        select 1 from public.network_company_discovery_candidates c
        where lower(btrim(c.canonical_domain))=lower(btrim(t.canonical_domain))
           or lower(regexp_replace(btrim(c.legal_name),'[^[:alnum:]]','','g'))
              =lower(regexp_replace(btrim(t.company_name),'[^[:alnum:]]','','g'))
      )
      and not exists (
        select 1 from public.network_companies c
        where lower(btrim(c.website_domain))=lower(btrim(t.canonical_domain))
           or (c.country_code='IT' and
              lower(regexp_replace(btrim(c.legal_name),'[^[:alnum:]]','','g'))
              =lower(regexp_replace(btrim(t.company_name),'[^[:alnum:]]','','g')))
      )
      and not exists (
        select 1 from public.network_netfast3_suppressed_domains s
        where lower(s.domain)=lower(t.canonical_domain)
      )
    order by t.created_at,t.id limit p_max
    for update of t skip locked
  loop
    v_normalized:=lower(regexp_replace(btrim(v_row.company_name),'[^[:alnum:]]','','g'));
    if length(v_normalized)<3 or v_normalized=any(v_names) then continue; end if;
    v_ids:=array_append(v_ids,v_row.id);
    v_names:=array_append(v_names,v_normalized);
    v_seed_urls:=v_seed_urls||jsonb_build_array(v_row.evidence_url);
    v_count:=v_count+1;
  end loop;

  if p_dry_run or v_count=0 then
    return jsonb_build_object('contract','net-preview-bridge1-v1',
      'status',case when p_dry_run then 'dry_run' else 'empty' end,
      'eligible',v_count,'staged',0,'batch_max',p_max);
  end if;

  insert into public.network_company_discovery_runs(
    requested_by,country_code,seed_urls,status,candidate_count,
    started_at,completed_at,source_type,source_reference,label,
    extraction_version,stats,governance_status,terms_status,
    database_rights_status,personal_data_policy
  ) values (
    v_owner,'IT',v_seed_urls,'completed',v_count,now(),now(),'other',
    'net-preview-bridge1:existing_visible_research',
    'Automatic staged intake of already visible Network provisional companies',
    'net-preview-bridge1-v1',
    jsonb_build_object('staged_from','network_core_target_leads',
      'human_review_performed',false,'publication_authorized',false),
    'unreviewed','not_checked','not_assessed','not_assessed'
  ) returning id into v_run;

  with inserted as (
    insert into public.network_company_discovery_candidates(
      run_id,source_url,canonical_domain,website_url,legal_name,
      country_code,role_keys,product_relations,evidence,source_urls,
      match_signals,confidence,extraction_version,
      identity_quality,classification_scores,quality_flags,
      governance_status,personal_data_detected
    )
    select v_run,t.evidence_url,t.canonical_domain,
      'https://'||t.canonical_domain||'/',t.company_name,'IT',
      array[t.proposed_role]::text[],
      jsonb_build_array(jsonb_build_object(
        'key','undetermined','relationship_type','unverified')),
      jsonb_build_array(jsonb_build_object(
        'url',t.evidence_url,'title',t.company_name,
        'snippet',t.evidence_summary)),
      jsonb_build_array(t.evidence_url),
      '[]'::jsonb,0.40,'net-preview-bridge1-v1',
      jsonb_build_object('source','previous_public_research',
        'identity_verified',false,'material_signal',t.material_signal),
      '{}'::jsonb,
      case when t.company_name ~* '(s[.]?r[.]?l[.]?|s[.]?p[.]?a[.]?|s[.]?n[.]?c[.]?|s[.]?a[.]?s[.]?)\\s*$'
        then array['legal_identity_not_verified']::text[]
        else array['legal_identity_not_verified','identity_no_legal_suffix']::text[]
      end,
      'unreviewed',false
    from public.network_core_target_leads t where t.id=any(v_ids)
      and not exists(select 1 from public.network_company_discovery_candidates c
        where lower(btrim(c.canonical_domain))=lower(btrim(t.canonical_domain)))
    returning id,canonical_domain
  ), ledger as (
    insert into private.net_preview_bridge1_ledger(lead_id,candidate_id,run_id)
    select t.id,i.id,v_run from inserted i
    join public.network_core_target_leads t on t.canonical_domain=i.canonical_domain
    on conflict (lead_id) do nothing
    returning lead_id
  )
  select count(*) into v_inserted from ledger;

  update public.network_company_discovery_runs
  set candidate_count=v_inserted,
      stats=jsonb_build_object('staged_from','network_core_target_leads',
        'human_review_performed',false,'publication_authorized',false,
        'candidates_inserted',v_inserted)
  where id=v_run;

  return jsonb_build_object('contract','net-preview-bridge1-v1',
    'status','staged_for_ai_identity_verification','eligible',v_count,
    'staged',v_inserted,'run_id',v_run,'batch_max',p_max,
    'published',0);
end
$stage$;

revoke all on function private.net_preview_bridge1_stage(integer,boolean)
  from public,anon,authenticated,service_role;

-- Daily 100-company intake, offset from the already active AUTO2/AUTO3 jobs.
-- Publication never occurs in this job; the independent first-party verifier and
-- expiring AUTO3 policy remain mandatory.
do $cron$
begin
  if exists(select 1 from pg_catalog.pg_extension where extname='pg_cron') then
    perform cron.schedule(
      'net-preview-bridge1-daily-stage',
      '11 7 * * *',
      'select private.net_preview_bridge1_stage(100,false);'
    );
  end if;
end
$cron$;
