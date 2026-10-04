-- LR4 — Company Directory & Claim Governance.
--
-- Hardens the private paid Network against accidental disclosure of person-linked
-- contact data. Legal-entity/company data remains separately governed by PA1.5.
--
-- Core rule:
--   * company channels can be disclosed only after explicit privacy classification;
--   * person-linked contacts require a passed Art. 6(1)(f) LIA AND Art. 14 notice
--     evidence (or a documented Art. 14(5) exception) before disclosure;
--   * review expires after 12 months and stale contacts disappear from read models;
--   * claim ownership proof remains separate from profile verification and from
--     permission to publish personal contact data.

alter table public.network_contacts
  add column if not exists privacy_classification text not null default 'unreviewed',
  add column if not exists privacy_legal_basis text not null default 'not_assessed',
  add column if not exists lia_status text not null default 'not_assessed',
  add column if not exists art14_status text not null default 'not_assessed',
  add column if not exists source_obtained_at timestamptz null,
  add column if not exists art14_due_at timestamptz null,
  add column if not exists art14_delivered_at timestamptz null,
  add column if not exists art14_notice_version text null,
  add column if not exists art14_notice_channel text null,
  add column if not exists art14_exception_reason text null,
  add column if not exists privacy_reviewed_by uuid null references auth.users(id) on delete restrict,
  add column if not exists privacy_reviewed_at timestamptz null,
  add column if not exists privacy_review_expires_at timestamptz null,
  add column if not exists privacy_review_note text null,
  add column if not exists first_disclosed_at timestamptz null;

alter table public.network_contacts
  drop constraint if exists network_contacts_lr4_privacy_classification_check;
alter table public.network_contacts
  add constraint network_contacts_lr4_privacy_classification_check
  check (privacy_classification in ('unreviewed','company_channel','personal_contact'));

alter table public.network_contacts
  drop constraint if exists network_contacts_lr4_privacy_legal_basis_check;
alter table public.network_contacts
  add constraint network_contacts_lr4_privacy_legal_basis_check
  check (
    privacy_legal_basis in (
      'not_assessed',
      'not_applicable_company_data',
      'art6_1_f_legitimate_interest',
      'blocked'
    )
  );

alter table public.network_contacts
  drop constraint if exists network_contacts_lr4_lia_status_check;
alter table public.network_contacts
  add constraint network_contacts_lr4_lia_status_check
  check (lia_status in ('not_assessed','not_required','pending','passed','failed'));

alter table public.network_contacts
  drop constraint if exists network_contacts_lr4_art14_status_check;
alter table public.network_contacts
  add constraint network_contacts_lr4_art14_status_check
  check (
    art14_status in (
      'not_assessed',
      'not_required',
      'pending',
      'delivered',
      'delivered_late',
      'exempt_documented'
    )
  );

alter table public.network_contacts
  drop constraint if exists network_contacts_lr4_notice_channel_check;
alter table public.network_contacts
  add constraint network_contacts_lr4_notice_channel_check
  check (
    art14_notice_channel is null
    or art14_notice_channel in ('email','postal','in_product','other')
  );

alter table public.network_contacts
  drop constraint if exists network_contacts_lr4_privacy_text_check;
alter table public.network_contacts
  add constraint network_contacts_lr4_privacy_text_check
  check (
    (art14_notice_version is null or char_length(art14_notice_version)<=120)
    and (art14_exception_reason is null or char_length(art14_exception_reason)<=2000)
    and (privacy_review_note is null or char_length(privacy_review_note)<=4000)
  );

alter table public.network_contacts
  drop constraint if exists network_contacts_lr4_review_timing_check;
alter table public.network_contacts
  add constraint network_contacts_lr4_review_timing_check
  check (
    (
      privacy_reviewed_at is null
      and privacy_reviewed_by is null
      and privacy_review_expires_at is null
    )
    or
    (
      privacy_reviewed_at is not null
      and privacy_reviewed_by is not null
      and privacy_review_expires_at is not null
      and privacy_review_expires_at>privacy_reviewed_at
    )
  );

alter table public.network_contacts
  drop constraint if exists network_contacts_lr4_art14_integrity_check;
