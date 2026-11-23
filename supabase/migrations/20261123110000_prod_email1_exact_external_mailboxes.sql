-- PROD-EMAIL1.K — exact public producer mailboxes across corporate, group and external domains.
-- Exact-address evidence remains service-only and traceable. External evidence never trusts the whole domain.

create table if not exists private.netcontact1_verified_company_mailboxes (
  company_id uuid not null
    references public.network_companies(id) on delete cascade,
  email text not null,
  source_reference text not null,
  source_assertion_id uuid not null
    references public.network_data_assertions(id),
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  updated_at timestamptz not null default now(),
  primary key(company_id,email)
);

alter table private.netcontact1_verified_company_mailboxes enable row level security;

revoke all on table private.netcontact1_verified_company_mailboxes
from public,anon,authenticated;
grant select,insert,update on table private.netcontact1_verified_company_mailboxes
to service_role;

create or replace function private.netcontact1_verify_company_mailbox(
  p_company_id uuid,
  p_email text,
  p_source_url text
)
returns jsonb
language plpgsql
set search_path=''
as $function$
declare
  v_company public.network_companies%rowtype;
  v_email text:=nullif(lower(btrim(coalesce(p_email,''))),'');
  v_source text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_source_host text;
  v_company_domain text;
  v_mailbox_domain text;
  v_evidence_scope text;
  v_confidence numeric;
  v_assertion uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'verified company mailbox is service-only' using errcode='42501';
  end if;

  select * into v_company
  from public.network_companies
  where id=p_company_id and publication_status='published' and archived_at is null;
  if not found then
    raise exception 'Published company not found' using errcode='P0002';
  end if;

  if v_email is null or length(v_email)>254
     or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'Invalid exact mailbox' using errcode='22023';
  end if;

  if v_source is null or v_source !~ '^https://' or length(v_source)>2000 then
    raise exception 'Public https evidence URL required' using errcode='22023';
  end if;

  v_source_host:=lower(split_part(split_part(regexp_replace(v_source,'^https://','','i'),'/',1),':',1));
  if v_source_host='' or v_source_host='localhost'
     or v_source_host !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then
    raise exception 'Public evidence host required' using errcode='22023';
  end if;

  v_company_domain:=lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.',''));
  v_mailbox_domain:=split_part(v_email,'@',2);

  if v_source_host in (
       v_company_domain,
       'www.'||v_company_domain,
       v_mailbox_domain,
       'www.'||v_mailbox_domain
     )
     or v_source_host like '%.'||v_company_domain
     or v_source_host like '%.'||v_mailbox_domain then
    v_evidence_scope:='first_party_exact';
    v_confidence:=0.99;
  else
    v_evidence_scope:='third_party_exact';
    v_confidence:=0.94;
  end if;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
    ownership_type,confidence,review_state
  ) values (
    'company',p_company_id,'netcontact1_verified_company_mailbox',
    jsonb_build_object(
      'email',v_email,
      'evidence_scope',v_evidence_scope,
      'source_host',v_source_host,
      'mailbox_domain',v_mailbox_domain
    ),
    'public_web',v_source,'platform_verified',v_confidence,'accepted'
  )
  returning id into v_assertion;

  insert into private.netcontact1_verified_company_mailboxes(
    company_id,email,source_reference,source_assertion_id,
    verified_at,revoked_at,revoked_reason,updated_at
  ) values (
    p_company_id,v_email,v_source,v_assertion,now(),null,null,now()
  )
  on conflict(company_id,email) do update
  set source_reference=excluded.source_reference,
      source_assertion_id=excluded.source_assertion_id,
      verified_at=now(),
      revoked_at=null,
      revoked_reason=null,
      updated_at=now();

  return jsonb_build_object(
    'contract','prod-email1j-verify-v1',
    'status','verified',
    'company_id',p_company_id,
    'email',v_email,
    'evidence_scope',v_evidence_scope,
    'confidence',v_confidence,
    'assertion_id',v_assertion
  );
end;
$function$;

create or replace function private.netcontact1_stage_verified_company_mailbox(
  p_company_id uuid,
  p_email text
)
returns jsonb
language plpgsql
set search_path=''
as $function$
declare
  v_email text:=nullif(lower(btrim(coalesce(p_email,''))),'');
  v_row private.netcontact1_verified_company_mailboxes%rowtype;
  v_assertion uuid;
  v_contact uuid;
  v_existing_status text;
  v_confidence numeric;
  v_evidence_scope text;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'verified company mailbox staging is service-only' using errcode='42501';
  end if;

  select * into v_row
  from private.netcontact1_verified_company_mailboxes
  where company_id=p_company_id and email=v_email and revoked_at is null;
  if not found then
    return jsonb_build_object('contract','prod-email1k-stage-v1','status','not_verified');
  end if;

  select coalesce(a.confidence,0.94),
         coalesce(a.asserted_value->>'evidence_scope','legacy_exact')
  into v_confidence,v_evidence_scope
  from public.network_data_assertions a
  where a.id=v_row.source_assertion_id;

  v_confidence:=greatest(0.94,least(coalesce(v_confidence,0.94),0.99));

  select nc.id,nc.publication_status
  into v_contact,v_existing_status
  from public.network_contacts nc
  where nc.company_id=p_company_id and nc.archived_at is null
    and lower(btrim(coalesce(nc.email,'')))=v_email
  order by case nc.publication_status when 'published' then 0 else 1 end,nc.created_at
  limit 1;

  if v_existing_status='published' then
    return jsonb_build_object('contract','prod-email1k-stage-v1','status','existing_published');
  end if;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
    ownership_type,confidence,review_state
  ) values (
    'company',p_company_id,'netcontact1_public_company_channel_exact',
    jsonb_build_object(
      'email',v_email,
      'verification_assertion_id',v_row.source_assertion_id,
      'evidence_scope',v_evidence_scope
    ),
    'public_web',v_row.source_reference,'platform_verified',v_confidence,'pending'
  )
  returning id into v_assertion;

  if v_contact is not null then
    update public.network_contacts
    set source_reference=v_row.source_reference,
        source_assertion_id=v_assertion,
        source_obtained_at=now()
    where id=v_contact and publication_status='pending_review';

    return jsonb_build_object(
      'contract','prod-email1k-stage-v1','status','restaged_exact',
      'contact_id',v_contact,'email',v_email,
      'evidence_scope',v_evidence_scope,'confidence',v_confidence
    );
  end if;

  insert into public.network_contacts(
    company_id,contact_type,display_name,email,publication_status,
    source_reference,source_assertion_id,source_obtained_at
  ) values (
    p_company_id,'general','Contatti aziendali',v_email,'pending_review',
    v_row.source_reference,v_assertion,now()
  )
  returning id into v_contact;

  return jsonb_build_object(
    'contract','prod-email1k-stage-v1','status','staged',
    'contact_id',v_contact,'email',v_email,
    'evidence_scope',v_evidence_scope,'confidence',v_confidence
  );
