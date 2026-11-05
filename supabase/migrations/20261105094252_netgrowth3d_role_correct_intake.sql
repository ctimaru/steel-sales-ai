-- NET-GROWTH3.D: role-correct first-party industrial intake.
-- This is a separate RPC: it does not relax the proven trader-only intake.
-- Non-canonical, unconfirmed, service_role-only, atomic. No crawler or publishing.

alter table public.network_core_target_leads
  drop constraint network_core_target_leads_proposed_role_check;

alter table public.network_core_target_leads
  add constraint network_core_target_leads_proposed_role_check
  check (proposed_role in (
    'end_user', 'trader_distributor', 'producer', 'processor_service_provider'
  ));

create or replace function public.netgrowth3d_stage_industrial(
  p_items jsonb, p_batch text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $body$
declare
  rec jsonb;
  n integer := 0;
  v_domain text;
  v_source text;
  v_host text;
  v_name text;
  v_name_key text;
  v_summary text;
  v_role text;
begin
  if current_user <> 'service_role' then
    raise exception 'NET-GROWTH3.D industrial intake is service-role-only' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 50 and 100
     or p_batch !~ '^NET-GROWTH3D-[A-Z0-9-]{3,70}$'
     or length(p_batch) > 90 then
    raise exception 'Expected 50..100 independently sourced industrial companies and batch key'
      using errcode = '22023';
  end if;

  for rec in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(rec) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(rec)) <> 7
       or not (rec ?& array['name','domain','evidence_url','summary',
                             'segment','material_signal','role']) then
      raise exception 'Incomplete or unexpected first-party evidence'
        using errcode = '22023';
    end if;

    v_name := btrim(coalesce(rec->>'name', ''));
    v_domain := lower(btrim(coalesce(rec->>'domain', '')));
    v_source := btrim(coalesce(rec->>'evidence_url', ''));
    v_summary := btrim(coalesce(rec->>'summary', ''));
    v_role := rec->>'role';
    v_host := regexp_replace(
      lower(split_part(v_source, '/', 3)), '^www[.]', ''
    );
    v_name_key := regexp_replace(lower(v_name), '[^[:alnum:]]', '', 'g');

    if v_role not in ('producer', 'processor_service_provider')
       or (rec->>'segment') <> 'other'
       or (rec->>'material_signal') <> 'explicit_steel_tube_product'
       or length(v_name) not between 3 and 180
       or length(v_summary) not between 25 and 1000
       or v_name ~ '[[:cntrl:]<>@]'
       or v_summary ~ '[[:cntrl:]<>@]'
       or v_domain !~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'
       or v_domain like '%..%'
       or v_source !~* '^https://[a-z0-9][a-z0-9.-]+(/[^[:space:]<>]*)?$'
       or length(v_source) > 1800
       or position('@' in v_source) > 0
       or position(':' in split_part(v_source,'/',3)) > 0
       or position('#' in v_source) > 0
       or v_host <> v_domain then
      raise exception 'Invalid role or company-owned steel-tube evidence'
        using errcode = '22023';
    end if;

    -- Domain matches include already-staged, published, withdrawn and opt-out.
    -- No bypass by switching www or using another source registry.
    if exists (select 1 from public.network_companies c
               where regexp_replace(lower(coalesce(c.website_domain,'')),
                                    '^www[.]', '') = v_domain)
       or exists (select 1 from public.network_core_target_leads c
                  where regexp_replace(lower(c.canonical_domain),
                                       '^www[.]', '') = v_domain)
       or exists (select 1 from public.network_company_discovery_candidates c
                  where regexp_replace(lower(c.canonical_domain),
                                       '^www[.]', '') = v_domain)
       or exists (select 1 from public.network_netfast2_structured_entities c
                  where regexp_replace(lower(c.domain),
                                       '^www[.]', '') = v_domain)
       or exists (select 1 from public.network_netfast3_entities c
                  where regexp_replace(lower(c.domain),
                                       '^www[.]', '') = v_domain)
       or exists (select 1 from public.network_netfast3_suppressed_domains c
                  where regexp_replace(lower(c.domain),
                                       '^www[.]', '') = v_domain) then
      raise exception 'Industrial source domain already recorded or suppressed'
        using errcode = '23505';
    end if;

    -- Strict exact-normalized-name guard: group subsidiaries and alternate
    -- domains with similar names require independent corporate review.
    if exists (select 1 from public.network_companies c where
       regexp_replace(lower(coalesce(c.legal_name,'')), '[^[:alnum:]]', '', 'g') = v_name_key)
       or exists (select 1 from public.network_core_target_leads c where
       regexp_replace(lower(c.company_name), '[^[:alnum:]]', '', 'g') = v_name_key)
       or exists (select 1 from public.network_company_discovery_candidates c where
       regexp_replace(lower(coalesce(c.legal_name,'')), '[^[:alnum:]]', '', 'g') = v_name_key) then
      raise exception 'Potential industrial legal-name alias: review required'
        using errcode = '23505';
    end if;

    insert into public.network_core_target_leads (
      company_name, canonical_domain, evidence_url, evidence_summary,
      segment, proposed_role, material_signal, intake_batch, status
    ) values (
      v_name, v_domain, v_source, v_summary, 'other', v_role,
      'explicit_steel_tube_product', p_batch, 'needs_review'
    );
    n := n + 1;
  end loop;

  -- Unlike legacy per-row ingestion, a single invalid or duplicate item
  -- raises an exception and rolls back the entire transaction.
  return jsonb_build_object(
    'contract', 'netgrowth3d-industrial-atomic-v1',
    'requested', n, 'new_unconfirmed', n,
    'duplicates', 0, 'invalid', 0,
    'published', 0, 'verified_buyers', 0,
    'status', 'completed'
  );
end;
$body$;

revoke all on function public.netgrowth3d_stage_industrial(jsonb,text)
  from public, anon, authenticated;
grant execute on function public.netgrowth3d_stage_industrial(jsonb,text)
  to service_role;

comment on function public.netgrowth3d_stage_industrial(jsonb,text) is
  'NET-GROWTH3.D: atomic first-party service-only intake of 50-100 steel tube producers and processors; never auto publishes.';
