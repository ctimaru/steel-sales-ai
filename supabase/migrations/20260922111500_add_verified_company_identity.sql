-- PA2.9 — verified Company identity + audited Contact→Company mapping.
-- Company creation requires explicit VAT/master-data identity.
-- Human confirmation may map a Contact to an already verified Company, never create one from domain/name alone.

alter table public.companies
  add column if not exists vat_number_normalized text
  generated always as (
    nullif(
      upper(regexp_replace(coalesce(vat_number,''),'[^A-Za-z0-9]','','g')),
      ''
    )
  ) stored;

create unique index if not exists companies_org_vat_number_normalized_uq
  on public.companies (organization_id, vat_number_normalized)
  where vat_number_normalized is not null;

create table if not exists public.commercial_company_identity_verifications (
  id bigint generated always as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  company_id uuid not null
    references public.companies(id) on delete restrict,
  identity_type text not null,
  identity_value text not null,
  verification_basis text not null,
  verified_by uuid not null
    references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commercial_company_identity_verifications_type_check
    check (identity_type in ('vat_number','master_data')),
  constraint commercial_company_identity_verifications_basis_check
    check (verification_basis in ('vat_document','master_data','human_review'))
);

create unique index if not exists company_identity_verifications_identity_uq
  on public.commercial_company_identity_verifications (
    organization_id, identity_type, identity_value
  );

create index if not exists company_identity_verifications_company_idx
  on public.commercial_company_identity_verifications (
    organization_id, company_id
  );

alter table public.commercial_company_identity_verifications enable row level security;

drop policy if exists company_identity_verifications_select_member
  on public.commercial_company_identity_verifications;

create policy company_identity_verifications_select_member
on public.commercial_company_identity_verifications
for select
to authenticated
using (public.is_organization_member(organization_id,false));

revoke insert,update,delete,truncate
  on public.commercial_company_identity_verifications
  from anon,authenticated;

grant select on public.commercial_company_identity_verifications to authenticated;
revoke all on sequence public.commercial_company_identity_verifications_id_seq
  from anon,authenticated;

create table if not exists public.commercial_contact_company_mappings (
  id bigint generated always as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  contact_id uuid not null
    references public.contacts(id) on delete restrict,
  company_id uuid not null
    references public.companies(id) on delete restrict,
  mapping_basis text not null,
  mapped_by uuid not null
    references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commercial_contact_company_mappings_basis_check
    check (mapping_basis in ('human_confirmed','verified_business_record'))
);

create unique index if not exists contact_company_mappings_idempotency_uq
  on public.commercial_contact_company_mappings (
    organization_id, contact_id, company_id, mapping_basis
  );

create index if not exists contact_company_mappings_contact_idx
  on public.commercial_contact_company_mappings (
    organization_id, contact_id
  );

alter table public.commercial_contact_company_mappings enable row level security;

drop policy if exists contact_company_mappings_select_member
  on public.commercial_contact_company_mappings;

create policy contact_company_mappings_select_member
on public.commercial_contact_company_mappings
for select
to authenticated
using (public.is_organization_member(organization_id,false));

revoke insert,update,delete,truncate
  on public.commercial_contact_company_mappings
  from anon,authenticated;

grant select on public.commercial_contact_company_mappings to authenticated;
revoke all on sequence public.commercial_contact_company_mappings_id_seq
  from anon,authenticated;

create or replace function private.prevent_company_identity_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $company_identity_immutable$
begin
  raise exception using
    errcode='55000',
    message='company identity audit ledger is append-only';
end;
$company_identity_immutable$;

revoke execute on function private.prevent_company_identity_audit_mutation()
from public,anon,authenticated;

drop trigger if exists company_identity_verifications_immutable
  on public.commercial_company_identity_verifications;
create trigger company_identity_verifications_immutable
before update or delete on public.commercial_company_identity_verifications
for each row execute function private.prevent_company_identity_audit_mutation();

drop trigger if exists contact_company_mappings_immutable
  on public.commercial_contact_company_mappings;
create trigger contact_company_mappings_immutable
before update or delete on public.commercial_contact_company_mappings
for each row execute function private.prevent_company_identity_audit_mutation();

