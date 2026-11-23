-- NET-PROFILE-PROD1: public profile navigation to *already fetched* official
-- producer product pages. URLs are sources, NOT verified manufacturing claims.
-- No candidate facts, premium technical data or unpublished companies leak.
create or replace function public.netprofile_prod1_official_pages(
  p_organization_id uuid,
  p_company_id uuid,
  p_access text default 'free'
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_items jsonb;
begin
  if p_organization_id is null or p_company_id is null then
    raise exception 'Missing company or organization' using errcode = '22023';
  end if;
  if p_access = 'free' then
    perform private.netux11_require_active_company(p_organization_id);
  elsif p_access = 'pro' then
    perform private.pa1_3_require_network_access(p_organization_id);
  else
    raise exception 'Invalid access mode' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'url', sources.source_url
  ) order by sources.last_checked_at desc, sources.source_url), '[]'::jsonb)
  into v_items
  from (
    select distinct p.source_url, p.last_checked_at
    from private.network_producer_auto1_product_pages p
    join public.network_companies c on c.id = p.company_id
    where c.id = p_company_id
      and c.publication_status = 'published'
      and c.archived_at is null
      and c.website_domain is not null
      and exists (
        select 1
        from public.network_company_role_assignments a
        join public.network_company_roles r on r.id = a.role_id
        where a.company_id = c.id and r.canonical_key = 'producer'
      )
      and p.status = 'processed'
      and p.page_kind = 'products'
      and p.last_sha256 ~ '^[a-f0-9]{64}$'
      and lower(p.canonical_domain) = lower(c.website_domain)
      and p.source_url ~ '^https://[A-Za-z0-9.-]+(/|$)'
      and lower(split_part(p.source_url, '/', 3)) in (
        lower(c.website_domain), 'www.' || lower(c.website_domain)
      )
    order by p.last_checked_at desc nulls last, p.source_url
    limit 4
  ) sources;

  return jsonb_build_object(
    'contract', 'netprofile-prod1-official-pages-v1',
    'items', v_items
  );
end;
$$;

revoke all on function public.netprofile_prod1_official_pages(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.netprofile_prod1_official_pages(uuid, uuid, text)
  to authenticated;