alter table public.network_contacts
  add constraint network_contacts_lr4_art14_integrity_check
  check (
    (art14_status in ('not_assessed','not_required','pending')
      and art14_delivered_at is null)
    or
    (art14_status in ('delivered','delivered_late')
      and art14_delivered_at is not null
      and art14_notice_version is not null
      and art14_notice_channel is not null)
    or
    (art14_status='exempt_documented'
      and art14_delivered_at is null
      and art14_exception_reason is not null)
  );

create index if not exists network_contacts_lr4_privacy_queue_idx
  on public.network_contacts(
    privacy_classification,
    lia_status,
    art14_status,
    privacy_review_expires_at,
    publication_status
  );

-- Existing contact publication predates LR4. Fail closed: no legacy contact remains
-- disclosable until it has an explicit LR4 classification/review.
update public.network_contacts
set publication_status='pending_review',
    privacy_classification='unreviewed',
    privacy_legal_basis='not_assessed',
    lia_status='not_assessed',
    art14_status='not_assessed',
    source_obtained_at=null,
    art14_due_at=null,
    art14_delivered_at=null,
    art14_notice_version=null,
    art14_notice_channel=null,
    art14_exception_reason=null,
    privacy_reviewed_by=null,
    privacy_reviewed_at=null,
    privacy_review_expires_at=null,
    privacy_review_note=null,
    first_disclosed_at=null
where publication_status='published';

create table if not exists public.network_art14_notice_log (
  id uuid primary key default gen_random_uuid(),
  network_contact_id uuid not null references public.network_contacts(id) on delete restrict,
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  notice_version text not null check (char_length(notice_version) between 1 and 120),
  outcome text not null check (
    outcome in ('delivered','delivered_late','exempt_documented')
  ),
  source_obtained_at timestamptz not null,
  due_at timestamptz not null,
  effective_at timestamptz not null,
  channel text null check (
    channel is null or channel in ('email','postal','in_product','other')
  ),
  evidence_reference text null check (
    evidence_reference is null or char_length(evidence_reference)<=1000
  ),
  exception_reason text null check (
    exception_reason is null or char_length(exception_reason)<=2000
  ),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint network_art14_notice_log_integrity_check check (
    (
      outcome in ('delivered','delivered_late')
      and channel is not null
      and evidence_reference is not null
      and exception_reason is null
      and effective_at>=source_obtained_at
    )
    or
    (
      outcome='exempt_documented'
      and channel is null
      and exception_reason is not null
    )
  )
);

alter table public.network_art14_notice_log enable row level security;
revoke all on table public.network_art14_notice_log from public,anon,authenticated;
grant select,insert on table public.network_art14_notice_log to service_role;

create index if not exists network_art14_notice_log_contact_idx
  on public.network_art14_notice_log(network_contact_id,recorded_at desc);

create or replace function private.lr4_art14_notice_immutable_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'LR4 Article 14 notice evidence is immutable'
    using errcode='55000';
end;
$function$;

revoke all on function private.lr4_art14_notice_immutable_guard()
  from public,anon,authenticated;

drop trigger if exists network_art14_notice_log_immutable
  on public.network_art14_notice_log;
create trigger network_art14_notice_log_immutable
before update or delete on public.network_art14_notice_log
for each row execute function private.lr4_art14_notice_immutable_guard();

insert into public.platform_permissions(
  permission_key,area,action,risk_level,description,is_root_only
)
values(
  'network.privacy_governance_review',
  'network',
  'privacy_governance_review',
  'critical',
  'Classify Network contact data, decide legitimate-interest LIA and record Article 14 notice evidence.',
  true
)
on conflict (permission_key) do update
set
  area=excluded.area,
  action=excluded.action,
  risk_level=excluded.risk_level,
  description=excluded.description,
  is_root_only=true;

