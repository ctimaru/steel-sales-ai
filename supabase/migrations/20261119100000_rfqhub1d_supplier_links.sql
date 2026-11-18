-- RFQHUB1D (founder decision, 18 Nov 2026), audit points 7 and 10 of
-- «Fornitori RFQ»:
--   7. a supplier used only with an e-mail (e.g. a person at Bronifer) can be
--      linked to its Network company, found by the e-mail domain, so it gets
--      a company row, contacts and «Chiedi un'offerta»;
--   10. the address book shows the Network company channel (the same
--      privacy-reviewed contact already used by step 2), apart from the
--      organization's own contacts.
-- Read-only except the owner's own supplier profile link. Nothing is sent.

-- 10. Network channel per company, same rules as the step-2 picker:
--     organization member, Network access, published company, contact that
--     passed the privacy review (private.rfqh2_best_network_contact).
create or replace function private.rfqhub1d_network_channels_impl(
  p_organization_id uuid,
  p_network_company_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or not public.is_organization_member(p_organization_id, false) then
    raise exception 'organization access required' using errcode = '42501';
  end if;
  if not private.pa1_3_network_access_allowed_for(p_organization_id) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'network_company_id', nc.id,
      'display_name', best.display_name,
      'email', best.email
    ) order by nc.id)
    from (
      select distinct unnest(p_network_company_ids[1:200]) as id
    ) ids
    join public.network_companies nc on nc.id = ids.id
    cross join lateral private.rfqh2_best_network_contact(nc.id) best
    where nc.publication_status = 'published'
      and nc.archived_at is null
      and best.email is not null
  ), '[]'::jsonb);
end;
$$;

revoke all on function private.rfqhub1d_network_channels_impl(uuid, uuid[]) from public, anon;
grant execute on function private.rfqhub1d_network_channels_impl(uuid, uuid[]) to authenticated;

create or replace function public.rfqhub1d_network_channels(
  p_organization_id uuid,
  p_network_company_ids uuid[]
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.rfqhub1d_network_channels_impl(p_organization_id, p_network_company_ids);
$$;

revoke all on function public.rfqhub1d_network_channels(uuid, uuid[]) from public, anon;
grant execute on function public.rfqhub1d_network_channels(uuid, uuid[]) to authenticated;

-- 7a. For the caller's e-mail-only supplier profiles, the published Network
--     companies whose website domain is the e-mail domain. Webmail and PEC
--     domains never match.
create or replace function private.rfqhub1d_supplier_domain_matches_impl(p_profile_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'profile_id', m.profile_id,
      'network_company_id', m.network_company_id,
      'name', m.name
    ) order by m.profile_id)
    from (
      select distinct on (p.id)
        p.id as profile_id,
        nc.id as network_company_id,
        coalesce(nullif(btrim(nc.trading_name), ''), nc.legal_name) as name
      from public.buyer_supplier_profiles p
      cross join lateral (
        select lower(split_part(p.email_normalized, '@', 2)) as domain
      ) d
      join public.network_companies nc
        on lower(regexp_replace(coalesce(nc.website_domain, ''), '^www\.', '')) = d.domain
      where p.id = any(p_profile_ids[1:200])
        and p.owner_user_id = v_user
        and public.is_organization_member(p.organization_id, false)
        and p.supplier_network_company_id is null
        and p.supplier_organization_id is null
        and d.domain <> ''
        and d.domain !~ '(^|\.)(gmail|googlemail|yahoo|hotmail|outlook|live|msn|icloud|me|libero|virgilio|alice|tin|tiscali|fastwebnet|email|aruba|pec|legalmail|postecert|gmx|proton|protonmail)\.'
        and d.domain !~ '(^|\.)(pec|legalmail|postecert|arubapec)\.'
        and nc.publication_status = 'published'
        and nc.archived_at is null
      order by p.id, nc.verification_status = 'verified' desc, nc.id
    ) m
  ), '[]'::jsonb);
end;
$$;

revoke all on function private.rfqhub1d_supplier_domain_matches_impl(uuid[]) from public, anon;
grant execute on function private.rfqhub1d_supplier_domain_matches_impl(uuid[]) to authenticated;

create or replace function public.rfqhub1d_supplier_domain_matches(p_profile_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.rfqhub1d_supplier_domain_matches_impl(p_profile_ids);
$$;

revoke all on function public.rfqhub1d_supplier_domain_matches(uuid[]) from public, anon;
grant execute on function public.rfqhub1d_supplier_domain_matches(uuid[]) to authenticated;

-- 7b. Link the caller's own e-mail-only supplier profile to a published
--     Network company. Never overwrites an existing link; history stays on
--     the same profile (identity_key unchanged).
create or replace function private.rfqhub1d_link_supplier_profile_impl(
  p_profile_id uuid,
  p_network_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.buyer_supplier_profiles%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_profile
  from public.buyer_supplier_profiles
  where id = p_profile_id and owner_user_id = v_user
  for update;
  if not found or not public.is_organization_member(v_profile.organization_id, true) then
    raise exception 'supplier profile not accessible' using errcode = '42501';
  end if;
  if v_profile.supplier_network_company_id is not null or v_profile.supplier_organization_id is not null then
    return jsonb_build_object('ok', false, 'error', 'already_linked');
  end if;
  if not exists (
    select 1 from public.network_companies nc
    where nc.id = p_network_company_id
      and nc.publication_status = 'published'
      and nc.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'network_company_not_found');
  end if;

  update public.buyer_supplier_profiles
     set supplier_network_company_id = p_network_company_id,
         updated_at = now()
   where id = v_profile.id;

  return jsonb_build_object('ok', true, 'profile_id', v_profile.id, 'network_company_id', p_network_company_id);
end;
$$;

revoke all on function private.rfqhub1d_link_supplier_profile_impl(uuid, uuid) from public, anon;
grant execute on function private.rfqhub1d_link_supplier_profile_impl(uuid, uuid) to authenticated;

create or replace function public.rfqhub1d_link_supplier_profile(p_profile_id uuid, p_network_company_id uuid)
returns jsonb
language sql
set search_path = ''
as $$
  select private.rfqhub1d_link_supplier_profile_impl(p_profile_id, p_network_company_id);
$$;

revoke all on function public.rfqhub1d_link_supplier_profile(uuid, uuid) from public, anon;
grant execute on function public.rfqhub1d_link_supplier_profile(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
