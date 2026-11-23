-- PROD-CONTACT1 — verified first-party phone and contact-form channels.
-- Production migration version: 20261121185841

create or replace function private.netcontact1_auto_review_company_phones(
  p_limit integer default 100,
  p_country_code text default null,
  p_apply boolean default false
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_eligible integer:=0;
  v_published integer:=0;
  v_rec record;
  v_before jsonb;
  v_after public.network_contacts%rowtype;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'company phone review is service-only' using errcode='42501';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'country code must be ISO alpha-2' using errcode='22023';
  end if;

  select count(*)::int into v_eligible
  from public.network_contacts nc
  join public.network_companies c on c.id=nc.company_id
  join public.network_data_assertions a on a.id=nc.source_assertion_id
  where nc.publication_status='pending_review'
    and nc.archived_at is null
    and c.publication_status='published'
    and c.archived_at is null
    and (v_country is null or c.country_code=v_country)
    and nc.email is null
    and nc.phone is not null
    and regexp_replace(nc.phone,'[^0-9+]','','g') ~ '^\+?[0-9]{6,15}$'
    and nc.contact_type='general'
    and nc.display_name='Contatti aziendali'
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
    and (
      split_part(regexp_replace(lower(nc.source_reference),'^https://',''),'/',1)
        in (
          lower(regexp_replace(coalesce(c.website_domain,''),'^www\.','')),
          'www.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
        )
      or split_part(regexp_replace(lower(nc.source_reference),'^https://',''),'/',1)
        like '%.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
    );

  if not p_apply then
    return jsonb_build_object(
      'contract','prod-contact1-phone-review-v1','mode','dry_run',
      'country_code',v_country,'eligible_total',v_eligible,
      'selected',least(v_eligible,v_limit),'published',0
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
      and nc.email is null
      and nc.phone is not null
      and regexp_replace(nc.phone,'[^0-9+]','','g') ~ '^\+?[0-9]{6,15}$'
      and nc.contact_type='general'
      and nc.display_name='Contatti aziendali'
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
      and (
        split_part(regexp_replace(lower(nc.source_reference),'^https://',''),'/',1)
          in (
            lower(regexp_replace(coalesce(c.website_domain,''),'^www\.','')),
            'www.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
          )
        or split_part(regexp_replace(lower(nc.source_reference),'^https://',''),'/',1)
          like '%.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
      )
    order by nc.source_obtained_at,nc.id
    limit v_limit
    for update of nc skip locked
  loop
    select jsonb_build_object(
      'publication_status',publication_status,
      'privacy_classification',privacy_classification,
      'privacy_legal_basis',privacy_legal_basis,
      'lia_status',lia_status,
      'art14_status',art14_status
    ) into v_before
    from public.network_contacts where id=v_rec.id;

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
        privacy_review_note='PROD-CONTACT1 automated review: first-party company switchboard/office phone',
        privacy_review_actor_type='system',
        publication_status='published'
    where id=v_rec.id
      and publication_status='pending_review'
      and privacy_reviewed_at is null
    returning * into v_after;

    if found then
      insert into public.network_data_governance_events(
        subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
      )
      values(
        'network_contact',v_rec.id,'contact_privacy_reviewed',null,'system',v_before,
        jsonb_build_object(
          'publication_status',v_after.publication_status,
          'privacy_classification',v_after.privacy_classification,
          'privacy_legal_basis',v_after.privacy_legal_basis,
          'lia_status',v_after.lia_status,
          'art14_status',v_after.art14_status,
          'privacy_review_expires_at',v_after.privacy_review_expires_at,
          'privacy_review_actor_type',v_after.privacy_review_actor_type
        ),
        'PROD-CONTACT1 system review: first-party company switchboard/office phone'
      );
      v_published:=v_published+1;
    end if;
  end loop;

  return jsonb_build_object(
    'contract','prod-contact1-phone-review-v1','mode','apply',
    'country_code',v_country,'eligible_total',v_eligible,
    'selected',least(v_eligible,v_limit),'published',v_published
  );
end;
$function$;

create or replace function private.netcontact1_stage_company_contact_form(
  p_company_id uuid,
  p_form_url text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_company public.network_companies%rowtype;
  v_url text:=nullif(btrim(coalesce(p_form_url,'')),'');
  v_host text;
  v_assertion uuid;
  v_contact uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'company contact-form staging is service-only' using errcode='42501';
  end if;

  select * into v_company
  from public.network_companies
  where id=p_company_id
    and publication_status='published'
    and archived_at is null;
  if not found then
    raise exception 'Published company not found' using errcode='P0002';
  end if;

  if v_url is null or v_url !~ '^https://' or length(v_url)>500 then
    raise exception 'Canonical https contact-form URL required' using errcode='22023';
  end if;

  v_host:=split_part(regexp_replace(lower(v_url),'^https://',''),'/',1);
  if v_host not in (
       lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')),
       'www.'||lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.',''))
     )
     and v_host not like '%.'||lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')) then
    raise exception 'Contact form must be on the canonical company website' using errcode='22023';
  end if;

  if exists(
    select 1
    from public.network_contacts nc
    where nc.company_id=p_company_id
      and nc.archived_at is null
      and nc.publication_status in ('pending_review','published')
      and lower(btrim(coalesce(nc.website_url,'')))=lower(v_url)
  ) then
    return jsonb_build_object('contract','prod-contact1-form-stage-v1','status','existing');
  end if;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
    ownership_type,confidence,review_state
  )
  values(
    'company',p_company_id,'netcontact1_public_company_contact_form',
    jsonb_build_object('website_url',v_url),
    'public_web',v_url,'platform_verified',0.95,'pending'
  )
  returning id into v_assertion;

  insert into public.network_contacts(
    company_id,contact_type,display_name,website_url,publication_status,
    source_reference,source_assertion_id,source_obtained_at
  )
  values(
    p_company_id,'form','Modulo contatti aziendale',v_url,'pending_review',
    v_url,v_assertion,now()
  )
  returning id into v_contact;

  return jsonb_build_object(
    'contract','prod-contact1-form-stage-v1',
    'status','staged',
    'contact_id',v_contact,
    'website_url',v_url
  );
end;
$function$;

create or replace function private.netcontact1_auto_review_company_contact_forms(
  p_limit integer default 100,
  p_country_code text default null,
  p_apply boolean default false
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
  v_country text:=nullif(upper(btrim(coalesce(p_country_code,''))),'');
  v_eligible integer:=0;
  v_published integer:=0;
  v_rec record;
  v_before jsonb;
  v_after public.network_contacts%rowtype;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'company contact-form review is service-only' using errcode='42501';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'country code must be ISO alpha-2' using errcode='22023';
  end if;

  select count(*)::int into v_eligible
  from public.network_contacts nc
  join public.network_companies c on c.id=nc.company_id
  join public.network_data_assertions a on a.id=nc.source_assertion_id
  where nc.publication_status='pending_review'
    and nc.archived_at is null
    and c.publication_status='published'
    and c.archived_at is null
    and (v_country is null or c.country_code=v_country)
    and nc.email is null
    and nc.phone is null
    and nc.website_url is not null
    and nc.website_url ~ '^https://'
    and nc.contact_type='form'
    and nc.display_name='Modulo contatti aziendale'
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
    and a.field_path='netcontact1_public_company_contact_form'
    and a.source_type='public_web'
    and a.source_reference=nc.website_url
    and a.ownership_type='platform_verified'
    and a.review_state='pending'
    and coalesce(a.confidence,0)>=0.95
    and (
      split_part(regexp_replace(lower(nc.website_url),'^https://',''),'/',1)
        in (
          lower(regexp_replace(coalesce(c.website_domain,''),'^www\.','')),
          'www.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
        )
      or split_part(regexp_replace(lower(nc.website_url),'^https://',''),'/',1)
        like '%.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
    );

  if not p_apply then
    return jsonb_build_object(
      'contract','prod-contact1-form-review-v1','mode','dry_run',
      'country_code',v_country,'eligible_total',v_eligible,
      'selected',least(v_eligible,v_limit),'published',0
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
      and nc.email is null
      and nc.phone is null
      and nc.website_url is not null
      and nc.website_url ~ '^https://'
      and nc.contact_type='form'
      and nc.display_name='Modulo contatti aziendale'
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
      and a.field_path='netcontact1_public_company_contact_form'
      and a.source_type='public_web'
      and a.source_reference=nc.website_url
      and a.ownership_type='platform_verified'
      and a.review_state='pending'
      and coalesce(a.confidence,0)>=0.95
      and (
        split_part(regexp_replace(lower(nc.website_url),'^https://',''),'/',1)
          in (
            lower(regexp_replace(coalesce(c.website_domain,''),'^www\.','')),
            'www.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
          )
        or split_part(regexp_replace(lower(nc.website_url),'^https://',''),'/',1)
          like '%.'||lower(regexp_replace(coalesce(c.website_domain,''),'^www\.',''))
      )
    order by nc.source_obtained_at,nc.id
    limit v_limit
    for update of nc skip locked
  loop
    select jsonb_build_object(
      'publication_status',publication_status,
      'privacy_classification',privacy_classification,
      'privacy_legal_basis',privacy_legal_basis,
      'lia_status',lia_status,
      'art14_status',art14_status
    ) into v_before
    from public.network_contacts
    where id=v_rec.id;

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
        privacy_review_note='PROD-CONTACT1 automated review: first-party company contact form',
        privacy_review_actor_type='system',
        publication_status='published'
    where id=v_rec.id
      and publication_status='pending_review'
      and privacy_reviewed_at is null
    returning * into v_after;

    if found then
      insert into public.network_data_governance_events(
        subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
      )
      values(
        'network_contact',v_rec.id,'contact_privacy_reviewed',null,'system',v_before,
        jsonb_build_object(
          'publication_status',v_after.publication_status,
          'privacy_classification',v_after.privacy_classification,
          'privacy_legal_basis',v_after.privacy_legal_basis,
          'lia_status',v_after.lia_status,
          'art14_status',v_after.art14_status,
          'privacy_review_expires_at',v_after.privacy_review_expires_at,
          'privacy_review_actor_type',v_after.privacy_review_actor_type
        ),
        'PROD-CONTACT1 system review: first-party company contact form'
      );
      v_published:=v_published+1;
    end if;
  end loop;

  return jsonb_build_object(
    'contract','prod-contact1-form-review-v1','mode','apply',
    'country_code',v_country,'eligible_total',v_eligible,
    'selected',least(v_eligible,v_limit),'published',v_published
  );
end;
$function$;

revoke execute on function private.netcontact1_auto_review_company_phones(integer,text,boolean)
from public,anon,authenticated;
revoke execute on function private.netcontact1_stage_company_contact_form(uuid,text)
from public,anon,authenticated;
revoke execute on function private.netcontact1_auto_review_company_contact_forms(integer,text,boolean)
from public,anon,authenticated;

grant execute on function private.netcontact1_auto_review_company_phones(integer,text,boolean)
to service_role;
grant execute on function private.netcontact1_stage_company_contact_form(uuid,text)
to service_role;
grant execute on function private.netcontact1_auto_review_company_contact_forms(integer,text,boolean)
to service_role;