create or replace function private.lr4_contact_privacy_ready(
  p_classification text,
  p_legal_basis text,
  p_lia_status text,
  p_art14_status text,
  p_review_expires_at timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path=''
as $function$
  select
    p_review_expires_at is not null
    and p_review_expires_at>now()
    and (
      (
        p_classification='company_channel'
        and p_legal_basis='not_applicable_company_data'
        and p_lia_status='not_required'
        and p_art14_status='not_required'
      )
      or
      (
        p_classification='personal_contact'
        and p_legal_basis='art6_1_f_legitimate_interest'
        and p_lia_status='passed'
        and p_art14_status in ('delivered','exempt_documented')
      )
    );
$function$;

revoke all on function private.lr4_contact_privacy_ready(
  text,text,text,text,timestamptz
) from public,anon,authenticated;

create or replace function private.lr4_contact_publication_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  if new.publication_status='published' then
    if not private.lr4_contact_privacy_ready(
      new.privacy_classification,
      new.privacy_legal_basis,
      new.lia_status,
      new.art14_status,
      new.privacy_review_expires_at
    ) then
      raise exception 'LR4 privacy governance blocks contact disclosure'
        using errcode='42501',
              detail='contact requires current classification/LIA/Article 14 readiness';
    end if;

    new.first_disclosed_at:=coalesce(new.first_disclosed_at,now());
  end if;

  return new;
end;
$function$;

revoke all on function private.lr4_contact_publication_guard()
  from public,anon,authenticated;

drop trigger if exists lr4_contact_publication_guard on public.network_contacts;
create trigger lr4_contact_publication_guard
before insert or update of
  publication_status,
  privacy_classification,
  privacy_legal_basis,
  lia_status,
  art14_status,
  privacy_review_expires_at
on public.network_contacts
for each row execute function private.lr4_contact_publication_guard();

-- Tighten direct Network-table reads. PA1.3's restrictive entitlement policy
-- still applies in addition to this permissive publication/privacy policy.
drop policy if exists "Authenticated users can read published network contacts"
  on public.network_contacts;

create policy "Authenticated users can read LR4-ready network contacts"
on public.network_contacts
for select
to authenticated
using (
  publication_status='published'
  and privacy_review_expires_at is not null
  and privacy_review_expires_at>now()
  and (
    (
      privacy_classification='company_channel'
      and privacy_legal_basis='not_applicable_company_data'
      and lia_status='not_required'
      and art14_status='not_required'
    )
    or
    (
      privacy_classification='personal_contact'
      and privacy_legal_basis='art6_1_f_legitimate_interest'
      and lia_status='passed'
      and art14_status in ('delivered','exempt_documented')
    )
  )
  and exists (
    select 1
    from public.network_companies c
    where c.id=company_id
      and c.publication_status='published'
  )
  and (
    facility_id is null
    or exists (
      select 1
      from public.network_facilities f
      where f.id=facility_id
        and f.publication_status='published'
    )
  )
);

-- Company-managed contact changes can no longer self-publish person-linked data.
-- Requested publication is converted into pending_review and the prior privacy
-- decision is reset because the disclosed data have changed.
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
  v_requested_publication_status text;
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
  v_requested_publication_status := coalesce(
    nullif(btrim(p_payload->>'publication_status'),''),
    'pending_review'
  );
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

  if v_requested_publication_status not in ('draft','pending_review','published') then
    raise exception 'invalid public contact visibility' using errcode='22023';
  end if;

  -- LR4: a company can propose a contact for publication but cannot bypass the
  -- privacy classification/LIA/Art.14 gate.
  v_publication_status:=case
    when v_requested_publication_status='draft' then 'draft'
    else 'pending_review'
  end;

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
      'publication_status',v_contact.publication_status,
      'privacy_classification',v_contact.privacy_classification,
      'art14_status',v_contact.art14_status
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
    'publication_status',v_publication_status,
    'privacy_review_required',true
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
        privacy_classification='unreviewed',
        privacy_legal_basis='not_assessed',
        lia_status='not_assessed',
        art14_status='not_assessed',
        source_obtained_at=null,
        art14_due_at=null,
        art14_delivered_at=null,
        art14_notice_version=null,
        art14_notice_channel=null,
        art14_exception_reason=null,
        privacy_reviewed_by=null,
        privacy_reviewed_at=null,
        privacy_review_expires_at=null,
        privacy_review_note=null,
        first_disclosed_at=null,
        archived_at=null,
        updated_at=now()
    where id=v_id;
  else
    insert into public.network_contacts(
      id,company_id,facility_id,contact_type,display_name,
      email,phone,website_url,publication_status,
      consent_basis,source_reference,source_assertion_id,
      verification_status,privacy_classification,privacy_legal_basis,
      lia_status,art14_status,archived_at
    )
    values(
      v_id,p_network_company_id,v_facility_id,v_contact_type,v_display_name,
      v_email,v_phone,v_website_url,v_publication_status,
      'company_publication_authorized','managed_profile:p3.7d',v_assertion_id,
      'unverified','unreviewed','not_assessed',
      'not_assessed','not_assessed',null
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
    'publication_status',v_publication_status,
    'privacy_review_required',true
  );
end;
$function$;

revoke all on function private.p3_7d_upsert_contact_impl(uuid,uuid,jsonb)
from public,anon;
grant execute on function private.p3_7d_upsert_contact_impl(uuid,uuid,jsonb)
to authenticated,service_role;

-- Expand the PA1.5 immutable governance ledger to include LR4 contact privacy decisions.
alter table public.network_data_governance_events
  drop constraint if exists network_data_governance_events_subject_type_check;
alter table public.network_data_governance_events
  add constraint network_data_governance_events_subject_type_check
  check (
    subject_type in (
      'discovery_run','discovery_candidate','public_data_request','network_contact'
    )
  );

alter table public.network_data_governance_events
  drop constraint if exists network_data_governance_events_action_check;
alter table public.network_data_governance_events
  add constraint network_data_governance_events_action_check
  check (
    action in (
      'source_governance_reviewed',
      'candidate_governance_reviewed',
      'public_data_request_received',
      'public_data_request_reviewed',
      'contact_privacy_reviewed',
      'art14_notice_recorded'
    )
  );

create or replace function private.lr4_review_contact_privacy_impl(
  p_contact_id uuid,
  p_classification text,
  p_lia_decision text default null,
  p_source_obtained_at timestamptz default null,
  p_note text default null,
  p_publish_company_channel boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_contact public.network_contacts%rowtype;
  v_before jsonb;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_lia text := lower(btrim(coalesce(p_lia_decision,'')));
begin
  perform private.require_platform_permission('network.privacy_governance_review');

  if p_classification not in ('company_channel','personal_contact') then
    raise exception 'invalid LR4 privacy classification' using errcode='22023';
  end if;

  if v_note is not null and char_length(v_note)>4000 then
    raise exception 'privacy review note exceeds 4000 characters' using errcode='22023';
  end if;

  select * into v_contact
  from public.network_contacts
  where id=p_contact_id
  for update;

  if not found then
    raise exception 'network contact not found' using errcode='P0002';
  end if;

  if v_contact.publication_status='archived' then
    raise exception 'archived contact cannot be privacy-reviewed for publication'
      using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'publication_status',v_contact.publication_status,
    'privacy_classification',v_contact.privacy_classification,
    'privacy_legal_basis',v_contact.privacy_legal_basis,
    'lia_status',v_contact.lia_status,
    'art14_status',v_contact.art14_status,
    'privacy_review_expires_at',v_contact.privacy_review_expires_at
  );

  if p_classification='company_channel' then
    update public.network_contacts
    set privacy_classification='company_channel',
        privacy_legal_basis='not_applicable_company_data',
        lia_status='not_required',
        art14_status='not_required',
        source_obtained_at=coalesce(p_source_obtained_at,source_obtained_at),
        art14_due_at=null,
        art14_delivered_at=null,
        art14_notice_version=null,
        art14_notice_channel=null,
        art14_exception_reason=null,
        privacy_reviewed_by=v_user,
        privacy_reviewed_at=now(),
        privacy_review_expires_at=now()+interval '12 months',
        privacy_review_note=v_note,
        publication_status=case
          when p_publish_company_channel then 'published'
          when publication_status='suspended' then 'pending_review'
          else publication_status
        end
    where id=p_contact_id
    returning * into v_contact;
  else
    if p_source_obtained_at is null then
      raise exception 'personal contact review requires source_obtained_at'
        using errcode='22023';
    end if;

    if v_lia not in ('passed','failed') then
      raise exception 'personal contact requires LIA decision passed or failed'
        using errcode='22023';
    end if;

    update public.network_contacts
    set privacy_classification='personal_contact',
        privacy_legal_basis=case
          when v_lia='passed' then 'art6_1_f_legitimate_interest'
          else 'blocked'
        end,
        lia_status=v_lia,
        art14_status=case when v_lia='passed' then 'pending' else 'not_assessed' end,
        source_obtained_at=p_source_obtained_at,
        art14_due_at=case
          when v_lia='passed' then p_source_obtained_at+interval '1 month'
          else null
        end,
        art14_delivered_at=null,
        art14_notice_version=null,
        art14_notice_channel=null,
        art14_exception_reason=null,
        privacy_reviewed_by=v_user,
        privacy_reviewed_at=now(),
        privacy_review_expires_at=case
          when v_lia='passed' then now()+interval '12 months'
          else null
        end,
        privacy_review_note=v_note,
        publication_status=case
          when v_lia='passed' then 'pending_review'
          else 'suspended'
        end,
        first_disclosed_at=null
    where id=p_contact_id
    returning * into v_contact;
  end if;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,
    before_state,after_state,note
  )
  values(
    'network_contact',p_contact_id,'contact_privacy_reviewed',
    v_user,'platform',v_before,
    jsonb_build_object(
      'publication_status',v_contact.publication_status,
      'privacy_classification',v_contact.privacy_classification,
      'privacy_legal_basis',v_contact.privacy_legal_basis,
      'lia_status',v_contact.lia_status,
      'art14_status',v_contact.art14_status,
      'source_obtained_at',v_contact.source_obtained_at,
      'art14_due_at',v_contact.art14_due_at,
      'privacy_review_expires_at',v_contact.privacy_review_expires_at
    ),
    v_note
  );

  return jsonb_build_object(
    'contact_id',v_contact.id,
    'company_id',v_contact.company_id,
    'publication_status',v_contact.publication_status,
    'privacy_classification',v_contact.privacy_classification,
    'privacy_legal_basis',v_contact.privacy_legal_basis,
    'lia_status',v_contact.lia_status,
    'art14_status',v_contact.art14_status,
    'art14_due_at',v_contact.art14_due_at,
    'privacy_review_expires_at',v_contact.privacy_review_expires_at,
    'publication_ready',private.lr4_contact_privacy_ready(
      v_contact.privacy_classification,
      v_contact.privacy_legal_basis,
      v_contact.lia_status,
      v_contact.art14_status,
      v_contact.privacy_review_expires_at
    )
  );
