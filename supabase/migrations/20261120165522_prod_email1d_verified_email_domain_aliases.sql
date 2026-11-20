create table if not exists private.netcontact1_verified_email_domains (
  company_id uuid not null references public.network_companies(id) on delete cascade,
  email_domain text not null,
  source_reference text not null,
  source_assertion_id uuid not null references public.network_data_assertions(id) on delete restrict,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  updated_at timestamptz not null default now(),
  primary key (company_id,email_domain),
  constraint netcontact1_verified_email_domains_domain_check
    check (email_domain = lower(btrim(email_domain))
      and email_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'
      and email_domain not like 'www.%'),
  constraint netcontact1_verified_email_domains_source_check
    check (source_reference ~ '^https://' and char_length(source_reference) <= 2000),
  constraint netcontact1_verified_email_domains_reason_check
    check (revoked_reason is null or char_length(revoked_reason) <= 1000)
);

alter table private.netcontact1_verified_email_domains enable row level security;
revoke all on table private.netcontact1_verified_email_domains from public, anon, authenticated;
grant select,insert,update,delete on table private.netcontact1_verified_email_domains to service_role;

create or replace function private.netcontact1_alias_domain_is_active(
  p_company_id uuid,
  p_email text
)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select exists (
    select 1
    from private.netcontact1_verified_email_domains d
    where d.company_id=p_company_id
      and d.revoked_at is null
      and d.email_domain=split_part(lower(btrim(coalesce(p_email,''))),'@',2)
  );
$function$;

create or replace function private.netcontact1_verify_email_domain_alias(
  p_company_id uuid,
  p_email_domain text,
  p_source_url text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_company public.network_companies%rowtype;
  v_domain text:=lower(regexp_replace(btrim(coalesce(p_email_domain,'')),'^www\.',''));
  v_source text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_host text;
  v_assertion uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'verified email-domain alias is service-only' using errcode='42501';
  end if;

  select * into v_company
  from public.network_companies
  where id=p_company_id and publication_status='published' and archived_at is null;
  if not found then raise exception 'Published company not found' using errcode='P0002'; end if;

  if v_domain is null or v_domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'Invalid email domain' using errcode='22023';
  end if;

  if v_domain = any(array[
    'gmail.com','googlemail.com','yahoo.com','yahoo.it','hotmail.com','hotmail.it',
    'outlook.com','outlook.it','live.com','live.it','libero.it','virgilio.it',
    'tin.it','alice.it','tiscali.it','icloud.com','me.com','msn.com',
    'protonmail.com','proton.me','pec.it','legalmail.it','arubapec.it',
    'registerpec.it','pec-mail.it','postecert.it','certificatapec.it'
  ]) then
    raise exception 'Free-mail/PEC provider cannot be a corporate alias' using errcode='22023';
  end if;

  if private.netcontact1_domain_matches('x@'||v_domain,v_company.website_domain) then
    raise exception 'Alias is already covered by canonical domain matching' using errcode='22023';
  end if;

  if v_source is null or v_source !~ '^https://' or length(v_source)>2000 then
    raise exception 'Canonical https source URL required' using errcode='22023';
  end if;

  v_host:=split_part(regexp_replace(lower(v_source),'^https://',''),'/',1);
  if v_host not in (
       lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')),
       'www.'||lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.',''))
     )
     and v_host not like '%.'||lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')) then
    raise exception 'Alias evidence must be on the canonical company website' using errcode='22023';
  end if;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
    ownership_type,confidence,review_state
  )
  values(
    'company',p_company_id,'netcontact1_verified_email_domain_alias',
    jsonb_build_object('email_domain',v_domain),
    'public_web',v_source,'platform_verified',0.98,'accepted'
  )
  returning id into v_assertion;

  insert into private.netcontact1_verified_email_domains(
    company_id,email_domain,source_reference,source_assertion_id,
    verified_at,revoked_at,revoked_reason,updated_at
  )
  values(p_company_id,v_domain,v_source,v_assertion,now(),null,null,now())
  on conflict(company_id,email_domain) do update
  set source_reference=excluded.source_reference,
      source_assertion_id=excluded.source_assertion_id,
      verified_at=now(),
      revoked_at=null,
      revoked_reason=null,
      updated_at=now();

  return jsonb_build_object(
    'contract','prod-email1d-alias-v1',
    'status','verified',
    'company_id',p_company_id,
    'email_domain',v_domain,
    'assertion_id',v_assertion
  );
