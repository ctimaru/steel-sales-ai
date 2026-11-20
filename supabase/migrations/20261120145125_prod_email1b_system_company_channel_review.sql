-- PROD-EMAIL1.B — automated, audited governance for strict first-party company mailboxes.
--
-- Goal:
--   promote only generic corporate mailboxes observed on the official company
--   website from NET-CONTACT1 pending_review to LR4-ready published channels,
--   without impersonating a human reviewer.
--
-- Personal/named contacts remain on the existing human LR4 path.

alter table public.network_contacts
  add column privacy_review_actor_type text;

update public.network_contacts
set privacy_review_actor_type = 'platform'
where privacy_reviewed_at is not null
  and privacy_reviewed_by is not null
  and privacy_review_actor_type is null;

alter table public.network_contacts
  add constraint network_contacts_lr4_review_actor_type_check
  check (
    privacy_review_actor_type is null
    or privacy_review_actor_type = any (array['platform'::text,'system'::text])
  );

alter table public.network_contacts
  drop constraint network_contacts_lr4_review_timing_check;

alter table public.network_contacts
  add constraint network_contacts_lr4_review_timing_check
  check (
    (
      privacy_reviewed_at is null
      and privacy_reviewed_by is null
      and privacy_review_expires_at is null
      and privacy_review_actor_type is null
    )
    or
    (
      privacy_reviewed_at is not null
      and privacy_review_expires_at is not null
      and privacy_review_expires_at > privacy_reviewed_at
      and (
        (
          privacy_review_actor_type = 'platform'
          and privacy_reviewed_by is not null
        )
        or
        (
          privacy_review_actor_type = 'system'
          and privacy_reviewed_by is null
        )
      )
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
set search_path = ''
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
    'privacy_review_expires_at',v_contact.privacy_review_expires_at,
    'privacy_review_actor_type',v_contact.privacy_review_actor_type
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
        privacy_review_actor_type='platform',
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
        privacy_review_expires_at=now()+interval '12 months',
        privacy_review_note=v_note,
        privacy_review_actor_type='platform',
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
      'privacy_review_expires_at',v_contact.privacy_review_expires_at,
      'privacy_review_actor_type',v_contact.privacy_review_actor_type
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
    'privacy_review_actor_type',v_contact.privacy_review_actor_type,
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

create or replace function private.netcontact1_auto_review_company_channels(
  p_limit integer default 100,
  p_country_code text default null,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_country text := nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_eligible_total integer := 0;
  v_selected integer := 0;
  v_published integer := 0;
  v_rec record;
  v_before jsonb;
  v_after public.network_contacts%rowtype;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'system company-channel review is service-only'
      using errcode='42501';
  end if;

  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'country code must be ISO alpha-2' using errcode='22023';
  end if;

  select count(*)::int into v_eligible_total
  from public.network_contacts nc
  join public.network_companies c on c.id=nc.company_id
  join public.network_data_assertions a on a.id=nc.source_assertion_id
  where nc.publication_status='pending_review'
    and nc.archived_at is null
    and c.publication_status='published'
    and c.archived_at is null
    and (v_country is null or c.country_code=v_country)
    and nc.email is not null
    and nullif(btrim(nc.email),'') is not null
    and nc.privacy_classification='unreviewed'
    and nc.privacy_legal_basis='not_assessed'
    and nc.lia_status='not_assessed'
    and nc.art14_status='not_assessed'
    and nc.privacy_reviewed_at is null
    and nc.privacy_reviewed_by is null
    and nc.privacy_review_expires_at is null
    and nc.privacy_review_actor_type is null
    and a.entity_type='company'
    and a.entity_id=nc.company_id
    and a.field_path='netcontact1_public_company_channel'
    and a.source_type='public_web'
    and a.source_reference=nc.source_reference
    and a.ownership_type='platform_curated'
    and a.review_state='pending'
    and coalesce(a.confidence,0)>=0.9
    and nc.source_reference ~ '^https://'
    and nc.source_obtained_at is not null
    and private.netcontact1_domain_matches(nc.email,c.website_domain)
    and split_part(lower(btrim(nc.email)),'@',1) ~
      '^(sales|commerciale|commerciali|vendite|vendita|ufficio[._-]?commerciale|ufficiocommerciale|ordini|orders|offerte|preventivi|quotes|export|info|informazioni|contatti|contact|contacts|office|mail|hello)([._-]?[a-z]{2})?([._-]?[0-9]{1,2})?$'
    and (
      split_part(regexp_replace(lower(nc.source_reference),'^https://',''),'/',1)
        in (
          lower(regexp_replace(coalesce(c.website_domain,''),'^www\.','')),
          'www.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
        )
      or split_part(regexp_replace(lower(nc.source_reference),'^https://',''),'/',1)
        like '%.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
    )
    and not exists (
      select 1
      from public.network_contacts x
      where x.company_id=nc.company_id
        and x.id<>nc.id
        and x.archived_at is null
        and x.publication_status='published'
        and x.email is not null
        and lower(btrim(x.email))=lower(btrim(nc.email))
    );

  v_selected := least(v_eligible_total,v_limit);

  if not p_apply then
    return jsonb_build_object(
      'contract','prod-email1b-auto-review-v1',
      'mode','dry_run',
      'country_code',v_country,
      'eligible_total',v_eligible_total,
      'selected',v_selected,
      'published',0
    );
  end if;

  for v_rec in
    select nc.id
    from public.network_contacts nc
    join public.network_companies c on c.id=nc.company_id
    join public.network_data_assertions a on a.id=nc.source_assertion_id
    where nc.publication_status='pending_review'
      and nc.archived_at is null
      and c.publication_status='published'
      and c.archived_at is null
      and (v_country is null or c.country_code=v_country)
      and nc.email is not null
      and nullif(btrim(nc.email),'') is not null
      and nc.privacy_classification='unreviewed'
      and nc.privacy_legal_basis='not_assessed'
      and nc.lia_status='not_assessed'
      and nc.art14_status='not_assessed'
      and nc.privacy_reviewed_at is null
      and nc.privacy_reviewed_by is null
      and nc.privacy_review_expires_at is null
      and nc.privacy_review_actor_type is null
      and a.entity_type='company'
      and a.entity_id=nc.company_id
      and a.field_path='netcontact1_public_company_channel'
      and a.source_type='public_web'
      and a.source_reference=nc.source_reference
      and a.ownership_type='platform_curated'
      and a.review_state='pending'
      and coalesce(a.confidence,0)>=0.9
      and nc.source_reference ~ '^https://'
      and nc.source_obtained_at is not null
      and private.netcontact1_domain_matches(nc.email,c.website_domain)
      and split_part(lower(btrim(nc.email)),'@',1) ~
        '^(sales|commerciale|commerciali|vendite|vendita|ufficio[._-]?commerciale|ufficiocommerciale|ordini|orders|offerte|preventivi|quotes|export|info|informazioni|contatti|contact|contacts|office|mail|hello)([._-]?[a-z]{2})?([._-]?[0-9]{1,2})?$'
      and (
        split_part(regexp_replace(lower(nc.source_reference),'^https://',''),'/',1)
          in (
            lower(regexp_replace(coalesce(c.website_domain,''),'^www\.','')),
            'www.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
          )
        or split_part(regexp_replace(lower(nc.source_reference),'^https://',''),'/',1)
          like '%.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
      )
      and not exists (
        select 1
        from public.network_contacts x
        where x.company_id=nc.company_id
          and x.id<>nc.id
          and x.archived_at is null
          and x.publication_status='published'
          and x.email is not null
          and lower(btrim(x.email))=lower(btrim(nc.email))
      )
    order by nc.source_obtained_at,nc.id
    limit v_limit
    for update of nc skip locked
  loop
    select jsonb_build_object(
      'publication_status',nc.publication_status,
      'privacy_classification',nc.privacy_classification,
      'privacy_legal_basis',nc.privacy_legal_basis,
      'lia_status',nc.lia_status,
      'art14_status',nc.art14_status,
      'privacy_review_expires_at',nc.privacy_review_expires_at,
      'privacy_review_actor_type',nc.privacy_review_actor_type
    )
    into v_before
    from public.network_contacts nc
    where nc.id=v_rec.id;

    update public.network_contacts
    set privacy_classification='company_channel',
        privacy_legal_basis='not_applicable_company_data',
        lia_status='not_required',
        art14_status='not_required',
        art14_due_at=null,
        art14_delivered_at=null,
        art14_notice_version=null,
        art14_notice_channel=null,
        art14_exception_reason=null,
        privacy_reviewed_by=null,
        privacy_reviewed_at=now(),
        privacy_review_expires_at=now()+interval '12 months',
        privacy_review_note='PROD-EMAIL1.B automated review: generic corporate mailbox observed on official company website',
        privacy_review_actor_type='system',
        publication_status='published'
    where id=v_rec.id
      and publication_status='pending_review'
      and privacy_reviewed_at is null
    returning * into v_after;

    if found then
      insert into public.network_data_governance_events(
        subject_type,subject_id,action,actor_user_id,actor_type,
        before_state,after_state,note
      )
      values(
        'network_contact',v_rec.id,'contact_privacy_reviewed',
        null,'system',v_before,
        jsonb_build_object(
          'publication_status',v_after.publication_status,
          'privacy_classification',v_after.privacy_classification,
          'privacy_legal_basis',v_after.privacy_legal_basis,
          'lia_status',v_after.lia_status,
          'art14_status',v_after.art14_status,
          'source_obtained_at',v_after.source_obtained_at,
          'privacy_review_expires_at',v_after.privacy_review_expires_at,
          'privacy_review_actor_type',v_after.privacy_review_actor_type
        ),
        'PROD-EMAIL1.B system review: strict first-party generic company channel'
      );
      v_published := v_published + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'contract','prod-email1b-auto-review-v1',
    'mode','apply',
    'country_code',v_country,
    'eligible_total',v_eligible_total,
    'selected',v_selected,
    'published',v_published
  );
end;
$function$;

revoke all on function private.netcontact1_auto_review_company_channels(integer,text,boolean)
  from public, anon, authenticated;
grant execute on function private.netcontact1_auto_review_company_channels(integer,text,boolean)
  to service_role;

comment on function private.netcontact1_auto_review_company_channels(integer,text,boolean)
is 'PROD-EMAIL1.B: service-only audited system review for strict generic corporate first-party email channels. Personal contacts remain on LR4 human governance.';