end;
$function$;

revoke all on function private.lr4_review_contact_privacy_impl(
  uuid,text,text,timestamptz,text,boolean
) from public,anon,authenticated;
grant execute on function private.lr4_review_contact_privacy_impl(
  uuid,text,text,timestamptz,text,boolean
) to authenticated,service_role;

create or replace function public.lr4_review_contact_privacy(
  p_contact_id uuid,
  p_classification text,
  p_lia_decision text default null,
  p_source_obtained_at timestamptz default null,
  p_note text default null,
  p_publish_company_channel boolean default false
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.lr4_review_contact_privacy_impl(
    p_contact_id,p_classification,p_lia_decision,
    p_source_obtained_at,p_note,p_publish_company_channel
  );
$function$;

revoke all on function public.lr4_review_contact_privacy(
  uuid,text,text,timestamptz,text,boolean
) from public,anon;
grant execute on function public.lr4_review_contact_privacy(
  uuid,text,text,timestamptz,text,boolean
) to authenticated,service_role;

create or replace function private.lr4_record_art14_notice_impl(
  p_contact_id uuid,
  p_outcome text,
  p_effective_at timestamptz default now(),
  p_channel text default null,
  p_evidence_reference text default null,
  p_exception_reason text default null,
  p_publish boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_contact public.network_contacts%rowtype;
  v_outcome text := lower(btrim(coalesce(p_outcome,'')));
  v_channel text := nullif(lower(btrim(coalesce(p_channel,''))),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_exception text := nullif(btrim(coalesce(p_exception_reason,'')),'');
  v_status text;
  v_before jsonb;
begin
  perform private.require_platform_permission('network.privacy_governance_review');

  select * into v_contact
  from public.network_contacts
  where id=p_contact_id
  for update;

  if not found then
    raise exception 'network contact not found' using errcode='P0002';
  end if;

  if v_contact.privacy_classification<>'personal_contact'
     or v_contact.privacy_legal_basis<>'art6_1_f_legitimate_interest'
     or v_contact.lia_status<>'passed'
     or v_contact.source_obtained_at is null
     or v_contact.art14_due_at is null then
    raise exception 'Art. 14 evidence requires a passed personal-contact LIA'
      using errcode='22023';
  end if;

  if p_effective_at is null or p_effective_at>now()+interval '5 minutes' then
    raise exception 'invalid Article 14 effective timestamp' using errcode='22023';
  end if;

  if v_outcome='delivered' then
    if v_channel not in ('email','postal','in_product','other') or v_evidence is null then
      raise exception 'delivered Article 14 notice requires channel and evidence reference'
        using errcode='22023';
    end if;
    if p_effective_at<v_contact.source_obtained_at then
      raise exception 'Article 14 notice cannot predate source acquisition'
        using errcode='22023';
    end if;
    v_status:=case
      when p_effective_at<=v_contact.art14_due_at then 'delivered'
      else 'delivered_late'
    end;
    v_exception:=null;
  elsif v_outcome='exempt_documented' then
    if v_exception is null then
      raise exception 'Article 14 exception requires a documented reason'
        using errcode='22023';
    end if;
    v_status:='exempt_documented';
    v_channel:=null;
    v_evidence:=coalesce(v_evidence,'exception-review');
  else
    raise exception 'invalid Article 14 outcome' using errcode='22023';
  end if;

  v_before:=jsonb_build_object(
    'publication_status',v_contact.publication_status,
    'art14_status',v_contact.art14_status,
    'art14_delivered_at',v_contact.art14_delivered_at,
    'first_disclosed_at',v_contact.first_disclosed_at
  );

  update public.network_contacts
  set art14_status=v_status,
      art14_delivered_at=case
        when v_status in ('delivered','delivered_late') then p_effective_at
        else null
      end,
      art14_notice_version='2026-10-04-lr4-v1',
      art14_notice_channel=v_channel,
      art14_exception_reason=v_exception
  where id=p_contact_id
  returning * into v_contact;

  insert into public.network_art14_notice_log(
    network_contact_id,network_company_id,notice_version,outcome,
    source_obtained_at,due_at,effective_at,channel,evidence_reference,
    exception_reason,recorded_by
  )
  values(
    v_contact.id,v_contact.company_id,'2026-10-04-lr4-v1',v_status,
    v_contact.source_obtained_at,v_contact.art14_due_at,p_effective_at,
    v_channel,v_evidence,v_exception,v_user
  );

  if p_publish then
    if not private.lr4_contact_privacy_ready(
      v_contact.privacy_classification,
      v_contact.privacy_legal_basis,
      v_contact.lia_status,
      v_contact.art14_status,
      v_contact.privacy_review_expires_at
    ) then
      raise exception 'contact is not LR4-ready for disclosure'
        using errcode='42501';
    end if;

    update public.network_contacts
    set publication_status='published'
    where id=p_contact_id
    returning * into v_contact;
  end if;

  insert into public.network_data_governance_events(
    subject_type,subject_id,action,actor_user_id,actor_type,
    before_state,after_state,note
  )
  values(
    'network_contact',p_contact_id,'art14_notice_recorded',
    v_user,'platform',v_before,
    jsonb_build_object(
      'publication_status',v_contact.publication_status,
      'art14_status',v_contact.art14_status,
      'art14_delivered_at',v_contact.art14_delivered_at,
      'art14_notice_version',v_contact.art14_notice_version,
      'art14_notice_channel',v_contact.art14_notice_channel,
      'first_disclosed_at',v_contact.first_disclosed_at
    ),
    coalesce(v_evidence,v_exception)
  );

  return jsonb_build_object(
    'contact_id',v_contact.id,
    'art14_status',v_contact.art14_status,
    'art14_due_at',v_contact.art14_due_at,
    'art14_delivered_at',v_contact.art14_delivered_at,
    'notice_version',v_contact.art14_notice_version,
    'publication_status',v_contact.publication_status,
    'publication_ready',private.lr4_contact_privacy_ready(
      v_contact.privacy_classification,
      v_contact.privacy_legal_basis,
      v_contact.lia_status,
      v_contact.art14_status,
      v_contact.privacy_review_expires_at
    )
  );
end;
$function$;

revoke all on function private.lr4_record_art14_notice_impl(
  uuid,text,timestamptz,text,text,text,boolean
) from public,anon,authenticated;
grant execute on function private.lr4_record_art14_notice_impl(
  uuid,text,timestamptz,text,text,text,boolean
) to authenticated,service_role;

create or replace function public.lr4_record_art14_notice(
  p_contact_id uuid,
  p_outcome text,
  p_effective_at timestamptz default now(),
  p_channel text default null,
  p_evidence_reference text default null,
  p_exception_reason text default null,
  p_publish boolean default false
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.lr4_record_art14_notice_impl(
    p_contact_id,p_outcome,p_effective_at,p_channel,
    p_evidence_reference,p_exception_reason,p_publish
  );
$function$;

revoke all on function public.lr4_record_art14_notice(
  uuid,text,timestamptz,text,text,text,boolean
) from public,anon;
grant execute on function public.lr4_record_art14_notice(
  uuid,text,timestamptz,text,text,text,boolean
) to authenticated,service_role;

create or replace function private.lr4_privacy_governance_state_impl(
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit,250),1),500);
begin
  perform private.require_platform_permission('network.privacy_governance_review');

  return jsonb_build_object(
    'contract','LR4-company-directory-privacy-v1',
    'notice_version','2026-10-04-lr4-v1',
    'items',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.created_at desc)
      from (
        select
          nc.id as contact_id,
          nc.company_id,
          c.legal_name,
          nc.contact_type,
          nc.display_name,
          nc.email,
          nc.phone,
          nc.website_url,
          nc.publication_status,
          nc.privacy_classification,
          nc.privacy_legal_basis,
          nc.lia_status,
          nc.art14_status,
          nc.source_obtained_at,
          nc.art14_due_at,
          nc.art14_delivered_at,
          nc.privacy_reviewed_at,
          nc.privacy_review_expires_at,
          private.lr4_contact_privacy_ready(
            nc.privacy_classification,
            nc.privacy_legal_basis,
            nc.lia_status,
            nc.art14_status,
            nc.privacy_review_expires_at
          ) as publication_ready,
          nc.created_at
        from public.network_contacts nc
        join public.network_companies c on c.id=nc.company_id
        where nc.publication_status<>'archived'
        order by nc.created_at desc
        limit v_limit
      ) q
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'review_required',(
        select count(*)
        from public.network_contacts
        where publication_status<>'archived'
          and (
            privacy_classification='unreviewed'
            or privacy_review_expires_at is null
            or privacy_review_expires_at<=now()
          )
      ),
      'art14_pending',(
        select count(*)
        from public.network_contacts
        where privacy_classification='personal_contact'
          and lia_status='passed'
          and art14_status='pending'
      ),
      'art14_overdue',(
        select count(*)
        from public.network_contacts
        where privacy_classification='personal_contact'
          and art14_status='pending'
          and art14_due_at is not null
          and art14_due_at<now()
      ),
      'publication_ready',(
        select count(*)
        from public.network_contacts nc
        where nc.publication_status<>'archived'
          and private.lr4_contact_privacy_ready(
            nc.privacy_classification,
            nc.privacy_legal_basis,
            nc.lia_status,
            nc.art14_status,
            nc.privacy_review_expires_at
          )
      )
    )
  );