end;
$function$;

create or replace function private.netcontact1_revoke_email_domain_alias(
  p_company_id uuid,
  p_email_domain text,
  p_reason text default null
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_domain text:=lower(regexp_replace(btrim(coalesce(p_email_domain,'')),'^www\.',''));
  v_count integer:=0;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'verified email-domain alias revocation is service-only' using errcode='42501';
  end if;

  update private.netcontact1_verified_email_domains d
  set revoked_at=now(),
      revoked_reason=nullif(btrim(coalesce(p_reason,'')),''),
      updated_at=now()
  where d.company_id=p_company_id
    and d.email_domain=v_domain
    and d.revoked_at is null;

  if not found then
    return jsonb_build_object('contract','prod-email1d-alias-v1','status','not_active');
  end if;

  update public.network_data_assertions a
  set review_state='superseded'
  where a.id=(
    select d.source_assertion_id
    from private.netcontact1_verified_email_domains d
    where d.company_id=p_company_id and d.email_domain=v_domain
  ) and a.review_state='accepted';

  update public.network_contacts nc
  set publication_status='pending_review',
      privacy_review_expires_at=least(coalesce(nc.privacy_review_expires_at,now()),now())
  where nc.company_id=p_company_id
    and nc.archived_at is null
    and nc.publication_status='published'
    and split_part(lower(btrim(coalesce(nc.email,''))),'@',2)=v_domain
    and exists(
      select 1 from public.network_data_assertions a
      where a.id=nc.source_assertion_id
        and a.field_path='netcontact1_public_company_channel_alias'
    );
  get diagnostics v_count = row_count;

  return jsonb_build_object(
    'contract','prod-email1d-alias-v1',
    'status','revoked',
    'company_id',p_company_id,
    'email_domain',v_domain,
    'contacts_unpublished',v_count
  );
end;
$function$;

create or replace function private.netcontact1_stage_verified_alias_channel(
  p_company_id uuid,
  p_email text,
  p_source_url text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_company public.network_companies%rowtype;
  v_email text:=nullif(lower(btrim(coalesce(p_email,''))),'');
  v_source text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_host text;
  v_assertion uuid;
  v_contact uuid;
  v_type text;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'verified alias staging is service-only' using errcode='42501';
  end if;

  select * into v_company
  from public.network_companies
  where id=p_company_id and publication_status='published' and archived_at is null;
  if not found then raise exception 'Published company not found' using errcode='P0002'; end if;

  if v_email is null
     or length(v_email)>254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
     or not private.netcontact1_generic_local_part(split_part(v_email,'@',1))
     or not private.netcontact1_alias_domain_is_active(p_company_id,v_email) then
    return jsonb_build_object('contract','prod-email1d-stage-v1','status','rejected_channel');
  end if;

  if v_source is null or v_source !~ '^https://' or length(v_source)>2000 then
    raise exception 'Canonical https source URL required' using errcode='22023';
  end if;
  v_host:=split_part(regexp_replace(lower(v_source),'^https://',''),'/',1);
  if v_host not in (
       lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')),
       'www.'||lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.',''))
     )
     and v_host not like '%.'||lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')) then
    raise exception 'Source must be on the canonical company website' using errcode='22023';
  end if;

  if exists(
    select 1 from public.network_contacts nc
    where nc.company_id=p_company_id
      and nc.archived_at is null
      and lower(btrim(coalesce(nc.email,'')))=v_email
  ) then
    return jsonb_build_object('contract','prod-email1d-stage-v1','status','existing');
  end if;

  v_type:=case when split_part(v_email,'@',1) ~
    '^(commerciale|commerciali|vendite|vendita|sales|ufficio\.?commerciale|ufficiocommerciale|ordini|orders|offerte|preventivi|quotes|export)'
    then 'sales' else 'general' end;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
    ownership_type,confidence,review_state
  )
  values(
    'company',p_company_id,'netcontact1_public_company_channel_alias',
    jsonb_build_object('email',v_email,'alias_domain',split_part(v_email,'@',2)),
    'public_web',v_source,'platform_verified',0.95,'pending'
  )
  returning id into v_assertion;

  insert into public.network_contacts(
    company_id,contact_type,display_name,email,publication_status,
    source_reference,source_assertion_id,source_obtained_at
  )
  values(
    p_company_id,v_type,
    case v_type when 'sales' then 'Ufficio commerciale' else 'Contatti aziendali' end,
    v_email,'pending_review',v_source,v_assertion,now()
  )
  returning id into v_contact;

  return jsonb_build_object(
    'contract','prod-email1d-stage-v1',
    'status','staged',
    'contact_id',v_contact,
    'email_staged',true
  );
end;
$function$;

create or replace function private.netcontact1_auto_review_verified_alias_channels(
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
  v_eligible_total integer:=0;
  v_selected integer:=0;
  v_published integer:=0;
  v_rec record;
  v_before jsonb;
  v_after public.network_contacts%rowtype;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'verified alias review is service-only' using errcode='42501';
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
    and a.field_path='netcontact1_public_company_channel_alias'
    and a.source_type='public_web'
    and a.source_reference=nc.source_reference
    and a.ownership_type='platform_verified'
    and a.review_state='pending'
    and coalesce(a.confidence,0)>=0.95
    and nc.source_reference ~ '^https://'
    and nc.source_obtained_at is not null
    and private.netcontact1_alias_domain_is_active(nc.company_id,nc.email)
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
    and not exists(
      select 1 from public.network_contacts x
      where x.company_id=nc.company_id and x.id<>nc.id
        and x.archived_at is null and x.publication_status='published'
        and lower(btrim(coalesce(x.email,'')))=lower(btrim(nc.email))
    );

  v_selected:=least(v_eligible_total,v_limit);

  if not p_apply then
    return jsonb_build_object(
      'contract','prod-email1d-auto-review-v1','mode','dry_run',
      'country_code',v_country,'eligible_total',v_eligible_total,
      'selected',v_selected,'published',0
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
      and a.field_path='netcontact1_public_company_channel_alias'
      and a.source_type='public_web'
      and a.source_reference=nc.source_reference
      and a.ownership_type='platform_verified'
      and a.review_state='pending'
      and coalesce(a.confidence,0)>=0.95
      and nc.source_reference ~ '^https://'
      and nc.source_obtained_at is not null
      and private.netcontact1_alias_domain_is_active(nc.company_id,nc.email)
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
      and not exists(
        select 1 from public.network_contacts x
        where x.company_id=nc.company_id and x.id<>nc.id
          and x.archived_at is null and x.publication_status='published'
          and lower(btrim(coalesce(x.email,'')))=lower(btrim(nc.email))
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
    from public.network_contacts nc where nc.id=v_rec.id;

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
        privacy_review_note='PROD-EMAIL1.D automated review: generic corporate mailbox on verified first-party email-domain alias',
        privacy_review_actor_type='system',
        publication_status='published'
    where id=v_rec.id and publication_status='pending_review' and privacy_reviewed_at is null
    returning * into v_after;

    if found then
      update public.network_data_assertions
      set review_state='accepted'
      where id=v_after.source_assertion_id and review_state='pending';

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
        'PROD-EMAIL1.D system review: verified per-company corporate email-domain alias'
      );
      v_published:=v_published+1;
    end if;
  end loop;

  return jsonb_build_object(
    'contract','prod-email1d-auto-review-v1','mode','apply',
    'country_code',v_country,'eligible_total',v_eligible_total,
    'selected',v_selected,'published',v_published
  );
end;
$function$;

revoke execute on function private.netcontact1_alias_domain_is_active(uuid,text) from public,anon,authenticated;
revoke execute on function private.netcontact1_verify_email_domain_alias(uuid,text,text) from public,anon,authenticated;
revoke execute on function private.netcontact1_revoke_email_domain_alias(uuid,text,text) from public,anon,authenticated;
revoke execute on function private.netcontact1_stage_verified_alias_channel(uuid,text,text) from public,anon,authenticated;
revoke execute on function private.netcontact1_auto_review_verified_alias_channels(integer,text,boolean) from public,anon,authenticated;

grant execute on function private.netcontact1_alias_domain_is_active(uuid,text) to service_role;
grant execute on function private.netcontact1_verify_email_domain_alias(uuid,text,text) to service_role;
grant execute on function private.netcontact1_revoke_email_domain_alias(uuid,text,text) to service_role;
grant execute on function private.netcontact1_stage_verified_alias_channel(uuid,text,text) to service_role;
grant execute on function private.netcontact1_auto_review_verified_alias_channels(integer,text,boolean) to service_role;
