-- PA2.8 — exact-email Contact resolution + verified Company linkage.
-- No domain-only inference. Company can flow only from an already verified Contact.company_id mapping.

alter table public.contacts
  add column if not exists email_normalized text
  generated always as (lower(btrim(email))) stored;

create unique index if not exists contacts_org_email_normalized_uq
  on public.contacts (organization_id, email_normalized)
  where email_normalized is not null and email_normalized <> '';

alter table public.messages
  add column if not exists sender_contact_id uuid,
  add column if not exists sender_company_id uuid;

alter table public.messages
  add constraint messages_sender_contact_id_fkey
  foreign key (sender_contact_id)
  references public.contacts(id)
  on delete set null;

alter table public.messages
  add constraint messages_sender_company_id_fkey
  foreign key (sender_company_id)
  references public.companies(id)
  on delete set null;

alter table public.messages
  add constraint messages_org_sender_contact_fkey
  foreign key (organization_id, sender_contact_id)
  references public.contacts(organization_id, id);

alter table public.messages
  add constraint messages_org_sender_company_fkey
  foreign key (organization_id, sender_company_id)
  references public.companies(organization_id, id);

create index if not exists messages_sender_contact_id_idx
  on public.messages(sender_contact_id);

create index if not exists messages_sender_company_id_idx
  on public.messages(sender_company_id);

create table if not exists public.commercial_identity_resolutions (
  id bigint generated always as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  message_id uuid not null
    references public.messages(id) on delete restrict,
  contact_id uuid not null
    references public.contacts(id) on delete restrict,
  company_id uuid
    references public.companies(id) on delete restrict,
  resolution_type text not null,
  basis text not null,
  resolved_by uuid not null
    references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commercial_identity_resolutions_type_check
    check (resolution_type in ('contact','contact_company')),
  constraint commercial_identity_resolutions_basis_check
    check (basis in ('exact_email','verified_contact_company'))
);

create unique index if not exists commercial_identity_resolutions_idempotency_uq
  on public.commercial_identity_resolutions (
    organization_id,
    message_id,
    contact_id,
    coalesce(company_id,'00000000-0000-0000-0000-000000000000'::uuid),
    resolution_type,
    basis
  );

create index if not exists commercial_identity_resolutions_message_idx
  on public.commercial_identity_resolutions(organization_id,message_id);

alter table public.commercial_identity_resolutions enable row level security;

drop policy if exists commercial_identity_resolutions_select_member
  on public.commercial_identity_resolutions;

create policy commercial_identity_resolutions_select_member
on public.commercial_identity_resolutions
for select
to authenticated
using (public.is_organization_member(organization_id,false));

revoke insert,update,delete,truncate
  on public.commercial_identity_resolutions
  from anon,authenticated;

grant select on public.commercial_identity_resolutions to authenticated;
revoke all on sequence public.commercial_identity_resolutions_id_seq
  from anon,authenticated;

create or replace function private.prevent_commercial_identity_resolution_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $identity_immutable$
begin
  raise exception using
    errcode='55000',
    message='commercial_identity_resolutions is append-only';
end;
$identity_immutable$;

revoke execute on function private.prevent_commercial_identity_resolution_mutation()
from public,anon,authenticated;

drop trigger if exists commercial_identity_resolutions_immutable
  on public.commercial_identity_resolutions;

create trigger commercial_identity_resolutions_immutable
before update or delete on public.commercial_identity_resolutions
for each row
execute function private.prevent_commercial_identity_resolution_mutation();