end;
$function$;

revoke all on function private.lr4_privacy_governance_state_impl(integer)
  from public,anon;
grant execute on function private.lr4_privacy_governance_state_impl(integer)
  to authenticated,service_role;

create or replace function public.lr4_privacy_governance_state(
  p_limit integer default 250
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.lr4_privacy_governance_state_impl(p_limit);
$function$;

revoke all on function public.lr4_privacy_governance_state(integer)
  from public,anon;
grant execute on function public.lr4_privacy_governance_state(integer)
  to authenticated,service_role;

-- Harden privileged contact read models, which otherwise bypass table RLS.
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
      and private.lr4_contact_privacy_ready(
        nc.privacy_classification,
        nc.privacy_legal_basis,
        nc.lia_status,
        nc.art14_status,
        nc.privacy_review_expires_at
      )
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

create or replace function private.lr4_public_company_profile_impl(
  p_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_profile jsonb;
  v_contacts jsonb;
begin
  v_profile:=private.p3_7c_public_company_profile_impl(p_company_id);

  if v_profile is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',nc.id,
    'facility_id',nc.facility_id,
    'contact_type',nc.contact_type,
    'display_name',nc.display_name,
    'email',nc.email,
    'phone',nc.phone,
    'website_url',nc.website_url
  ) order by nc.contact_type,nc.display_name nulls last,nc.id),'[]'::jsonb)
  into v_contacts
  from public.network_contacts nc
  where nc.company_id=p_company_id
    and nc.publication_status='published'
    and private.lr4_contact_privacy_ready(
      nc.privacy_classification,
      nc.privacy_legal_basis,
      nc.lia_status,
      nc.art14_status,
      nc.privacy_review_expires_at
    );

  return jsonb_set(v_profile,'{contacts}',v_contacts,true);
