-- P3.7D — Company Identity & Public Contacts
-- Adds governed logo media + public contact management without exposing Commercial Memory.

alter table public.network_companies
  add column if not exists logo_path text,
  add column if not exists logo_updated_at timestamptz;

alter table public.network_contacts
  add column if not exists source_assertion_id uuid references public.network_data_assertions(id) on delete restrict,
  add column if not exists verification_status text not null default 'unverified';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.network_contacts'::regclass
      and conname='network_contacts_verification_status_check'
  ) then
    alter table public.network_contacts
      add constraint network_contacts_verification_status_check
      check (verification_status in ('unverified','pending','verified','rejected'));
  end if;
end;
$$;

alter table public.network_profile_management_events
  drop constraint if exists network_profile_management_events_entity_type_check;
alter table public.network_profile_management_events
  add constraint network_profile_management_events_entity_type_check
  check (entity_type in (
    'company',
    'company_role_assignment',
    'company_subtype_assignment',
    'company_product',
    'company_market',
    'facility',
    'facility_capability',
    'company_certification',
    'contact'
  ));

alter table public.network_profile_management_events
  drop constraint if exists network_profile_management_events_operation_check;
alter table public.network_profile_management_events
  add constraint network_profile_management_events_operation_check
  check (operation in (
    'update_overview',
    'add_relation',
    'remove_relation',
    'add_facility',
    'update_facility',
    'archive_facility',
    'add_capability',
    'remove_capability',
    'add_certification',
    'update_certification',
    'remove_certification',
    'add_contact',
    'update_contact',
    'archive_contact'
  ));

insert into storage.buckets(
  id,name,public,file_size_limit,allowed_mime_types
)
values(
  'network-company-media',
  'network-company-media',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.p3_7d_can_manage_company_media_path(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_company_id uuid;
  v_first_segment text;
begin
  v_user := (select auth.uid());
  if v_user is null then
    return false;
  end if;

  v_first_segment := split_part(coalesce(p_object_name,''),'/',1);
  if v_first_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_company_id := v_first_segment::uuid;

  return private.m7_user_can_manage_network_company(v_company_id,v_user)
    or private.is_platform_superadmin();
end;
$function$;

revoke all on function private.p3_7d_can_manage_company_media_path(text)
from public,anon;
grant execute on function private.p3_7d_can_manage_company_media_path(text)
to authenticated,service_role;

drop policy if exists "p3_7d_company_media_select" on storage.objects;
create policy "p3_7d_company_media_select"
on storage.objects
for select
to authenticated
using (
  bucket_id='network-company-media'
  and private.p3_7d_can_manage_company_media_path(name)
);

drop policy if exists "p3_7d_company_media_insert" on storage.objects;
create policy "p3_7d_company_media_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='network-company-media'
  and private.p3_7d_can_manage_company_media_path(name)
);

drop policy if exists "p3_7d_company_media_update" on storage.objects;
create policy "p3_7d_company_media_update"
on storage.objects
for update
to authenticated
using (
  bucket_id='network-company-media'
  and private.p3_7d_can_manage_company_media_path(name)
)
with check (
  bucket_id='network-company-media'
  and private.p3_7d_can_manage_company_media_path(name)
);

drop policy if exists "p3_7d_company_media_delete" on storage.objects;
create policy "p3_7d_company_media_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id='network-company-media'
  and private.p3_7d_can_manage_company_media_path(name)
);

create or replace function private.p3_7d_create_assertion(
  p_network_company_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_field_path text,
  p_asserted_value jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_id uuid;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,
    asserted_by,confidence,review_state
  )
  values(
    p_entity_type,p_entity_id,btrim(p_field_path),coalesce(p_asserted_value,'{}'::jsonb),
    'company_declared','managed_profile:p3.7d','company_managed',
    v_user,1.0000,'accepted'
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function private.p3_7d_create_assertion(uuid,text,uuid,text,jsonb)
from public,anon,authenticated;

create or replace function private.p3_7d_set_logo_path_impl(
  p_network_company_id uuid,
  p_logo_path text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_old_path text;
  v_new_path text;
  v_assertion_id uuid;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);
  v_new_path := nullif(btrim(coalesce(p_logo_path,'')),'');

  if v_new_path is not null
     and v_new_path <> p_network_company_id::text || '/logo' then
    raise exception 'invalid company logo path' using errcode='22023';
  end if;

  select c.logo_path into v_old_path
  from public.network_companies c
  where c.id=p_network_company_id
  for update;

  if v_old_path is not distinct from v_new_path then
    return jsonb_build_object(
      'network_company_id',p_network_company_id,
      'logo_path',v_new_path,
      'idempotent',true
    );
  end if;

  v_assertion_id := private.p3_7d_create_assertion(
    p_network_company_id,
    'company',
    p_network_company_id,
    'logo_path',
    jsonb_build_object('logo_path',v_new_path)
  );

  update public.network_companies
  set logo_path=v_new_path,
      logo_updated_at=now(),
      updated_at=now()
  where id=p_network_company_id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,
    'update_overview',
    'company',
    p_network_company_id,
    'logo_path',
    jsonb_build_object('logo_path',v_old_path),
    jsonb_build_object('logo_path',v_new_path),
    v_assertion_id
  );

  return jsonb_build_object(
    'network_company_id',p_network_company_id,
    'logo_path',v_new_path,
    'previous_logo_path',v_old_path,
    'idempotent',false
  );