create or replace function private.upsert_verified_contact_identity_impl(
  p_organization_id uuid,
  p_email text,
  p_full_name text,
  p_company_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $verified_contact$
declare
  actor_id uuid := (select auth.uid());
  normalized_email text := lower(btrim(coalesce(p_email,'')));
  normalized_name text := nullif(btrim(coalesce(p_full_name,'')),'');
  existing_contact public.contacts%rowtype;
  result_status text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  if normalized_email='' or position('@' in normalized_email)<=1 then
    raise exception 'Valid contact email required';
  end if;

  if normalized_name is null then
    raise exception 'Verified contact name required';
  end if;

  if p_company_id is not null and not exists (
    select 1 from public.companies c
    where c.organization_id=p_organization_id
      and c.id=p_company_id
  ) then
    raise exception 'Verified company not found in organization';
  end if;

  select *
  into existing_contact
  from public.contacts c
  where c.organization_id=p_organization_id
    and c.email_normalized=normalized_email
  for update;

  if not found then
    insert into public.contacts(
      owner_id,
      organization_id,
      company_id,
      full_name,
      email
    )
    values(
      actor_id,
      p_organization_id,
      p_company_id,
      normalized_name,
      normalized_email
    )
    returning * into existing_contact;

    result_status := 'created';
  else
    if existing_contact.company_id is not null
       and p_company_id is not null
       and existing_contact.company_id<>p_company_id then
      raise exception 'Existing contact is already linked to a different company';
    end if;

    if existing_contact.company_id is null and p_company_id is not null then
      update public.contacts
      set company_id=p_company_id
      where id=existing_contact.id
      returning * into existing_contact;
      result_status := 'company_linked';
    else
      result_status := 'existing';
    end if;
  end if;

  return jsonb_build_object(
    'status',result_status,
    'contact_id',existing_contact.id,
    'email',existing_contact.email_normalized,
    'company_id',existing_contact.company_id
  );
end;
$verified_contact$;

revoke execute on function private.upsert_verified_contact_identity_impl(uuid,text,text,uuid)
from public,anon;
grant execute on function private.upsert_verified_contact_identity_impl(uuid,text,text,uuid)
to authenticated,service_role;

create or replace function public.upsert_verified_contact_identity(
  p_organization_id uuid,
  p_email text,
  p_full_name text,
  p_company_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.upsert_verified_contact_identity_impl(
    p_organization_id,p_email,p_full_name,p_company_id
  );
$$;

revoke execute on function public.upsert_verified_contact_identity(uuid,text,text,uuid)
from public,anon;
grant execute on function public.upsert_verified_contact_identity(uuid,text,text,uuid)
to authenticated,service_role;

create or replace function private.resolve_message_business_identity_impl(
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $message_identity$
declare
  actor_id uuid := (select auth.uid());
  target_message public.messages%rowtype;
  target_contact public.contacts%rowtype;
  normalized_sender text;
  conversation_message_count integer;
  rfq_linked_count integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_message
  from public.messages
  where id=p_message_id
  for update;

  if not found then
    raise exception 'Message not found';
  end if;

  if not public.is_organization_member(target_message.organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  normalized_sender := lower(btrim(coalesce(target_message.sender_email,'')));

  if normalized_sender='' then
    return jsonb_build_object(
      'status','blocked_missing_sender_email',
      'message_id',target_message.id
    );
  end if;

  select *
  into target_contact
  from public.contacts c
  where c.organization_id=target_message.organization_id
    and c.email_normalized=normalized_sender
  limit 1;

  if not found then
    return jsonb_build_object(
      'status','blocked_missing_verified_contact',
      'message_id',target_message.id,
      'sender_email',normalized_sender
    );
  end if;

  update public.messages
  set
    sender_contact_id=target_contact.id,
    sender_company_id=target_contact.company_id
  where id=target_message.id;

  insert into public.commercial_identity_resolutions(
    organization_id,message_id,contact_id,company_id,resolution_type,basis,resolved_by,metadata
  )
  values(
    target_message.organization_id,
    target_message.id,
    target_contact.id,
    null,
    'contact',
    'exact_email',
    actor_id,
    jsonb_build_object('sender_email',normalized_sender)
  )
  on conflict do nothing;

  if target_contact.company_id is not null then
    insert into public.commercial_identity_resolutions(
      organization_id,message_id,contact_id,company_id,resolution_type,basis,resolved_by,metadata
    )
    values(
      target_message.organization_id,
      target_message.id,
      target_contact.id,
      target_contact.company_id,
      'contact_company',
      'verified_contact_company',
      actor_id,
      jsonb_build_object('contact_id',target_contact.id)
    )
    on conflict do nothing;
  end if;

  if target_message.conversation_id is not null then
    select count(*)::int
    into conversation_message_count
    from public.messages m
    where m.organization_id=target_message.organization_id
      and m.conversation_id=target_message.conversation_id;

    if conversation_message_count=1 then
      with source_thread as (
        select t.id
        from public.conversations c
        join public.commercial_threads t
          on t.organization_id=c.organization_id
         and t.source_conversation_id::text=c.external_thread_id
        where c.organization_id=target_message.organization_id
          and c.id=target_message.conversation_id
        limit 1
      ),
      target_rfqs as (
        select distinct r.id
        from source_thread st
        join public.commercial_observations o
          on o.organization_id=target_message.organization_id
         and o.thread_id=st.id
        join public.current_commercial_entity_promotions p
          on p.organization_id=o.organization_id
         and p.observation_id=o.id
         and p.entity_type='rfq_line'
        join public.rfq_lines rl
          on rl.organization_id=p.organization_id
         and rl.id=p.entity_id
        join public.rfqs r
          on r.organization_id=rl.organization_id
         and r.id=rl.rfq_id
      )
      update public.rfqs r
      set
        conversation_id=coalesce(r.conversation_id,target_message.conversation_id),
        source_message_id=coalesce(r.source_message_id,target_message.id),
        contact_id=coalesce(r.contact_id,target_contact.id),
        company_id=coalesce(r.company_id,target_contact.company_id)
      where r.id in (select id from target_rfqs)
        and r.organization_id=target_message.organization_id
        and (r.conversation_id is null or r.conversation_id=target_message.conversation_id)
        and (r.source_message_id is null or r.source_message_id=target_message.id)
        and (r.contact_id is null or r.contact_id=target_contact.id)
        and (
          target_contact.company_id is null
          or r.company_id is null
          or r.company_id=target_contact.company_id
        );

      get diagnostics rfq_linked_count=row_count;
    end if;
  end if;

  return jsonb_build_object(
    'status','resolved',
    'message_id',target_message.id,
    'contact_id',target_contact.id,
    'company_id',target_contact.company_id,
    'company_status',case
      when target_contact.company_id is null then 'blocked_missing_verified_company_mapping'
      else 'linked_verified_contact_company'
    end,
    'rfq_linked_count',rfq_linked_count
  );
end;
$message_identity$;

revoke execute on function private.resolve_message_business_identity_impl(uuid)
from public,anon;
grant execute on function private.resolve_message_business_identity_impl(uuid)
to authenticated,service_role;

create or replace function public.resolve_message_business_identity(
  p_message_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.resolve_message_business_identity_impl(p_message_id);
$$;

revoke execute on function public.resolve_message_business_identity(uuid)
from public,anon;
grant execute on function public.resolve_message_business_identity(uuid)
to authenticated,service_role;

comment on function public.resolve_message_business_identity(uuid) is
  'PA2.8 exact-email resolver. Company flows only from an existing verified Contact.company_id mapping; domain-only inference is forbidden.';