end;
$function$;

revoke all on function private.lr4_public_company_profile_impl(uuid)
from public,anon;
grant execute on function private.lr4_public_company_profile_impl(uuid)
to authenticated,service_role;

-- Preserve the PA1.3 paid-Network entitlement assertion while swapping in
-- LR4-safe privileged projections.
create or replace function public.p3_7c_public_company_profile(p_company_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
begin
  perform private.pa1_3_require_current_network_access();
  return private.lr4_public_company_profile_impl(p_company_id);
end;
$function$;

create or replace function public.p3_7d_public_identity_contacts(p_network_company_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
begin
  perform private.pa1_3_require_current_network_access();
  return private.p3_7d_public_identity_contacts_impl(p_network_company_id);
end;
$function$;

create or replace function public.lr4_company_directory_policy()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select jsonb_build_object(
    'contract','LR4-company-directory-claim-governance-v1',
    'network_public',false,
    'public_lookup_personal_data',false,
    'network_contacts_default','fail_closed_pending_review',
    'personal_contact_basis','art6_1_f_legitimate_interest_after_lia',
    'art14_notice_version','2026-10-04-lr4-v1',
    'art14_timing_rule','one_month_or_first_communication_or_first_disclosure_whichever_is_earlier',
    'review_validity_months',12,
    'claim_rules',jsonb_build_array(
      'ownership_proof_required_before_claim_approval',
      'claim_does_not_equal_network_verification',
      'claim_does_not_authorize_personal_contact_publication',
      'company_managed_contact_changes_return_to_privacy_review'
    ),
    'source_rules',jsonb_build_array(
      'pa1_5_source_terms_and_database_rights_gate_remains_required',
      'company_data_preferred',
      'person_linked_data_requires_per_record_privacy_review',
      'art14_exception_must_be_documented_not_assumed',
      'commercial_memory_never_feeds_directory_data'
    )
  );
$function$;

revoke all on function public.lr4_company_directory_policy() from public;
grant execute on function public.lr4_company_directory_policy()
  to anon,authenticated,service_role;

comment on table public.network_art14_notice_log is
  'LR4 immutable evidence for Article 14 delivery or documented Article 14(5) exception decisions. No notice exemption is inferred automatically.';
comment on function public.lr4_review_contact_privacy(uuid,text,text,timestamptz,text,boolean) is
  'LR4 root-only classification/LIA gate. Company channels may be approved without GDPR personal-data basis; personal contacts require a passed legitimate-interest assessment and remain pending until Article 14 readiness.';
comment on function public.lr4_record_art14_notice(uuid,text,timestamptz,text,text,text,boolean) is
  'LR4 root-only Article 14 evidence ledger. Late delivery is recorded as delivered_late and remains non-publishable.';
comment on function public.lr4_company_directory_policy() is
  'Machine-readable LR4 directory/claim privacy contract. The Network remains private/paid; public lookup contains company identity only.';
