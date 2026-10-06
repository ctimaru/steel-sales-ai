-- RFQH2 — Supplier Selection & Identity Resolution.
-- Unifies manual, private-commercial, Network and registered-organization supplier identities.

alter table public.buyer_rfq_suppliers
  add column if not exists supplier_company_id uuid null references public.companies(id) on delete set null,
  add column if not exists supplier_contact_id uuid null references public.contacts(id) on delete set null,
  add column if not exists supplier_network_contact_id uuid null references public.network_contacts(id) on delete set null,
  add column if not exists identity_source text not null default 'manual',
  add column if not exists identity_key text null,
  add column if not exists resolution_status text not null default 'manual',
  add column if not exists resolved_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='buyer_rfq_suppliers_identity_source_check'
      and conrelid='public.buyer_rfq_suppliers'::regclass
  ) then
    alter table public.buyer_rfq_suppliers
      add constraint buyer_rfq_suppliers_identity_source_check
      check (identity_source in (
        'manual','recent','private_contact','private_company',
        'network_contact','network_company','platform_organization'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='buyer_rfq_suppliers_resolution_status_check'
      and conrelid='public.buyer_rfq_suppliers'::regclass
  ) then
    alter table public.buyer_rfq_suppliers
      add constraint buyer_rfq_suppliers_resolution_status_check
      check (resolution_status in (
        'manual',
        'email_matched_private_contact',
        'private_identity',
        'verified_vat_network_match',
        'network_identity',
        'registered_organization'
      ));
  end if;
end $$;

update public.buyer_rfq_suppliers
set identity_key = case
  when supplier_organization_id is not null
    then 'organization:' || supplier_organization_id::text
  when supplier_network_company_id is not null
    then 'network_company:' || supplier_network_company_id::text
  when supplier_email_normalized is not null
    then 'email:' || supplier_email_normalized
  else 'legacy:' || id::text
end
where identity_key is null;

alter table public.buyer_rfq_suppliers
  alter column identity_key set not null;

create unique index if not exists buyer_rfq_suppliers_rfq_identity_uidx
  on public.buyer_rfq_suppliers(rfq_id, identity_key);

create index if not exists buyer_rfq_suppliers_private_company_idx
  on public.buyer_rfq_suppliers(supplier_company_id)
  where supplier_company_id is not null;

create index if not exists buyer_rfq_suppliers_private_contact_idx
  on public.buyer_rfq_suppliers(supplier_contact_id)
  where supplier_contact_id is not null;

create index if not exists buyer_rfq_suppliers_network_contact_idx
  on public.buyer_rfq_suppliers(supplier_network_contact_id)
  where supplier_network_contact_id is not null;

create or replace function private.rfqh2_best_network_contact(
  p_network_company_id uuid
)
returns table(
  network_contact_id uuid,
  display_name text,
  email text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    nc.id,
    nc.display_name,
    lower(btrim(nc.email))
  from public.network_contacts nc
  join public.network_companies c on c.id=nc.company_id
  where nc.company_id=p_network_company_id
    and c.publication_status='published'
    and c.archived_at is null
    and nc.publication_status='published'
    and nc.archived_at is null
    and nc.email is not null
    and nullif(btrim(nc.email),'') is not null
    and nc.privacy_review_expires_at is not null
    and nc.privacy_review_expires_at>now()
    and (
      (
        nc.privacy_classification='company_channel'
        and nc.privacy_legal_basis='not_applicable_company_data'
        and nc.lia_status='not_required'
        and nc.art14_status='not_required'
      )
      or
      (
        nc.privacy_classification='personal_contact'
        and nc.privacy_legal_basis='art6_1_f_legitimate_interest'
        and nc.lia_status='passed'
        and nc.art14_status in ('delivered','exempt_documented')
      )
    )
  order by
    case when nc.privacy_classification='company_channel' then 0 else 1 end,
    case when nc.contact_type in ('sales','commercial','general','info') then 0 else 1 end,
    nc.display_name nulls last,
    nc.id
  limit 1;
$$;

revoke all on function private.rfqh2_best_network_contact(uuid)
from public, anon, authenticated;

create or replace function private.rfqh2_linked_supplier_organization(
  p_network_company_id uuid,
  p_buyer_organization_id uuid
)
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select l.organization_id
  from public.organization_network_company_links l
  where l.network_company_id=p_network_company_id
    and l.link_status='active'
    and l.organization_id<>p_buyer_organization_id
  order by l.linked_at desc nulls last,l.id
  limit 1;
$$;

revoke all on function private.rfqh2_linked_supplier_organization(uuid,uuid)
from public, anon, authenticated;

create or replace function private.rfqh2_verified_network_match_for_private_company(
  p_organization_id uuid,
  p_company_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_vat text;
  v_match uuid;
  v_count integer;
begin
  select nullif(private.hp4_normalize_identifier(v.identity_value),'')
  into v_vat
  from public.commercial_company_identity_verifications v
  where v.organization_id=p_organization_id
    and v.company_id=p_company_id
    and v.identity_type='vat_number'
  order by v.created_at desc,v.id desc
  limit 1;

  if v_vat is null then
    return null;
  end if;

  select count(*)::integer,min(nc.id)
  into v_count,v_match
  from public.network_companies nc
  where nc.publication_status='published'
    and nc.archived_at is null
    and private.hp4_normalize_identifier(nc.vat_id)=v_vat;

  if v_count=1 then
    return v_match;
  end if;

  return null;
end;
$$;

revoke all on function private.rfqh2_verified_network_match_for_private_company(uuid,uuid)
from public, anon, authenticated;

create or replace function private.rfqh2_add_supplier_impl(
  p_rfq_id uuid,
  p_identity_source text default 'manual',
  p_supplier_name text default null,
  p_supplier_email text default null,
  p_supplier_company_id uuid default null,
  p_supplier_contact_id uuid default null,
  p_supplier_network_company_id uuid default null,
  p_supplier_network_contact_id uuid default null,
  p_supplier_organization_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_source text := lower(btrim(coalesce(p_identity_source,'manual')));
  v_name text := nullif(btrim(coalesce(p_supplier_name,'')),'');
  v_email text := nullif(lower(btrim(coalesce(p_supplier_email,''))),'');
  v_private_company_id uuid := p_supplier_company_id;
  v_private_contact_id uuid := p_supplier_contact_id;
  v_network_company_id uuid := p_supplier_network_company_id;
  v_network_contact_id uuid := p_supplier_network_contact_id;
  v_supplier_org_id uuid := p_supplier_organization_id;
  v_network_match uuid;
  v_resolution text := 'manual';
  v_identity_key text;
  v_delivery_channel text;
  v_id uuid;
  v_count integer;
  v_contact record;
  v_company record;
  v_network record;
  v_org_name text;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select *
  into v_rfq
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id
    and r.owner_user_id=v_user_id;

  if not found then
    raise exception 'RFQ not found or not owned by caller' using errcode='42501';
  end if;

  if v_rfq.status not in ('draft','ready') then
    raise exception 'Suppliers can only be added before launch';
  end if;

  select count(*)::integer
  into v_count
  from public.buyer_rfq_suppliers s
  where s.rfq_id=p_rfq_id;

  if v_count>=100 then
    raise exception 'Maximum 100 suppliers per RFQ';
  end if;

  if v_source not in (
    'manual','recent','private_contact','private_company',
    'network_contact','network_company','platform_organization'
  ) then
    raise exception 'Unsupported supplier identity source';
  end if;

  -- Resolve exact private contact first when explicitly selected or when a manual email matches.
  if v_private_contact_id is not null then
    select
      ct.id as contact_id,
      ct.company_id,
      ct.full_name,
      coalesce(ct.email_normalized,lower(btrim(ct.email))) as email,
      c.name as company_name
    into v_contact
    from public.contacts ct
    left join public.companies c
      on c.id=ct.company_id
     and c.organization_id=ct.organization_id
    where ct.id=v_private_contact_id
      and ct.organization_id=v_rfq.organization_id;

    if not found then
      raise exception 'Private supplier contact not found in buyer organization';
    end if;

    v_private_company_id := v_contact.company_id;
    v_name := coalesce(v_contact.company_name,v_contact.full_name,v_name);
    v_email := coalesce(v_contact.email,v_email);
    v_source := 'private_contact';
    v_resolution := 'private_identity';
  elsif v_private_company_id is null and v_email is not null then
    select
      ct.id as contact_id,
      ct.company_id,
      ct.full_name,
      coalesce(ct.email_normalized,lower(btrim(ct.email))) as email,
      c.name as company_name
    into v_contact
    from public.contacts ct
    left join public.companies c
      on c.id=ct.company_id
     and c.organization_id=ct.organization_id
    where ct.organization_id=v_rfq.organization_id
      and coalesce(ct.email_normalized,lower(btrim(ct.email)))=v_email
    order by ct.created_at desc,ct.id
    limit 1;

    if found then
      v_private_contact_id := v_contact.contact_id;
      v_private_company_id := v_contact.company_id;
      v_name := coalesce(v_contact.company_name,v_contact.full_name,v_name);
      v_email := v_contact.email;
      if v_source='manual' then
        v_source := 'private_contact';
      end if;
      v_resolution := 'email_matched_private_contact';
    end if;
  end if;

  -- Resolve an explicitly selected private company and choose a usable contact if needed.
  if v_private_company_id is not null then
    select c.id,c.name,c.country,c.vat_number_normalized
    into v_company
    from public.companies c
    where c.id=v_private_company_id
      and c.organization_id=v_rfq.organization_id;

    if not found then
      raise exception 'Private supplier company not found in buyer organization';
    end if;

    v_name := coalesce(v_company.name,v_name);

    if v_private_contact_id is null then
      select
        ct.id as contact_id,
        coalesce(ct.email_normalized,lower(btrim(ct.email))) as email,
        ct.full_name
      into v_contact
      from public.contacts ct
      where ct.organization_id=v_rfq.organization_id
        and ct.company_id=v_private_company_id
        and nullif(coalesce(ct.email_normalized,lower(btrim(ct.email))), '') is not null
      order by
        case when coalesce(ct.role,'') ilike '%acquist%' then 0 else 1 end,
        ct.created_at desc,
        ct.id
      limit 1;

      if found then
        v_private_contact_id := v_contact.contact_id;
        v_email := coalesce(v_email,v_contact.email);
      end if;
    end if;

    if v_resolution='manual' then
      v_resolution := 'private_identity';
    end if;

    v_network_match :=
      private.rfqh2_verified_network_match_for_private_company(
        v_rfq.organization_id,
        v_private_company_id
      );

    if v_network_match is not null then
      v_network_company_id := v_network_match;
      v_supplier_org_id :=
        private.rfqh2_linked_supplier_organization(
          v_network_company_id,
          v_rfq.organization_id
        );
      v_resolution := 'verified_vat_network_match';
    end if;
  end if;

  -- Resolve selected Network contact/company, but only for Network-entitled buyers.
  if v_network_contact_id is not null then
    if not private.pa1_3_network_access_allowed_for(v_rfq.organization_id) then
      raise exception 'Network access required for Network supplier selection' using errcode='42501';
    end if;

    select
      nc.id as contact_id,
      nc.company_id,
      nc.display_name,
      lower(btrim(nc.email)) as email,
      c.legal_name,
      c.trading_name
    into v_network
    from public.network_contacts nc
    join public.network_companies c on c.id=nc.company_id
    where nc.id=v_network_contact_id
      and c.publication_status='published'
      and c.archived_at is null
      and nc.publication_status='published'
      and nc.archived_at is null
      and nc.email is not null
      and nullif(btrim(nc.email),'') is not null
      and nc.privacy_review_expires_at is not null
      and nc.privacy_review_expires_at>now()
      and (
        (
          nc.privacy_classification='company_channel'
          and nc.privacy_legal_basis='not_applicable_company_data'
          and nc.lia_status='not_required'
          and nc.art14_status='not_required'
        )
        or
        (
          nc.privacy_classification='personal_contact'
          and nc.privacy_legal_basis='art6_1_f_legitimate_interest'
          and nc.lia_status='passed'
          and nc.art14_status in ('delivered','exempt_documented')
        )
      );

    if not found then
      raise exception 'Network contact is not available for supplier selection';
    end if;

    v_network_company_id := v_network.company_id;
    v_name := coalesce(v_network.trading_name,v_network.legal_name,v_network.display_name,v_name);
    v_email := coalesce(v_network.email,v_email);
    v_source := 'network_contact';
    v_resolution := 'network_identity';
  end if;

  if v_network_company_id is not null then
    if not private.pa1_3_network_access_allowed_for(v_rfq.organization_id) then
      raise exception 'Network access required for Network supplier selection' using errcode='42501';
    end if;

    select
      c.id,
      c.legal_name,
      c.trading_name
    into v_network
    from public.network_companies c
    where c.id=v_network_company_id
      and c.publication_status='published'
      and c.archived_at is null;

    if not found then
      raise exception 'Network supplier company not available';
    end if;

    v_name := coalesce(v_network.trading_name,v_network.legal_name,v_name);

    if v_network_contact_id is null then
      select *
      into v_contact
      from private.rfqh2_best_network_contact(v_network_company_id);

      if found then
        v_network_contact_id := v_contact.network_contact_id;
        v_email := coalesce(v_email,v_contact.email);
      end if;
    end if;

    v_supplier_org_id := coalesce(
      v_supplier_org_id,
      private.rfqh2_linked_supplier_organization(
        v_network_company_id,
        v_rfq.organization_id
      )
    );

    if v_source not in ('network_contact','private_contact','private_company') then
      v_source := 'network_company';
    end if;
    if v_resolution not in ('verified_vat_network_match') then
      v_resolution := 'network_identity';
    end if;
  end if;

  -- Direct registered organization selection is reserved for already-linked platform suppliers.
  if v_supplier_org_id is not null then
    if v_supplier_org_id=v_rfq.organization_id then
      raise exception 'Buyer organization cannot be added as its own supplier';
    end if;

    select o.name
    into v_org_name
    from public.organizations o
    where o.id=v_supplier_org_id;

    if v_org_name is null then
      raise exception 'Supplier organization not found';
    end if;

    v_name := coalesce(v_name,v_org_name);
    if v_source='manual' then
      v_source := 'platform_organization';
    end if;
    if v_resolution='manual' then
      v_resolution := 'registered_organization';
    end if;
  end if;

  if v_email is not null
     and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Supplier email is invalid';
  end if;

  if v_name is not null and char_length(v_name)>200 then
    raise exception 'Supplier name is too long';
  end if;

  if v_supplier_org_id is null
     and v_network_company_id is null
     and v_private_company_id is null
     and v_email is null then
    raise exception 'At least one supplier identity is required';
  end if;

  v_identity_key := case
    when v_supplier_org_id is not null
      then 'organization:' || v_supplier_org_id::text
    when v_network_company_id is not null
      then 'network_company:' || v_network_company_id::text
    when v_private_company_id is not null
      then 'private_company:' || v_private_company_id::text
    else 'email:' || v_email
  end;

  if exists (
    select 1
    from public.buyer_rfq_suppliers s
    where s.rfq_id=p_rfq_id
      and (
        s.identity_key=v_identity_key
        or (
          v_supplier_org_id is not null
          and s.supplier_organization_id=v_supplier_org_id
        )
        or (
          v_network_company_id is not null
          and s.supplier_network_company_id=v_network_company_id
        )
        or (
          v_private_company_id is not null
          and s.supplier_company_id=v_private_company_id
        )
        or (
          v_email is not null
          and s.supplier_email_normalized=v_email
        )
      )
  ) then
    raise exception 'Supplier already added to this RFQ';
  end if;

  v_delivery_channel := case
    when v_supplier_org_id is not null and v_email is not null then 'both'
    when v_supplier_org_id is not null then 'platform'
    else 'email'
  end;

  if v_delivery_channel='email' and v_email is null then
    raise exception 'Supplier has no usable email or registered platform organization';
  end if;

  insert into public.buyer_rfq_suppliers(
    rfq_id,
    owner_user_id,
    supplier_organization_id,
    supplier_network_company_id,
    supplier_name,
    supplier_email,
    supplier_email_normalized,
    supplier_company_id,
    supplier_contact_id,
    supplier_network_contact_id,
    identity_source,
    identity_key,
    resolution_status,
    resolved_at,
    delivery_channel
  ) values (
    p_rfq_id,
    v_user_id,
    v_supplier_org_id,
    v_network_company_id,
    v_name,
    v_email,
    v_email,
    v_private_company_id,
    v_private_contact_id,
    v_network_contact_id,
    v_source,
    v_identity_key,
    v_resolution,
    now(),
    v_delivery_channel
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Supplier already added to this RFQ';
end;
$$;

revoke all on function private.rfqh2_add_supplier_impl(
  uuid,text,text,text,uuid,uuid,uuid,uuid,uuid
) from public, anon;
grant execute on function private.rfqh2_add_supplier_impl(
  uuid,text,text,text,uuid,uuid,uuid,uuid,uuid
) to authenticated;

create or replace function public.rfqh2_add_supplier(
  p_rfq_id uuid,
  p_identity_source text default 'manual',
  p_supplier_name text default null,
  p_supplier_email text default null,
  p_supplier_company_id uuid default null,
  p_supplier_contact_id uuid default null,
  p_supplier_network_company_id uuid default null,
  p_supplier_network_contact_id uuid default null,
  p_supplier_organization_id uuid default null
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.rfqh2_add_supplier_impl(
    p_rfq_id,
    p_identity_source,
    p_supplier_name,
    p_supplier_email,
    p_supplier_company_id,
    p_supplier_contact_id,
    p_supplier_network_company_id,
    p_supplier_network_contact_id,
    p_supplier_organization_id
  );
$$;

revoke all on function public.rfqh2_add_supplier(
  uuid,text,text,text,uuid,uuid,uuid,uuid,uuid
) from public, anon, authenticated;
grant execute on function public.rfqh2_add_supplier(
  uuid,text,text,text,uuid,uuid,uuid,uuid,uuid
) to authenticated;

-- Backward-compatible RFQH1 entry point now uses RFQH2 identity resolution.
create or replace function public.rfqh1_add_supplier(
  p_rfq_id uuid,
  p_supplier_name text default null,
  p_supplier_email text default null,
  p_supplier_network_company_id uuid default null,
  p_supplier_organization_id uuid default null
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.rfqh2_add_supplier_impl(
    p_rfq_id,
    case
      when p_supplier_network_company_id is not null then 'network_company'
      when p_supplier_organization_id is not null then 'platform_organization'
      else 'manual'
    end,
    p_supplier_name,
    p_supplier_email,
    null,
    null,
    p_supplier_network_company_id,
    null,
    p_supplier_organization_id
  );
$$;

revoke all on function public.rfqh1_add_supplier(uuid,text,text,uuid,uuid)
from public, anon, authenticated;
grant execute on function public.rfqh1_add_supplier(uuid,text,text,uuid,uuid)
to authenticated;

create or replace function private.rfqh2_supplier_candidates_impl(
  p_rfq_id uuid,
  p_query text default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_query text := nullif(btrim(coalesce(p_query,'')),'');
  v_limit integer := greatest(1,least(coalesce(p_limit,30),60));
  v_network_allowed boolean := false;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select *
  into v_rfq
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id
    and r.owner_user_id=v_user_id;

  if not found then
    raise exception 'RFQ not found or not owned by caller' using errcode='42501';
  end if;

  v_network_allowed :=
    private.pa1_3_network_access_allowed_for(v_rfq.organization_id);

  with recent as (
    select
      s.identity_key,
      'recent'::text as source,
      s.supplier_name as company_name,
      null::text as contact_name,
      s.supplier_email_normalized as email,
      null::text as country_code,
      s.delivery_channel,
      s.supplier_company_id,
      s.supplier_contact_id,
      s.supplier_network_company_id,
      s.supplier_network_contact_id,
      s.supplier_organization_id,
      10 as priority,
      max(s.created_at) as last_used_at
    from public.buyer_rfq_suppliers s
    join public.buyer_rfq_campaigns r on r.id=s.rfq_id
    where r.organization_id=v_rfq.organization_id
      and r.owner_user_id=v_user_id
      and s.rfq_id<>p_rfq_id
      and (
        v_query is null
        or coalesce(s.supplier_name,'') ilike '%'||v_query||'%'
        or coalesce(s.supplier_email_normalized,'') ilike '%'||lower(v_query)||'%'
      )
    group by
      s.identity_key,s.supplier_name,s.supplier_email_normalized,
      s.delivery_channel,s.supplier_company_id,s.supplier_contact_id,
      s.supplier_network_company_id,s.supplier_network_contact_id,
      s.supplier_organization_id
  ),
  private_contacts as (
    select
      case
        when c.id is not null then 'private_company:'||c.id::text
        else 'email:'||coalesce(ct.email_normalized,lower(btrim(ct.email)))
      end as identity_key,
      'private_contact'::text as source,
      coalesce(c.name,ct.full_name) as company_name,
      ct.full_name as contact_name,
      coalesce(ct.email_normalized,lower(btrim(ct.email))) as email,
      c.country as country_code,
      'email'::text as delivery_channel,
      c.id as supplier_company_id,
      ct.id as supplier_contact_id,
      null::uuid as supplier_network_company_id,
      null::uuid as supplier_network_contact_id,
      null::uuid as supplier_organization_id,
      20 as priority,
      ct.created_at as last_used_at
    from public.contacts ct
    left join public.companies c
      on c.id=ct.company_id
     and c.organization_id=ct.organization_id
    where ct.organization_id=v_rfq.organization_id
      and nullif(coalesce(ct.email_normalized,lower(btrim(ct.email))), '') is not null
      and (
        v_query is null
        or ct.full_name ilike '%'||v_query||'%'
        or coalesce(c.name,'') ilike '%'||v_query||'%'
        or coalesce(ct.email_normalized,lower(btrim(ct.email))) ilike '%'||lower(v_query)||'%'
      )
  ),
  network as (
    select
      case
        when linked.organization_id is not null
          then 'organization:'||linked.organization_id::text
        else 'network_company:'||nc.id::text
      end as identity_key,
      case when best.network_contact_id is not null
        then 'network_contact' else 'network_company' end as source,
      coalesce(nullif(btrim(nc.trading_name),''),nc.legal_name) as company_name,
      best.display_name as contact_name,
      best.email,
      nc.country_code,
      case
        when linked.organization_id is not null and best.email is not null then 'both'
        when linked.organization_id is not null then 'platform'
        else 'email'
      end as delivery_channel,
      null::uuid as supplier_company_id,
      null::uuid as supplier_contact_id,
      nc.id as supplier_network_company_id,
      best.network_contact_id as supplier_network_contact_id,
      linked.organization_id as supplier_organization_id,
      30 as priority,
      nc.updated_at as last_used_at
    from public.network_companies nc
    left join lateral (
      select *
      from private.rfqh2_best_network_contact(nc.id)
    ) best on true
    left join lateral (
      select private.rfqh2_linked_supplier_organization(
        nc.id,
        v_rfq.organization_id
      ) as organization_id
    ) linked on true
    where v_network_allowed
      and nc.publication_status='published'
      and nc.archived_at is null
      and (
        best.email is not null
        or linked.organization_id is not null
      )
      and (
        v_query is null
        or nc.legal_name ilike '%'||v_query||'%'
        or coalesce(nc.trading_name,'') ilike '%'||v_query||'%'
        or coalesce(nc.vat_id,'') ilike '%'||v_query||'%'
        or coalesce(nc.website_domain,'') ilike '%'||lower(v_query)||'%'
        or coalesce(best.display_name,'') ilike '%'||v_query||'%'
        or coalesce(best.email,'') ilike '%'||lower(v_query)||'%'
      )
  ),
  all_candidates as (
    select * from recent
    union all
    select * from private_contacts
    union all
    select * from network
  ),
  ranked as (
    select
      a.*,
      row_number() over(
        partition by a.identity_key
        order by a.priority,a.last_used_at desc nulls last,a.company_name
      ) as rn
    from all_candidates a
    where not exists (
      select 1
      from public.buyer_rfq_suppliers current
      where current.rfq_id=p_rfq_id
        and (
          current.identity_key=a.identity_key
          or (
            a.supplier_organization_id is not null
            and current.supplier_organization_id=a.supplier_organization_id
          )
          or (
            a.supplier_network_company_id is not null
            and current.supplier_network_company_id=a.supplier_network_company_id
          )
          or (
            a.supplier_company_id is not null
            and current.supplier_company_id=a.supplier_company_id
          )
          or (
            a.email is not null
            and current.supplier_email_normalized=a.email
          )
        )
    )
  ),
  limited as (
    select *
    from ranked
    where rn=1
    order by priority,last_used_at desc nulls last,company_name
    limit v_limit
  )
  select jsonb_build_object(
    'contract','RFQH2-supplier-candidates-v1',
    'rfq_id',v_rfq.id,
    'network_enabled',v_network_allowed,
    'candidates',
    coalesce(jsonb_agg(jsonb_build_object(
      'identity_key',identity_key,
      'source',source,
      'company_name',company_name,
      'contact_name',contact_name,
      'email',email,
      'country_code',country_code,
      'delivery_channel',delivery_channel,
      'supplier_company_id',supplier_company_id,
      'supplier_contact_id',supplier_contact_id,
      'supplier_network_company_id',supplier_network_company_id,
      'supplier_network_contact_id',supplier_network_contact_id,
      'supplier_organization_id',supplier_organization_id,
      'last_used_at',last_used_at
    ) order by priority,last_used_at desc nulls last,company_name),'[]'::jsonb)
  )
  into v_result
  from limited;

  return coalesce(v_result,jsonb_build_object(
    'contract','RFQH2-supplier-candidates-v1',
    'rfq_id',v_rfq.id,
    'network_enabled',v_network_allowed,
    'candidates','[]'::jsonb
  ));
end;
$$;

revoke all on function private.rfqh2_supplier_candidates_impl(uuid,text,integer)
from public, anon;
grant execute on function private.rfqh2_supplier_candidates_impl(uuid,text,integer)
to authenticated;

create or replace function public.rfqh2_supplier_candidates(
  p_rfq_id uuid,
  p_query text default null,
  p_limit integer default 30
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  select private.rfqh2_supplier_candidates_impl(
    p_rfq_id,p_query,p_limit
  );
$$;

revoke all on function public.rfqh2_supplier_candidates(uuid,text,integer)
from public, anon, authenticated;
grant execute on function public.rfqh2_supplier_candidates(uuid,text,integer)
to authenticated;

create or replace function private.rfqh1_log_supplier_added()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org_id uuid;
begin
  select r.organization_id into v_org_id
  from public.buyer_rfq_campaigns r
  where r.id=new.rfq_id;

  insert into public.buyer_rfq_events(
    rfq_id,
    supplier_id,
    owner_user_id,
    organization_id,
    actor_user_id,
    event_type,
    metadata
  ) values (
    new.rfq_id,
    new.id,
    new.owner_user_id,
    v_org_id,
    new.owner_user_id,
    'supplier_added',
    jsonb_build_object(
      'identity_source',new.identity_source,
      'identity_key',new.identity_key,
      'resolution_status',new.resolution_status,
      'supplier_organization_id',new.supplier_organization_id,
      'supplier_network_company_id',new.supplier_network_company_id,
      'supplier_network_contact_id',new.supplier_network_contact_id,
      'supplier_company_id',new.supplier_company_id,
      'supplier_contact_id',new.supplier_contact_id,
      'supplier_email',new.supplier_email_normalized,
      'delivery_channel',new.delivery_channel
    )
  );
  return new;
end;
$$;

revoke all on function private.rfqh1_log_supplier_added()
from public, anon, authenticated;

notify pgrst,'reload schema';
