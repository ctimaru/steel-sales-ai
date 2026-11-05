-- NET-RO1.4.D / C.1 visual verification fixture — DISPOSABLE LOCAL SUPABASE ONLY.
-- CI invokes this file strictly via psql -h 127.0.0.1 -p 54322.
-- Never execute in a hosted database. It simulates C pilot publication and
-- a synthetic tenant network entitlement; no claim or corporate outreach.
\set ON_ERROR_STOP on
begin;

do $netro14d_ci$
declare
  v_preview jsonb;
  v_publish jsonb;
  v_count integer;
begin
  select private.network_ro14c_publish_pilot(false) into v_preview;
  if v_preview->>'status' <> 'preview_only'
     or (v_preview->>'would_publish')::integer <> 9
     or (v_preview->>'duplicate_canonical')::integer <> 0
     or (v_preview->>'suppressed')::integer <> 0 then
    raise exception 'NET-RO1.4.D local C pilot preview invalid: %',v_preview;
  end if;

  select private.network_ro14c_publish_pilot(true) into v_publish;
  if v_publish->>'status' <> 'published'
    or (v_publish->>'published_count')::integer <> 9 then
    raise exception 'NET-RO1.4.D local C pilot publish invalid: %',v_publish;
  end if;

  select count(*) into v_count
  from public.network_companies
  where country_code='RO' and publication_status='published'
    and claimed_status='unclaimed' and verification_status='unverified';
  if v_count <> 9 then
    raise exception 'NET-RO1.4.D local C pilot expected nine unclaimed/unverified, got %',v_count;
  end if;
end
$netro14d_ci$;

-- The synthetic DEMOTEST23 buyer + viewer are members of this one local-only
-- organization. Grant only a local pilot entitlement, no real plan/contract.
insert into public.organization_product_entitlement_events(
 event_order,organization_id,product_key,event_type,
 source_kind,source_reference,idempotency_key,
 effective_at,actor_authority_type,metadata
)
select coalesce(max(event_order),0)+1,
 '00000000-0000-0000-0000-000000023301'::uuid,
 'network_access','granted','pilot','NET-RO1.4.D-ci-local',
 'netro14d.local.visual.20261105',now(),'system',
 '{"fixture":"netro14d_local_chrome_only","no_production":true}'::jsonb
from public.organization_product_entitlement_events;

commit;
select 'NET-RO1.4.D disposable Chrome setup: 9 RO public test profiles, synthetic paid Network access, zero claims' AS result;
