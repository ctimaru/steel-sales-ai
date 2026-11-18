-- RFQHUB1B (founder decision, 18 Nov 2026): «Fornitori RFQ» is the supplier
-- address book: active suppliers, saved companies and, for each supplier,
-- the organization's own commercial contacts.
--
-- Contacts stay in the Commerciale tables (public.companies, public.contacts,
-- organization-scoped with RLS). This migration only adds a stable link
-- between a Commerciale company and the Network company it represents, so
-- that a contact saved by one colleague is attached to the same supplier for
-- everybody in the organization. Nothing here sends, publishes or exposes
-- contacts outside the organization.

alter table public.companies
  add column if not exists network_company_id uuid null
  references public.network_companies(id) on delete set null;

comment on column public.companies.network_company_id is
  'RFQHUB1B: Network company this private company represents (one per organization).';

create unique index if not exists companies_org_network_company_uq
  on public.companies (organization_id, network_company_id)
  where network_company_id is not null;

-- Save one commercial contact for a supplier. Target is either an existing
-- company of the organization or a published Network company (the private
-- company is created on first use). Same e-mail in the organization: the
-- existing contact is reused, never duplicated nor moved to another company.
create or replace function private.rfqhub1b_save_supplier_contact_impl(
  p_organization_id uuid,
  p_network_company_id uuid,
  p_company_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_role text := nullif(btrim(coalesce(p_role, '')), '');
  v_company uuid;
  v_nc_name text;
  v_nc_country text;
  v_nc_website text;
  v_existing_id uuid;
  v_existing_company uuid;
  v_contact uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_organization_id is null or not public.is_organization_member(p_organization_id, true) then
    raise exception 'write access required' using errcode = '42501';
  end if;

  if v_name is null or char_length(v_name) > 160 then
    return jsonb_build_object('ok', false, 'error', 'name');
  end if;
  if v_email is null or char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'error', 'email');
  end if;
  if char_length(coalesce(v_phone, '')) > 40 or char_length(coalesce(v_role, '')) > 80 then
    return jsonb_build_object('ok', false, 'error', 'length');
  end if;
  if (p_network_company_id is null) = (p_company_id is null) then
    return jsonb_build_object('ok', false, 'error', 'target');
  end if;

  if p_company_id is not null then
    select c.id into v_company
    from public.companies c
    where c.id = p_company_id and c.organization_id = p_organization_id;
    if v_company is null then
      return jsonb_build_object('ok', false, 'error', 'company_not_found');
    end if;
  else
    select c.id into v_company
    from public.companies c
    where c.organization_id = p_organization_id and c.network_company_id = p_network_company_id;
  end if;

  -- An e-mail belongs to one contact per organization: check before creating
  -- anything, so a rejected save leaves no company behind.
  select ct.id, ct.company_id into v_existing_id, v_existing_company
  from public.contacts ct
  where ct.organization_id = p_organization_id and ct.email_normalized = v_email;
  if v_existing_company is not null and v_existing_company is distinct from v_company then
    return jsonb_build_object('ok', false, 'error', 'email_in_use');
  end if;

  if v_company is null then
    begin
      select coalesce(nullif(btrim(n.trading_name), ''), n.legal_name), n.country_code, n.website_url
        into v_nc_name, v_nc_country, v_nc_website
      from public.network_companies n
      where n.id = p_network_company_id
        and n.publication_status = 'published'
        and n.archived_at is null;
      if v_nc_name is null then
        return jsonb_build_object('ok', false, 'error', 'network_company_not_found');
      end if;

      insert into public.companies(owner_id, organization_id, name, company_type, country, website, network_company_id)
      values (v_user, p_organization_id, left(v_nc_name, 200), 'supplier', v_nc_country, v_nc_website, p_network_company_id)
      on conflict (organization_id, network_company_id) where network_company_id is not null do nothing
      returning id into v_company;

      if v_company is null then
        select c.id into v_company
        from public.companies c
        where c.organization_id = p_organization_id and c.network_company_id = p_network_company_id;
      end if;
    end;
  end if;

  if v_existing_id is not null then
    update public.contacts
       set company_id = v_company,
           full_name = v_name,
           phone = coalesce(v_phone, phone),
           role = coalesce(v_role, role)
     where id = v_existing_id;
    return jsonb_build_object('ok', true, 'contact_id', v_existing_id, 'company_id', v_company, 'created', false);
  end if;

  insert into public.contacts(owner_id, organization_id, company_id, full_name, email, phone, role)
  values (v_user, p_organization_id, v_company, v_name, v_email, v_phone, v_role)
  returning id into v_contact;

  return jsonb_build_object('ok', true, 'contact_id', v_contact, 'company_id', v_company, 'created', true);
end;
$$;

revoke all on function private.rfqhub1b_save_supplier_contact_impl(uuid, uuid, uuid, text, text, text, text) from public, anon;
grant execute on function private.rfqhub1b_save_supplier_contact_impl(uuid, uuid, uuid, text, text, text, text) to authenticated;

create or replace function public.rfqhub1b_save_supplier_contact(
  p_organization_id uuid,
  p_network_company_id uuid,
  p_company_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_role text default null
)
returns jsonb
language sql
set search_path = ''
as $$
  select private.rfqhub1b_save_supplier_contact_impl(
    p_organization_id, p_network_company_id, p_company_id, p_full_name, p_email, p_phone, p_role);
$$;

revoke all on function public.rfqhub1b_save_supplier_contact(uuid, uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.rfqhub1b_save_supplier_contact(uuid, uuid, uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
