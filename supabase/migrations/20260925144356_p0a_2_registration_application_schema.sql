create table public.company_registration_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references auth.users(id) on delete restrict,
  applicant_email_snapshot text not null,
  legal_name text not null,
  trading_name text null,
  country_code text not null,
  vat_id text null,
  registration_id text null,
  website_url text null,
  primary_company_type text not null,
  secondary_company_types text[] not null default '{}'::text[],
  contact_name text not null,
  contact_phone text null,
  short_description text null,
  application_status text not null default 'draft',
  submitted_at timestamptz null,
  email_verified_at timestamptz null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  rejection_reason_code text null,
  rejection_note text null,
  activated_organization_id uuid null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_registration_applications_status_check
    check (application_status in (
      'draft',
      'submitted',
      'email_verification_pending',
      'pending_review',
      'needs_information',
      'approved',
      'rejected',
      'withdrawn',
      'activated',
      'suspended'
    )),

  constraint company_registration_applications_primary_type_check
    check (primary_company_type in (
      'producer',
      'trader_distributor',
      'processor_service_provider',
      'end_user'
    )),

  constraint company_registration_applications_secondary_types_check
    check (
      secondary_company_types <@ array[
        'producer',
        'trader_distributor',
        'processor_service_provider',
        'end_user'
      ]::text[]
      and not (primary_company_type = any(secondary_company_types))
    ),

  constraint company_registration_applications_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),

  constraint company_registration_applications_legal_name_length_check
    check (char_length(btrim(legal_name)) between 1 and 255),

  constraint company_registration_applications_trading_name_length_check
    check (trading_name is null or char_length(btrim(trading_name)) between 1 and 255),

  constraint company_registration_applications_identifier_length_check
    check (
      (vat_id is null or char_length(vat_id) <= 64)
      and (registration_id is null or char_length(registration_id) <= 64)
    ),

  constraint company_registration_applications_website_length_check
    check (website_url is null or char_length(website_url) <= 500),

  constraint company_registration_applications_contact_name_length_check
    check (char_length(btrim(contact_name)) between 1 and 200),

  constraint company_registration_applications_contact_phone_length_check
    check (contact_phone is null or char_length(contact_phone) <= 80),

  constraint company_registration_applications_description_length_check
    check (short_description is null or char_length(short_description) <= 2000),

  constraint company_registration_applications_email_snapshot_length_check
    check (char_length(applicant_email_snapshot) between 3 and 320),

  constraint company_registration_applications_review_integrity_check
    check (
      application_status not in ('approved','rejected','activated')
      or (reviewed_at is not null and reviewed_by is not null)
    ),

  constraint company_registration_applications_rejection_integrity_check
    check (
      application_status <> 'rejected'
      or rejection_reason_code in (
        'duplicate_application',
        'unverifiable_identity',
        'incomplete_information',
        'unsupported_business',
        'abuse_or_spam',
        'other'
      )
    ),

  constraint company_registration_applications_activation_integrity_check
    check (
      application_status <> 'activated'
      or activated_organization_id is not null
    ),

  constraint company_registration_applications_pending_review_email_check
    check (
      application_status <> 'pending_review'
      or email_verified_at is not null
    )
);

create index company_registration_applications_applicant_idx
  on public.company_registration_applications (applicant_user_id, created_at desc);

create index company_registration_applications_status_idx
  on public.company_registration_applications (application_status, created_at desc);

create index company_registration_applications_identity_idx
  on public.company_registration_applications (country_code, vat_id)
  where vat_id is not null;

create index company_registration_applications_registration_id_idx
  on public.company_registration_applications (country_code, registration_id)
  where registration_id is not null;

alter table public.company_registration_applications enable row level security;

revoke all on table public.company_registration_applications from public;
revoke all on table public.company_registration_applications from anon;
revoke all on table public.company_registration_applications from authenticated;

grant select on table public.company_registration_applications to authenticated;

grant insert (
  legal_name,
  trading_name,
  country_code,
  vat_id,
  registration_id,
  website_url,
  primary_company_type,
  secondary_company_types,
  contact_name,
  contact_phone,
  short_description
) on public.company_registration_applications to authenticated;

grant update (
  legal_name,
  trading_name,
  country_code,
  vat_id,
  registration_id,
  website_url,
  primary_company_type,
  secondary_company_types,
  contact_name,
  contact_phone,
  short_description
) on public.company_registration_applications to authenticated;

create policy "Applicants can read their own registration applications"
on public.company_registration_applications
for select
to authenticated
using (
  (select auth.uid()) is not null
  and applicant_user_id = (select auth.uid())
);

create policy "Applicants can create only their own draft application"
on public.company_registration_applications
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and applicant_user_id = (select auth.uid())
  and application_status = 'draft'
);

create policy "Applicants can edit only their own editable application"
on public.company_registration_applications
for update
to authenticated
using (
  (select auth.uid()) is not null
  and applicant_user_id = (select auth.uid())
  and application_status in ('draft','needs_information')
)
with check (
  (select auth.uid()) is not null
  and applicant_user_id = (select auth.uid())
  and application_status in ('draft','needs_information')
);

create or replace function private.p0a_prepare_registration_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;
  current_email text;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  select u.email
    into current_email
  from auth.users u
  where u.id = current_user_id;

  if current_email is null then
    raise exception 'authenticated user email is required'
      using errcode = '23514';
  end if;

  new.applicant_user_id := current_user_id;
  new.applicant_email_snapshot := current_email;
  new.application_status := 'draft';
  new.submitted_at := null;
  new.email_verified_at := null;
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.rejection_reason_code := null;
  new.rejection_note := null;
  new.activated_organization_id := null;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();

  return new;
end;
$function$;

revoke all on function private.p0a_prepare_registration_application() from public;
revoke all on function private.p0a_prepare_registration_application() from anon;
revoke all on function private.p0a_prepare_registration_application() from authenticated;

create trigger p0a_prepare_registration_application
before insert on public.company_registration_applications
for each row
execute function private.p0a_prepare_registration_application();

create or replace function private.p0a_touch_registration_application_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.p0a_touch_registration_application_updated_at() from public;
revoke all on function private.p0a_touch_registration_application_updated_at() from anon;
revoke all on function private.p0a_touch_registration_application_updated_at() from authenticated;

create trigger p0a_touch_registration_application_updated_at
before update on public.company_registration_applications
for each row
execute function private.p0a_touch_registration_application_updated_at();
