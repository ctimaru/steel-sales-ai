-- NET-PROFILE-DATA2.B — Reattach orphaned discovery evidence only as PRIVATE candidates.
-- An exact, unique first-party domain match is NOT a company verification.
-- Nothing here publishes a company, accepts a fact, or modifies inventory/RFQs.
-- This migration installs an opt-in service-only RPC; it does not run the repair.

create table if not exists private.netprofile_data2_relink_audit (
  evidence_id uuid primary key,
  original_discovered_record_id uuid not null,
  canonical_company_id uuid not null,
  source_url text not null check (length(source_url) between 10 and 2048),
  policy_version text not null default 'net-profile-data2b-v1'
    check (policy_version = 'net-profile-data2b-v1'),
  recorded_at timestamptz not null default now()
);
alter table private.netprofile_data2_relink_audit enable row level security;
revoke all on private.netprofile_data2_relink_audit from public, anon, authenticated;
grant all on private.netprofile_data2_relink_audit to service_role;

create or replace function private.netprofile_data2_relink_immutable()
returns trigger language plpgsql set search_path to '' as $guard$
begin
  raise exception 'Orphan reconciliation audit is append-only' using errcode='42501';
end $guard$;
drop trigger if exists netprofile_data2_relink_immutable on private.netprofile_data2_relink_audit;
create trigger netprofile_data2_relink_immutable
before update or delete on private.netprofile_data2_relink_audit
for each row execute function private.netprofile_data2_relink_immutable();

comment on table private.netprofile_data2_relink_audit is
 'Service-only original provenance: a formerly discovered evidence is linked to a single canonical company as candidate, NEVER automatically supported or verified.';

create or replace function public.netprofile_data2_relink_orphans(
  p_limit integer default 25,
  p_apply boolean default false,
  p_evidence_id uuid default null
) returns jsonb
language plpgsql security definer set search_path to ''
as $fn$
declare
  v_row record;
  v_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_updated integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50 or p_apply is null then
    raise exception 'Invalid batch size/mode' using errcode='22023';
  end if;

  -- Stable domain matching is just an eligibility precondition; the existing
  -- DATA2 AI+source reviewer independently validates legal identity/claim.
  -- A source record must truly be absent before re-linking its evidence.
  for v_row in
    select e.id evidence_id, e.discovered_record_id old_discovered_id,
           e.evidence_url, c.id company_id
    from private.network_company_enrichment e
    left join private.netfast_discovered_records d on d.id=e.discovered_record_id
    join public.network_companies c
      on c.archived_at is null
     and c.publication_status = 'published'
     and c.website_url like 'https://%'
     and coalesce(nullif(btrim(c.legal_name), ''), '') <> ''
     and coalesce(nullif(btrim(c.website_domain), ''), '') <> ''
     and lower(regexp_replace(c.website_domain, '^www[.]', '', 'i'))
       = lower(regexp_replace(
          split_part(split_part(e.evidence_url, '://', 2), '/', 1),
          '^www[.]', '', 'i'))
     and lower(regexp_replace(
          split_part(split_part(c.website_url, '://', 2), '/', 1),
          '^www[.]', '', 'i'))
       = lower(regexp_replace(c.website_domain, '^www[.]', '', 'i'))
    where e.review_status = 'candidate'
      and e.canonical_company_id is null
      and e.discovered_record_id is not null
      and d.id is null
      and e.field_key in ('description', 'products', 'services')
      and e.evidence_url like 'https://%'
      and e.evidence_url !~ '@'
      and e.fetched_at >= now() - interval '90 days'
      and (p_evidence_id is null or e.id = p_evidence_id)
      and (select count(*) from public.network_companies c2
           where c2.archived_at is null
           and lower(regexp_replace(c2.website_domain, '^www[.]', '', 'i'))
             = lower(regexp_replace(c.website_domain, '^www[.]', '', 'i'))) = 1
      and not exists (
        select 1 from private.network_company_enrichment existing
        where existing.canonical_company_id = c.id
          and existing.field_key = e.field_key
          and (existing.evidence_url = e.evidence_url
               or existing.field_value = e.field_value)
      )
      and not exists (
        select 1 from private.netprofile_data2_relink_audit prior
        where prior.evidence_id = e.id
      )
    order by e.created_at, e.id
    limit p_limit
    for update of e skip locked
  loop
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'evidence_id', v_row.evidence_id,
      'target_company_id', v_row.company_id
    ));
    v_count := v_count + 1;

    if p_apply then
      insert into private.netprofile_data2_relink_audit(
        evidence_id, original_discovered_record_id, canonical_company_id, source_url
      ) values (
        v_row.evidence_id, v_row.old_discovered_id,
        v_row.company_id, v_row.evidence_url
      );

      update private.network_company_enrichment
      set canonical_company_id = v_row.company_id, discovered_record_id = null
      where id = v_row.evidence_id
        and review_status = 'candidate'
        and canonical_company_id is null
        and discovered_record_id = v_row.old_discovered_id;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then
        raise exception 'Concurrent evidence change; rollback whole batch'
          using errcode='40001';
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'contract', 'net-profile-data2b-relink-v1',
    'mode', case when p_apply then 'relinked_private_candidates' else 'preview_only' end,
    'count', v_count, 'items', v_items,
    'company_publication_changed', false,
    'review_status_changed', false,
    'stock_changed', false
  );
end $fn$;

revoke all on function public.netprofile_data2_relink_orphans(integer,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.netprofile_data2_relink_orphans(integer,boolean,uuid)
  to service_role;
