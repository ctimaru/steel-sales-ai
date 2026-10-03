-- PA1.4 — Claim Conversion & Registration Handoff.
--
-- Connects the public minimal company lookup to the governed registration bridge
-- without opening the premium Network. The public surface receives only an
-- opaque claim reference; authenticated applicants can bind that reference to
-- their draft registration, while final identity selection / activation remains
-- controlled by Platform registration operations.

alter table public.company_registration_applications
  add column if not exists claim_target_network_company_id uuid
    references public.network_companies(id) on delete restrict,
  add column if not exists claim_handoff_started_at timestamptz;

create index if not exists company_registration_applications_claim_target_idx
  on public.company_registration_applications(claim_target_network_company_id)
  where claim_target_network_company_id is not null;

comment on column public.company_registration_applications.claim_target_network_company_id is
  'PA1.4 applicant-selected existing Network identity from the public claim handoff. This is intent, not an approved/activated Network link.';
comment on column public.company_registration_applications.claim_handoff_started_at is
  'Timestamp when the authenticated applicant bound a public claim handoff to this registration application.';

create or replace function private.pa1_4_claim_ref(p_network_company_id uuid)
returns text
language sql
immutable
strict
set search_path=''
as $function$
  select encode(
    extensions.digest(
      convert_to(p_network_company_id::text || ':smart-steel-sales:pa1.4:claim', 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$function$;

revoke all on function private.pa1_4_claim_ref(uuid) from public,anon,authenticated;

create or replace function public_lookup_private.pa1_2_company_lookup_impl(
  p_query text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_raw text := btrim(coalesce(p_query,''));
  v_identifier text;
  v_name_key text;
  v_digit_count integer;
  v_is_identifier boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_mode text := 'name';
begin
  if char_length(v_raw)<3 or char_length(v_raw)>120 then
    return jsonb_build_object(
      'ok',false,
      'code','invalid_query',
      'mode',null,
      'items','[]'::jsonb
    );
  end if;

  v_identifier:=private.hp4_normalize_identifier(v_raw);
  v_name_key:=private.hp4_company_name_key(v_raw);
  v_digit_count:=char_length(
    regexp_replace(coalesce(v_identifier,''),'[^0-9]','','g')
  );

  v_is_identifier:=
    v_identifier is not null
    and char_length(v_identifier) between 8 and 18
    and v_digit_count>=8;

  if v_is_identifier then
    v_mode:='vat';

    select
      coalesce(jsonb_agg(to_jsonb(q) order by q.legal_name),'[]'::jsonb),
      count(*)
    into v_items,v_count
    from (
      select
        c.legal_name,
        c.trading_name,
        c.country_code,
        case
          when private.hp4_normalize_identifier(c.vat_id) is null then null
          else '••••'||right(private.hp4_normalize_identifier(c.vat_id),4)
        end as vat_hint,
        case
          when c.claimed_status='claimed'
               or exists(
                 select 1
                 from public.network_company_claims cl
                 where cl.network_company_id=c.id
                   and cl.status='approved'
               )
            then 'claimed'
          when c.claimed_status='pending'
               or exists(
                 select 1
                 from public.network_company_claims cl
                 where cl.network_company_id=c.id
                   and cl.status in ('requested','under_review')
               )
            then 'claim_in_progress'
          else 'claimable'
        end as claim_state,
        private.pa1_4_claim_ref(c.id) as claim_ref
      from public.network_companies c
      where c.publication_status='published'
        and c.archived_at is null
        and c.vat_id is not null
        and (
          private.hp4_normalize_identifier(c.vat_id)=v_identifier
          or upper(c.country_code)
             ||private.hp4_normalize_identifier(c.vat_id)=v_identifier
          or (
            char_length(v_identifier)>2
            and left(v_identifier,2)=upper(c.country_code)
            and private.hp4_normalize_identifier(c.vat_id)=substr(v_identifier,3)
          )
        )
      order by c.legal_name,c.id
      limit 1
    ) q;
  else
    v_mode:='name';

    if v_name_key is null or char_length(v_name_key)<3 then
      return jsonb_build_object(
        'ok',false,
        'code','invalid_query',
        'mode','name',
        'items','[]'::jsonb
      );
    end if;

    select
      coalesce(
        jsonb_agg(
          to_jsonb(q)-'sort_exact'-'sort_prefix'-'sort_len'
          order by q.sort_exact desc,q.sort_prefix desc,q.sort_len,q.legal_name
        ),
        '[]'::jsonb
      ),
      count(*)
    into v_items,v_count
    from (
      select
        c.legal_name,
        c.trading_name,
        c.country_code,
        case
          when private.hp4_normalize_identifier(c.vat_id) is null then null
          else '••••'||right(private.hp4_normalize_identifier(c.vat_id),4)
        end as vat_hint,
        case
          when c.claimed_status='claimed'
               or exists(
                 select 1
                 from public.network_company_claims cl
                 where cl.network_company_id=c.id
                   and cl.status='approved'
               )
            then 'claimed'
          when c.claimed_status='pending'
               or exists(
                 select 1
                 from public.network_company_claims cl
                 where cl.network_company_id=c.id
                   and cl.status in ('requested','under_review')
               )
            then 'claim_in_progress'
          else 'claimable'
        end as claim_state,
        private.pa1_4_claim_ref(c.id) as claim_ref,
        (private.hp4_company_name_key(c.legal_name)=v_name_key) as sort_exact,
        (
          private.hp4_company_name_key(c.legal_name) like v_name_key||'%'
          or private.hp4_company_name_key(c.trading_name) like v_name_key||'%'
        ) as sort_prefix,
        char_length(c.legal_name) as sort_len
      from public.network_companies c
      where c.publication_status='published'
        and c.archived_at is null
        and (
          private.hp4_company_name_key(c.legal_name) like '%'||v_name_key||'%'
          or private.hp4_company_name_key(c.trading_name) like '%'||v_name_key||'%'
        )
      order by sort_exact desc,sort_prefix desc,sort_len,c.legal_name,c.id
      limit 5
    ) q;
  end if;

  return jsonb_build_object(
    'ok',true,
    'code',case when v_count=0 then 'not_found' else 'ok' end,
    'mode',v_mode,
    'items',v_items
  );
end;
$function$;

create or replace function private.pa1_4_company_claim_context_impl(
  p_claim_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_company public.network_companies%rowtype;
  v_claim_state text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if coalesce(p_claim_ref,'') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok',false,'code','invalid_claim_ref');
  end if;

  select *
  into v_company
  from public.network_companies c
  where c.publication_status='published'
    and c.archived_at is null
    and private.pa1_4_claim_ref(c.id)=lower(p_claim_ref)
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'code','claim_target_not_found');
  end if;

  v_claim_state := case
    when v_company.claimed_status='claimed'
         or exists(
           select 1
           from public.network_company_claims cl
           where cl.network_company_id=v_company.id
             and cl.status='approved'
         )
      then 'claimed'
    when v_company.claimed_status='pending'
         or exists(
           select 1
           from public.network_company_claims cl
           where cl.network_company_id=v_company.id
             and cl.status in ('requested','under_review')
         )
      then 'claim_in_progress'
    else 'claimable'
  end;

  return jsonb_build_object(
    'ok',true,
    'code','ok',
    'claim_ref',private.pa1_4_claim_ref(v_company.id),
    'legal_name',v_company.legal_name,
    'trading_name',v_company.trading_name,
    'country_code',v_company.country_code,
    'vat_hint',case
      when private.hp4_normalize_identifier(v_company.vat_id) is null then null
      else '••••'||right(private.hp4_normalize_identifier(v_company.vat_id),4)
    end,
    'claim_state',v_claim_state,
    'can_start_registration',(v_claim_state='claimable'),
    'network_access_included',false
  );
end;
$function$;

revoke all on function private.pa1_4_company_claim_context_impl(text)
  from public,anon;
grant execute on function private.pa1_4_company_claim_context_impl(text)
  to authenticated,service_role;

create or replace function public.pa1_4_company_claim_context(
  p_claim_ref text
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_4_company_claim_context_impl(p_claim_ref);
$function$;

revoke all on function public.pa1_4_company_claim_context(text)
  from public,anon;
grant execute on function public.pa1_4_company_claim_context(text)
  to authenticated,service_role;

create or replace function private.pa1_4_bind_registration_claim_impl(
  p_application_id uuid,
  p_claim_ref text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_app public.company_registration_applications%rowtype;
  v_company public.network_companies%rowtype;
  v_claim_state text;
  v_idempotent boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if coalesce(p_claim_ref,'') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid claim reference' using errcode='22023';
  end if;

  select *
  into v_app
  from public.company_registration_applications
  where id=p_application_id
    and applicant_user_id=v_user_id
  for update;

  if not found then
    raise exception 'registration application not found' using errcode='P0002';
  end if;

  if v_app.application_status not in ('draft','needs_information') then
    raise exception 'claim handoff can only bind an editable registration'
      using errcode='22023';
  end if;

  select *
  into v_company
  from public.network_companies c
  where c.publication_status='published'
    and c.archived_at is null
    and private.pa1_4_claim_ref(c.id)=lower(p_claim_ref)
  limit 1;

  if not found then
    raise exception 'claim target not found' using errcode='P0002';
  end if;

  v_claim_state := case
    when v_company.claimed_status='claimed'
         or exists(
           select 1 from public.network_company_claims cl
           where cl.network_company_id=v_company.id
             and cl.status='approved'
         )
      then 'claimed'
    when v_company.claimed_status='pending'
         or exists(
           select 1 from public.network_company_claims cl
           where cl.network_company_id=v_company.id
             and cl.status in ('requested','under_review')
         )
      then 'claim_in_progress'
    else 'claimable'
  end;

  if v_claim_state<>'claimable' then
    raise exception 'claim target is no longer available'
      using errcode='23505';
  end if;

  if upper(v_app.country_code)<>upper(v_company.country_code)
     or private.hp4_company_name_key(v_app.legal_name)
        is distinct from private.hp4_company_name_key(v_company.legal_name) then
    raise exception 'registration identity does not match claim target'
      using errcode='23514';
  end if;

  if v_app.claim_target_network_company_id is not null
     and v_app.claim_target_network_company_id<>v_company.id then
    raise exception 'registration is already bound to another claim target'
      using errcode='23505';
  end if;

  v_idempotent := v_app.claim_target_network_company_id=v_company.id;

  update public.company_registration_applications
  set
    claim_target_network_company_id=v_company.id,
    claim_handoff_started_at=coalesce(claim_handoff_started_at,now())
  where id=v_app.id;

  return jsonb_build_object(
    'ok',true,
    'application_id',v_app.id,
    'claim_ref',private.pa1_4_claim_ref(v_company.id),
    'claim_state','claimable',
    'legal_name',v_company.legal_name,
    'country_code',v_company.country_code,
    'idempotent_replay',v_idempotent,
    'network_access_included',false
  );
end;
$function$;

revoke all on function private.pa1_4_bind_registration_claim_impl(uuid,text)
  from public,anon;
grant execute on function private.pa1_4_bind_registration_claim_impl(uuid,text)
  to authenticated,service_role;

create or replace function public.pa1_4_bind_registration_claim(
  p_application_id uuid,
  p_claim_ref text
)
returns jsonb
language sql
security invoker
set search_path=''
as $function$
  select private.pa1_4_bind_registration_claim_impl(
    p_application_id,
    p_claim_ref
  );
$function$;

revoke all on function public.pa1_4_bind_registration_claim(uuid,text)
  from public,anon;
grant execute on function public.pa1_4_bind_registration_claim(uuid,text)
  to authenticated,service_role;

create or replace function private.pa1_4_registration_claim_context_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_app public.company_registration_applications%rowtype;
  v_company public.network_companies%rowtype;
  v_claim_state text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select *
  into v_app
  from public.company_registration_applications
  where id=p_application_id
    and applicant_user_id=v_user_id;

  if not found then
    raise exception 'registration application not found' using errcode='P0002';
  end if;

  if v_app.claim_target_network_company_id is null then
    return jsonb_build_object('ok',true,'code','no_claim_target');
  end if;

  select *
  into v_company
  from public.network_companies
  where id=v_app.claim_target_network_company_id
    and publication_status<>'archived';

  if not found then
    return jsonb_build_object('ok',false,'code','claim_target_not_found');
  end if;

  v_claim_state := case
    when v_company.claimed_status='claimed'
         or exists(
           select 1
           from public.network_company_claims cl
           where cl.network_company_id=v_company.id
             and cl.status='approved'
         )
      then 'claimed'
    when v_company.claimed_status='pending'
         or exists(
           select 1
           from public.network_company_claims cl
           where cl.network_company_id=v_company.id
             and cl.status in ('requested','under_review')
         )
      then 'claim_in_progress'
    else 'claimable'
  end;

  return jsonb_build_object(
    'ok',true,
    'code','ok',
    'claim_ref',private.pa1_4_claim_ref(v_company.id),
    'legal_name',v_company.legal_name,
    'trading_name',v_company.trading_name,
    'country_code',v_company.country_code,
    'vat_hint',case
      when private.hp4_normalize_identifier(v_company.vat_id) is null then null
      else '••••'||right(private.hp4_normalize_identifier(v_company.vat_id),4)
    end,
    'claim_state',v_claim_state,
    'can_start_registration',(
      v_claim_state='claimable'
      and v_app.application_status in ('draft','needs_information')
    ),
    'application_status',v_app.application_status,
    'network_access_included',false
  );
end;
$function$;

revoke all on function private.pa1_4_registration_claim_context_impl(uuid)
  from public,anon;
grant execute on function private.pa1_4_registration_claim_context_impl(uuid)
  to authenticated,service_role;

create or replace function public.pa1_4_registration_claim_context(
  p_application_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.pa1_4_registration_claim_context_impl(p_application_id);
$function$;

revoke all on function public.pa1_4_registration_claim_context(uuid)
  from public,anon;
grant execute on function public.pa1_4_registration_claim_context(uuid)
  to authenticated,service_role;

create or replace function private.pa1_4_guard_registration_identity_targets()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if current_user in ('postgres','service_role','supabase_admin') then
    return new;
  end if;

  if tg_op='INSERT' then
    if new.claim_target_network_company_id is not null
       or new.matched_network_company_id is not null then
      raise exception 'registration identity targets must be set through governed RPCs'
        using errcode='42501';
    end if;
    return new;
  end if;

  if new.claim_target_network_company_id
       is distinct from old.claim_target_network_company_id
     or new.matched_network_company_id
       is distinct from old.matched_network_company_id then
    raise exception 'registration identity targets must be set through governed RPCs'
      using errcode='42501';
  end if;

  return new;
end;
$function$;

revoke all on function private.pa1_4_guard_registration_identity_targets()
  from public,anon,authenticated;

drop trigger if exists pa1_4_guard_registration_identity_targets
  on public.company_registration_applications;

create trigger pa1_4_guard_registration_identity_targets
before insert or update of claim_target_network_company_id,matched_network_company_id
on public.company_registration_applications
for each row
execute function private.pa1_4_guard_registration_identity_targets();

comment on function public.pa1_4_company_claim_context(text) is
  'PA1.4 authenticated resolver for an opaque public claim reference. Returns only minimal identity / claim availability and never grants paid Network access.';
comment on function public.pa1_4_bind_registration_claim(uuid,text) is
  'PA1.4 binds an available public claim target to the applicant own editable registration. Final Network link and claim remain governed by registration activation.';
comment on function public.pa1_4_registration_claim_context(uuid) is
  'PA1.4 restores the minimal claim context already bound to the authenticated applicant registration without exposing premium Network data.';


-- Preserve PA1.4 claim intent when an eligible rejected application is
-- re-opened through the existing HP12 recovery path. The target is still only
-- intent: the registration page revalidates availability and Platform must
-- explicitly select the identity during activation.
create or replace function private.hp12_reapply_registration_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_email_confirmed_at timestamptz;
  v_source public.company_registration_applications%rowtype;
  v_existing public.company_registration_applications%rowtype;
  v_new_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select u.email_confirmed_at
  into v_email_confirmed_at
  from auth.users u
  where u.id=v_user_id;

  if v_email_confirmed_at is null then
    raise exception 'email verification required before reapplication'
      using errcode='42501';
  end if;

  select *
  into v_source
  from public.company_registration_applications a
  where a.id=p_application_id
    and a.applicant_user_id=v_user_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode='P0002';
  end if;

  if v_source.application_status<>'rejected' then
    raise exception 'only rejected applications can start reapplication'
      using errcode='22023';
  end if;

  if v_source.rejection_reason_code not in (
    'incomplete_information',
    'unverifiable_identity'
  ) then
    raise exception 'registration reapplication requires platform support'
      using errcode='22023';
  end if;

  select *
  into v_existing
  from public.company_registration_applications a
  where a.applicant_user_id=v_user_id
    and a.application_status in (
      'draft',
      'pending_review',
      'needs_information',
      'approved'
    )
  order by a.created_at desc,a.id
  limit 1;

  if found then
    return jsonb_build_object(
      'contract','HP12-registration-reapply-v1',
      'application_id',v_existing.id,
      'status',v_existing.application_status,
      'idempotent_replay',true
    );
  end if;

  insert into public.company_registration_applications(
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
    short_description,
    claim_target_network_company_id,
    claim_handoff_started_at
  )
  values(
    v_source.legal_name,
    v_source.trading_name,
    v_source.country_code,
    v_source.vat_id,
    v_source.registration_id,
    v_source.website_url,
    v_source.primary_company_type,
    v_source.secondary_company_types,
    v_source.contact_name,
    v_source.contact_phone,
    v_source.short_description,
    v_source.claim_target_network_company_id,
    v_source.claim_handoff_started_at
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'contract','HP12-registration-reapply-v1',
    'application_id',v_new_id,
    'status','draft',
    'source_application_id',v_source.id,
    'claim_target_preserved',(v_source.claim_target_network_company_id is not null),
    'idempotent_replay',false
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.company_registration_applications a
    where a.applicant_user_id=v_user_id
      and a.application_status in (
        'draft',
        'pending_review',
        'needs_information',
        'approved'
      )
    order by a.created_at desc,a.id
    limit 1;

    if found then
      return jsonb_build_object(
        'contract','HP12-registration-reapply-v1',
        'application_id',v_existing.id,
        'status',v_existing.application_status,
        'idempotent_replay',true
      );
    end if;

    raise;
end;
$function$;

comment on function private.hp12_reapply_registration_impl(uuid) is
  'HP12 recovery path with PA1.4 claim-target continuity. Reapplication preserves applicant claim intent but never creates a Network link or entitlement.';