end;
$function$;

create or replace function private.netcontact1_auto_review_verified_company_mailboxes(
  p_limit integer default 100,
  p_country_code text default null,
  p_apply boolean default false
)
returns jsonb
language plpgsql
set search_path=''
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
    raise exception 'verified company mailbox review is service-only' using errcode='42501';
  end if;

  select count(*)::int into v_eligible
  from public.network_contacts nc
  join public.network_companies c on c.id=nc.company_id
  join public.network_data_assertions a on a.id=nc.source_assertion_id
  join private.netcontact1_verified_company_mailboxes v
    on v.company_id=nc.company_id
   and v.email=lower(btrim(nc.email))
   and v.revoked_at is null
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
    and a.field_path='netcontact1_public_company_channel_exact'
    and a.source_type='public_web'
    and a.source_reference=nc.source_reference
    and a.ownership_type='platform_verified'
    and coalesce(a.confidence,0)>=0.94
    and a.asserted_value->>'verification_assertion_id'=v.source_assertion_id::text
    and v.source_reference=nc.source_reference;

  if not p_apply then
    return jsonb_build_object(
      'contract','prod-email1k-auto-review-v1','mode','dry_run',
      'country_code',v_country,'eligible_total',v_eligible,
      'selected',least(v_eligible,v_limit),'published',0
    );
  end if;

  for v_rec in
    select nc.id
    from public.network_contacts nc
    join public.network_companies c on c.id=nc.company_id
    join public.network_data_assertions a on a.id=nc.source_assertion_id
    join private.netcontact1_verified_company_mailboxes v
      on v.company_id=nc.company_id
     and v.email=lower(btrim(nc.email))
     and v.revoked_at is null
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
      and a.field_path='netcontact1_public_company_channel_exact'
      and a.source_type='public_web'
      and a.source_reference=nc.source_reference
      and a.ownership_type='platform_verified'
      and coalesce(a.confidence,0)>=0.94
      and a.asserted_value->>'verification_assertion_id'=v.source_assertion_id::text
      and v.source_reference=nc.source_reference
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
    )
    into v_before
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
        privacy_review_note='PROD-EMAIL1.K automated review: exact public company mailbox with traceable evidence',
        privacy_review_actor_type='system',
        publication_status='published'
    where id=v_rec.id
      and publication_status='pending_review'
      and privacy_reviewed_at is null
    returning * into v_after;

    if found then
      insert into public.network_data_governance_events(
        subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note
      ) values (
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
        'PROD-EMAIL1.K system review: exact public company mailbox with traceable evidence'
      );
      v_published:=v_published+1;
    end if;
  end loop;

  return jsonb_build_object(
    'contract','prod-email1k-auto-review-v1','mode','apply',
    'country_code',v_country,'eligible_total',v_eligible,
    'selected',least(v_eligible,v_limit),'published',v_published
  );
end;
$function$;

revoke execute on function private.netcontact1_verify_company_mailbox(uuid,text,text)
from public,anon,authenticated;
revoke execute on function private.netcontact1_stage_verified_company_mailbox(uuid,text)
from public,anon,authenticated;
revoke execute on function private.netcontact1_auto_review_verified_company_mailboxes(integer,text,boolean)
from public,anon,authenticated;

grant execute on function private.netcontact1_verify_company_mailbox(uuid,text,text)
to service_role;
grant execute on function private.netcontact1_stage_verified_company_mailbox(uuid,text)
to service_role;
grant execute on function private.netcontact1_auto_review_verified_company_mailboxes(integer,text,boolean)
to service_role;

comment on function private.netcontact1_verify_company_mailbox(uuid,text,text) is
'Service-only verification of one exact public company mailbox. First-party and exact mailbox-domain evidence score 0.99; external public evidence is limited to the exact address and scores 0.94.';
comment on function private.netcontact1_stage_verified_company_mailbox(uuid,text) is
'Stages one exact verified mailbox and propagates the verification evidence scope and confidence.';
comment on function private.netcontact1_auto_review_verified_company_mailboxes(integer,text,boolean) is
'Publishes exact verified public company mailboxes with traceable evidence at confidence 0.94 or higher.';

create index if not exists netcontact1_verified_company_mailboxes_source_assertion_id_idx
  on private.netcontact1_verified_company_mailboxes(source_assertion_id);