create or replace function private.upsert_verified_company_identity_impl(
  p_organization_id uuid,
  p_name text,
  p_identity_type text,
  p_identity_value text,
  p_company_id uuid default null,
  p_country text default null,
  p_company_type text default 'customer',
  p_verification_basis text default 'human_review',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $verified_company$
declare
  actor_id uuid := (select auth.uid());
  normalized_name text := nullif(btrim(coalesce(p_name,'')),'');
  normalized_type text := lower(btrim(coalesce(p_identity_type,'')));
  normalized_value text;
  normalized_basis text := lower(btrim(coalesce(p_verification_basis,'')));
  target_company public.companies%rowtype;
  existing_verification public.commercial_company_identity_verifications%rowtype;
  result_status text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  if normalized_type not in ('vat_number','master_data') then
    raise exception 'Unsupported company identity type';
  end if;

  if normalized_basis not in ('vat_document','master_data','human_review') then
    raise exception 'Unsupported verification basis';
  end if;

  normalized_value := case
    when normalized_type='vat_number'
      then nullif(upper(regexp_replace(coalesce(p_identity_value,''),'[^A-Za-z0-9]','','g')),'')
    else nullif(btrim(coalesce(p_identity_value,'')),'')
  end;

  if normalized_value is null then
    raise exception 'Verified company identity value required';
  end if;

  if p_company_id is null and normalized_name is null then
    raise exception 'Company name required when creating a verified Company';
  end if;

  select *
  into existing_verification
  from public.commercial_company_identity_verifications v
  where v.organization_id=p_organization_id
    and v.identity_type=normalized_type
    and v.identity_value=normalized_value
  limit 1;

  if found then
    if p_company_id is not null and existing_verification.company_id<>p_company_id then
      raise exception 'Verified identity is already linked to a different Company';
    end if;

    select *
    into target_company
    from public.companies c
    where c.organization_id=p_organization_id
      and c.id=existing_verification.company_id;

    return jsonb_build_object(
      'status','existing',
      'company_id',target_company.id,
      'identity_type',normalized_type,
      'identity_value',normalized_value,
      'verification_id',existing_verification.id
    );
  end if;

  if p_company_id is not null then
    select *
    into target_company
    from public.companies c
    where c.organization_id=p_organization_id
      and c.id=p_company_id
    for update;

    if not found then
      raise exception 'Company not found in organization';
    end if;

    if normalized_type='vat_number'
       and target_company.vat_number_normalized is not null
       and target_company.vat_number_normalized<>normalized_value then
      raise exception 'Company VAT number conflicts with verified VAT identity';
    end if;

    if normalized_type='vat_number'
       and target_company.vat_number_normalized is null then
      update public.companies
      set vat_number=normalized_value
      where id=target_company.id
      returning * into target_company;
    end if;

    result_status := 'verified_existing';
  else
    if normalized_type='vat_number' then
      select *
      into target_company
      from public.companies c
      where c.organization_id=p_organization_id
        and c.vat_number_normalized=normalized_value
      limit 1;
    end if;

    if not found then
      insert into public.companies(
        owner_id,
        organization_id,
        name,
        company_type,
        country,
        vat_number
      )
      values(
        actor_id,
        p_organization_id,
        normalized_name,
        p_company_type,
        nullif(btrim(coalesce(p_country,'')),''),
        case when normalized_type='vat_number' then normalized_value else null end
      )
      returning * into target_company;

      result_status := 'created';
    else
      result_status := 'verified_existing';
    end if;
  end if;

  insert into public.commercial_company_identity_verifications(
    organization_id,
    company_id,
    identity_type,
    identity_value,
    verification_basis,
    verified_by,
    metadata
  )
  values(
    p_organization_id,
    target_company.id,
    normalized_type,
    normalized_value,
    normalized_basis,
    actor_id,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning * into existing_verification;

  return jsonb_build_object(
    'status',result_status,
    'company_id',target_company.id,
    'identity_type',normalized_type,
    'identity_value',normalized_value,
    'verification_id',existing_verification.id
  );
end;
$verified_company$;

revoke execute on function private.upsert_verified_company_identity_impl(
  uuid,text,text,text,uuid,text,text,text,jsonb
) from public,anon;
grant execute on function private.upsert_verified_company_identity_impl(
  uuid,text,text,text,uuid,text,text,text,jsonb
) to authenticated,service_role;

create or replace function public.upsert_verified_company_identity(
  p_organization_id uuid,
  p_name text,
  p_identity_type text,
  p_identity_value text,
  p_company_id uuid default null,
  p_country text default null,
  p_company_type text default 'customer',
  p_verification_basis text default 'human_review',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.upsert_verified_company_identity_impl(
    p_organization_id,
    p_name,
    p_identity_type,
    p_identity_value,
    p_company_id,
    p_country,
    p_company_type,
    p_verification_basis,
    p_metadata
  );
$$;

revoke execute on function public.upsert_verified_company_identity(
  uuid,text,text,text,uuid,text,text,text,jsonb
) from public,anon;
grant execute on function public.upsert_verified_company_identity(
  uuid,text,text,text,uuid,text,text,text,jsonb
) to authenticated,service_role;

create or replace function private.link_contact_to_verified_company_impl(
  p_contact_id uuid,
  p_company_id uuid,
  p_mapping_basis text default 'human_confirmed',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $contact_company$
declare
  actor_id uuid := (select auth.uid());
  target_contact public.contacts%rowtype;
  target_company public.companies%rowtype;
  normalized_basis text := lower(btrim(coalesce(p_mapping_basis,'')));
  mapping_id bigint;
  mapping_status text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_contact
  from public.contacts
  where id=p_contact_id
  for update;

  if not found then
    raise exception 'Contact not found';
  end if;

  if not public.is_organization_member(target_contact.organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  select *
  into target_company
  from public.companies
  where organization_id=target_contact.organization_id
    and id=p_company_id;

  if not found then
    raise exception 'Company not found in organization';
  end if;

  if not exists (
    select 1
    from public.commercial_company_identity_verifications v
    where v.organization_id=target_contact.organization_id
      and v.company_id=target_company.id
  ) then
    raise exception 'Company has no verified business identity';
  end if;

  if normalized_basis not in ('human_confirmed','verified_business_record') then
    raise exception 'Unsupported Contact→Company mapping basis';
  end if;

  if target_contact.company_id is not null
     and target_contact.company_id<>target_company.id then
    raise exception 'Contact is already linked to a different Company';
  end if;

  update public.contacts
  set company_id=target_company.id
  where id=target_contact.id
    and company_id is distinct from target_company.id;

  insert into public.commercial_contact_company_mappings(
    organization_id,
    contact_id,
    company_id,
    mapping_basis,
    mapped_by,
    metadata
  )
  values(
    target_contact.organization_id,
    target_contact.id,
    target_company.id,
    normalized_basis,
    actor_id,
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (
    organization_id,contact_id,company_id,mapping_basis
  ) do nothing
  returning id into mapping_id;

  if mapping_id is null then
    select m.id
    into mapping_id
    from public.commercial_contact_company_mappings m
    where m.organization_id=target_contact.organization_id
      and m.contact_id=target_contact.id
      and m.company_id=target_company.id
      and m.mapping_basis=normalized_basis
    limit 1;
    mapping_status := 'existing';
  else
    mapping_status := 'linked';
  end if;

  return jsonb_build_object(
    'status',mapping_status,
    'contact_id',target_contact.id,
    'company_id',target_company.id,
    'mapping_id',mapping_id,
    'mapping_basis',normalized_basis
  );
end;
$contact_company$;

revoke execute on function private.link_contact_to_verified_company_impl(
  uuid,uuid,text,jsonb
) from public,anon;
grant execute on function private.link_contact_to_verified_company_impl(
  uuid,uuid,text,jsonb
) to authenticated,service_role;

create or replace function public.link_contact_to_verified_company(
  p_contact_id uuid,
  p_company_id uuid,
  p_mapping_basis text default 'human_confirmed',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.link_contact_to_verified_company_impl(
    p_contact_id,p_company_id,p_mapping_basis,p_metadata
  );
$$;

revoke execute on function public.link_contact_to_verified_company(
  uuid,uuid,text,jsonb
) from public,anon;
grant execute on function public.link_contact_to_verified_company(
  uuid,uuid,text,jsonb
) to authenticated,service_role;

comment on function public.upsert_verified_company_identity(
  uuid,text,text,text,uuid,text,text,text,jsonb
) is
  'PA2.9 creates/verifies Company only from explicit VAT or curated master-data identity.';

comment on function public.link_contact_to_verified_company(
  uuid,uuid,text,jsonb
) is
  'PA2.9 human/business-record mapping of Contact to an already verified Company; no email-domain inference.';