end;
$function$;

revoke all on function private.p3_7d_set_logo_path_impl(uuid,text)
from public,anon;
grant execute on function private.p3_7d_set_logo_path_impl(uuid,text)
to authenticated,service_role;

create or replace function public.p3_7d_set_logo_path(
  p_network_company_id uuid,
  p_logo_path text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7d_set_logo_path_impl(
    p_network_company_id,p_logo_path
  );
$function$;

revoke all on function public.p3_7d_set_logo_path(uuid,text)
from public,anon;
grant execute on function public.p3_7d_set_logo_path(uuid,text)
to authenticated,service_role;

create or replace function private.p3_7d_upsert_contact_impl(
  p_network_company_id uuid,
  p_contact_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_contact public.network_contacts%rowtype;
  v_exists boolean := false;
  v_id uuid;
  v_assertion_id uuid;
  v_source_ownership text;
  v_contact_type text;
  v_display_name text;
  v_email text;
  v_phone text;
  v_website_url text;
  v_publication_status text;
  v_facility_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  v_contact_type := lower(nullif(btrim(p_payload->>'contact_type'),''));
  v_display_name := nullif(btrim(p_payload->>'display_name'),'');
  v_email := lower(nullif(btrim(p_payload->>'email'),''));
  v_phone := nullif(btrim(p_payload->>'phone'),'');
  v_website_url := nullif(btrim(p_payload->>'website_url'),'');
  v_publication_status := coalesce(nullif(btrim(p_payload->>'publication_status'),''),'published');
  v_facility_id := nullif(btrim(p_payload->>'facility_id'),'')::uuid;

  if v_contact_type is null
     or v_contact_type not in ('general','sales','purchasing','technical','quality','logistics') then
    raise exception 'invalid public contact type' using errcode='22023';
  end if;

  if v_display_name is not null and char_length(v_display_name)>200 then
    raise exception 'contact display name exceeds 200 characters' using errcode='22023';
  end if;

  if v_email is not null and (
    char_length(v_email)>320
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ) then
    raise exception 'invalid contact email' using errcode='22023';
  end if;

  if v_phone is not null and char_length(v_phone)>100 then
    raise exception 'contact phone exceeds 100 characters' using errcode='22023';
  end if;

  if v_website_url is not null and (
    char_length(v_website_url)>500
    or v_website_url !~* '^https?://'
  ) then
    raise exception 'invalid contact website URL' using errcode='22023';
  end if;

  if v_email is null and v_phone is null and v_website_url is null then
    raise exception 'public contact requires at least one channel' using errcode='22023';
  end if;

  if v_publication_status not in ('draft','published') then
    raise exception 'invalid public contact visibility' using errcode='22023';
  end if;

  if v_facility_id is not null and not exists(
    select 1
    from public.network_facilities f
    where f.id=v_facility_id
      and f.company_id=p_network_company_id
      and f.publication_status<>'archived'
  ) then
    raise exception 'contact facility does not belong to managed company'
      using errcode='23503';
  end if;

  if p_contact_id is not null then
    select c.* into v_contact
    from public.network_contacts c
    where c.id=p_contact_id
      and c.company_id=p_network_company_id
    for update;
    v_exists := found;

    if not v_exists then
      raise exception 'public contact not found' using errcode='P0002';
    end if;

    if v_contact.verification_status='verified' then
      raise exception 'verified public contact requires Platform review'
        using errcode='42501';
    end if;

    if v_contact.source_assertion_id is null then
      raise exception 'platform or crawler contact cannot be overwritten directly'
        using errcode='42501';
    end if;

    select a.ownership_type into v_source_ownership
    from public.network_data_assertions a
    where a.id=v_contact.source_assertion_id;

    if v_source_ownership is distinct from 'company_managed' then
      raise exception 'platform or crawler contact cannot be overwritten directly'
        using errcode='42501';
    end if;

    v_id := v_contact.id;
    v_before := jsonb_build_object(
      'contact_type',v_contact.contact_type,
      'display_name',v_contact.display_name,
      'email',v_contact.email,
      'phone',v_contact.phone,
      'website_url',v_contact.website_url,
      'facility_id',v_contact.facility_id,
      'publication_status',v_contact.publication_status
    );
  else
    v_id := gen_random_uuid();
    v_before := null;
  end if;

  v_after := jsonb_build_object(
    'contact_type',v_contact_type,
    'display_name',v_display_name,
    'email',v_email,
    'phone',v_phone,
    'website_url',v_website_url,
    'facility_id',v_facility_id,
    'publication_status',v_publication_status
  );

  v_assertion_id := private.p3_7d_create_assertion(
    p_network_company_id,
    'contact',
    v_id,
    'public_contact_state',
    v_after
  );

  if v_exists then
    update public.network_contacts
    set facility_id=v_facility_id,
        contact_type=v_contact_type,
        display_name=v_display_name,
        email=v_email,
        phone=v_phone,
        website_url=v_website_url,
        publication_status=v_publication_status,
        consent_basis='company_publication_authorized',
        source_reference='managed_profile:p3.7d',
        source_assertion_id=v_assertion_id,
        verification_status='unverified',
        archived_at=null,
        updated_at=now()
    where id=v_id;
  else
    insert into public.network_contacts(
      id,company_id,facility_id,contact_type,display_name,
      email,phone,website_url,publication_status,
      consent_basis,source_reference,source_assertion_id,
      verification_status,archived_at
    )
    values(
      v_id,p_network_company_id,v_facility_id,v_contact_type,v_display_name,
      v_email,v_phone,v_website_url,v_publication_status,
      'company_publication_authorized','managed_profile:p3.7d',v_assertion_id,
      'unverified',null
    );
  end if;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,
    case when v_exists then 'update_contact' else 'add_contact' end,
    'contact',
    v_id,
    'public_contact_state',
    v_before,
    v_after,
    v_assertion_id
  );

  return jsonb_build_object(
    'contact_id',v_id,
    'created',not v_exists,
    'publication_status',v_publication_status
  );
end;
$function$;

revoke all on function private.p3_7d_upsert_contact_impl(uuid,uuid,jsonb)
from public,anon;
grant execute on function private.p3_7d_upsert_contact_impl(uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function public.p3_7d_upsert_contact(
  p_network_company_id uuid,
  p_contact_id uuid,
  p_payload jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7d_upsert_contact_impl(
    p_network_company_id,p_contact_id,p_payload
  );
$function$;

revoke all on function public.p3_7d_upsert_contact(uuid,uuid,jsonb)
from public,anon;
grant execute on function public.p3_7d_upsert_contact(uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function private.p3_7d_archive_contact_impl(
  p_network_company_id uuid,
  p_contact_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_contact public.network_contacts%rowtype;
  v_source_ownership text;
  v_assertion_id uuid;
  v_before jsonb;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  select c.* into v_contact
  from public.network_contacts c
  where c.id=p_contact_id
    and c.company_id=p_network_company_id
  for update;

  if not found then
    raise exception 'public contact not found' using errcode='P0002';
  end if;

  if v_contact.publication_status='archived' then
    return jsonb_build_object(
      'contact_id',v_contact.id,'archived',true,'idempotent',true
    );
  end if;

  if v_contact.verification_status='verified' then
    raise exception 'verified public contact requires Platform review'
      using errcode='42501';
  end if;

  if v_contact.source_assertion_id is null then
    raise exception 'platform or crawler contact cannot be archived directly'
      using errcode='42501';
  end if;

  select a.ownership_type into v_source_ownership
  from public.network_data_assertions a
  where a.id=v_contact.source_assertion_id;

  if v_source_ownership is distinct from 'company_managed' then
    raise exception 'platform or crawler contact cannot be archived directly'
      using errcode='42501';
  end if;

  v_before := jsonb_build_object(
    'contact_type',v_contact.contact_type,
    'display_name',v_contact.display_name,
    'email',v_contact.email,
    'phone',v_contact.phone,
    'website_url',v_contact.website_url,
    'facility_id',v_contact.facility_id,
    'publication_status',v_contact.publication_status
  );

  v_assertion_id := private.p3_7d_create_assertion(
    p_network_company_id,
    'contact',
    v_contact.id,
    'archived',
    jsonb_build_object('publication_status','archived')
  );

  update public.network_contacts
  set publication_status='archived',
      archived_at=now(),
      source_assertion_id=v_assertion_id,
      source_reference='managed_profile:p3.7d',
      updated_at=now()
  where id=v_contact.id;

  perform private.p3_7_record_profile_event_impl(
    p_network_company_id,
    'archive_contact',
    'contact',
    v_contact.id,
    'publication_status',
    v_before,
    jsonb_build_object('publication_status','archived'),
    v_assertion_id
  );

  return jsonb_build_object(
    'contact_id',v_contact.id,'archived',true,'idempotent',false
  );
end;
$function$;

revoke all on function private.p3_7d_archive_contact_impl(uuid,uuid)
from public,anon;
grant execute on function private.p3_7d_archive_contact_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p3_7d_archive_contact(
  p_network_company_id uuid,
  p_contact_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_7d_archive_contact_impl(
    p_network_company_id,p_contact_id
  );
$function$;

revoke all on function public.p3_7d_archive_contact(uuid,uuid)
from public,anon;
grant execute on function public.p3_7d_archive_contact(uuid,uuid)
to authenticated,service_role;

create or replace function private.p3_7d_managed_identity_contacts_impl(
  p_network_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_company public.network_companies%rowtype;
begin
  v_user := private.p3_7b_require_manage_access(p_network_company_id);

  select * into v_company
  from public.network_companies
  where id=p_network_company_id;

  return jsonb_build_object(
    'logo_path',v_company.logo_path,
    'logo_updated_at',v_company.logo_updated_at,
    'contacts',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',c.id,
        'facility_id',c.facility_id,
        'contact_type',c.contact_type,
        'display_name',c.display_name,
        'email',c.email,
        'phone',c.phone,
        'website_url',c.website_url,
        'publication_status',c.publication_status,
        'verification_status',c.verification_status,
        'source_assertion_id',c.source_assertion_id,
        'source_type',a.source_type,
        'ownership_type',a.ownership_type,
        'review_state',a.review_state
      ) order by c.created_at,c.id),'[]'::jsonb)
      from public.network_contacts c
      left join public.network_data_assertions a on a.id=c.source_assertion_id
      where c.company_id=p_network_company_id
        and c.publication_status<>'archived'
    )
  );
end;
$function$;

revoke all on function private.p3_7d_managed_identity_contacts_impl(uuid)
from public,anon;
grant execute on function private.p3_7d_managed_identity_contacts_impl(uuid)
to authenticated,service_role;

create or replace function public.p3_7d_managed_identity_contacts(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_7d_managed_identity_contacts_impl(p_network_company_id);
$function$;

revoke all on function public.p3_7d_managed_identity_contacts(uuid)
from public,anon;
grant execute on function public.p3_7d_managed_identity_contacts(uuid)
to authenticated,service_role;

create or replace function private.p3_7d_public_identity_contacts_impl(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
select jsonb_build_object(
  'logo_path',c.logo_path,
  'logo_updated_at',c.logo_updated_at,
  'contacts',(
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',nc.id,
      'facility_id',nc.facility_id,
      'contact_type',nc.contact_type,
      'display_name',nc.display_name,
      'email',nc.email,
      'phone',nc.phone,
      'website_url',nc.website_url,
      'verification_status',nc.verification_status,
      'provenance_kind',case
        when nc.verification_status='verified'
          or a.ownership_type='platform_verified' then 'platform_verified'
        when a.ownership_type='company_managed' then 'company_declared'
        when a.source_type='public_web' then 'public_web'
        else 'platform_curated'
      end
    ) order by nc.contact_type,nc.display_name nulls last,nc.id),'[]'::jsonb)
    from public.network_contacts nc
    left join public.network_data_assertions a on a.id=nc.source_assertion_id
    where nc.company_id=c.id
      and nc.publication_status='published'
  )
)
from public.network_companies c
where c.id=p_network_company_id
  and c.publication_status='published';
$function$;

revoke all on function private.p3_7d_public_identity_contacts_impl(uuid)
from public,anon;
grant execute on function private.p3_7d_public_identity_contacts_impl(uuid)
to authenticated,service_role;

create or replace function public.p3_7d_public_identity_contacts(
  p_network_company_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.p3_7d_public_identity_contacts_impl(p_network_company_id);
$function$;

revoke all on function public.p3_7d_public_identity_contacts(uuid)
from public,anon;
grant execute on function public.p3_7d_public_identity_contacts(uuid)
to authenticated,service_role;

comment on function public.p3_7d_set_logo_path(uuid,text) is
  'P3.7D governed logo pointer mutation; actual image bytes live in network-company-media.';
comment on function public.p3_7d_upsert_contact(uuid,uuid,jsonb) is
  'P3.7D governed company-managed public contact upsert with provenance and audit.';
comment on function public.p3_7d_archive_contact(uuid,uuid) is
  'P3.7D governed archive of company-managed public contact.';
