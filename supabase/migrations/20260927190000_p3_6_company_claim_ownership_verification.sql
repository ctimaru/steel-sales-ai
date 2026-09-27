alter table public.network_company_claims
  add column proof_method text not null default 'manual_review',
  add column proof_status text not null default 'pending',
  add column proof_reference text null,
  add column proof_review_note text null,
  add column proof_verified_by uuid null references auth.users(id) on delete restrict,
  add column proof_verified_at timestamptz null;

alter table public.network_company_claims
  add constraint network_company_claims_proof_method_check
    check (proof_method in ('authenticated_corporate_email','manual_review','registration_bridge')),
  add constraint network_company_claims_proof_status_check
    check (proof_status in ('pending','verified','rejected')),
  add constraint network_company_claims_proof_text_check
    check (
      (proof_reference is null or char_length(proof_reference) <= 500)
      and (proof_review_note is null or char_length(proof_review_note) <= 2000)
    ),
  add constraint network_company_claims_proof_integrity_check
    check (
      (proof_status='pending' and proof_verified_by is null and proof_verified_at is null)
      or (proof_status in ('verified','rejected') and proof_verified_by is not null and proof_verified_at is not null)
    );

update public.network_company_claims
set proof_method='registration_bridge',
    proof_status='verified',
    proof_reference='legacy_approved_claim',
    proof_review_note='Backfilled by P3.6 from an already approved claim.',
    proof_verified_by=reviewed_by,
    proof_verified_at=reviewed_at
where status='approved';

alter table public.organization_network_company_links
  alter column application_id drop not null,
  add column claim_id uuid null references public.network_company_claims(id) on delete restrict;

alter table public.organization_network_company_links
  add constraint organization_network_company_links_origin_check
    check (
      (application_id is not null and claim_id is null)
      or (application_id is null and claim_id is not null)
    );

create unique index organization_network_company_links_claim_unique
  on public.organization_network_company_links(claim_id)
  where claim_id is not null;

create or replace function private.p3_6_claim_proof_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  if new.status='approved' and new.proof_status<>'verified' then
    if tg_op='INSERT'
       and new.request_note='Created by M7 registration bridge'
       and new.reviewed_by is not null
       and new.reviewed_at is not null then
      new.proof_method:='registration_bridge';
      new.proof_status:='verified';
      new.proof_reference:='registration_bridge';
      new.proof_review_note:='Ownership accepted through the controlled registration bridge.';
      new.proof_verified_by:=new.reviewed_by;
      new.proof_verified_at:=new.reviewed_at;
    else
      raise exception 'approved company claim requires verified ownership proof'
        using errcode='23514';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.p3_6_claim_proof_guard() from public,anon,authenticated;

create trigger network_company_claims_proof_guard
before insert or update of status,proof_status on public.network_company_claims
for each row execute function private.p3_6_claim_proof_guard();

create or replace function private.p3_6_request_company_claim_impl(
  p_network_company_id uuid,
  p_organization_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_claim_id uuid;
  v_note text;
  v_company public.network_companies%rowtype;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_email_domain text;
  v_company_domain text;
  v_proof_method text:='manual_review';
  v_proof_status text:='pending';
  v_proof_reference text;
  v_proof_verified_by uuid;
  v_proof_verified_at timestamptz;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not exists(
    select 1
    from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user_id
      and om.status='active'
      and om.role='admin'
  ) then
    raise exception 'active organization admin membership required' using errcode='42501';
  end if;

  select * into v_company
  from public.network_companies
  where id=p_network_company_id
  for update;

  if not found or v_company.publication_status<>'published' then
    raise exception 'only published Network companies can be claimed' using errcode='P0002';
  end if;

  if exists(
    select 1
    from public.network_company_claims c
    where c.network_company_id=p_network_company_id
      and c.status='approved'
  ) or v_company.claimed_status='claimed' then
    raise exception 'network company is already claimed' using errcode='23505';
  end if;

  if exists(
    select 1
    from public.network_company_claims c
    where c.network_company_id=p_network_company_id
      and c.organization_id=p_organization_id
      and c.status in ('requested','under_review','approved')
  ) then
    raise exception 'an active claim already exists for this organization and company'
      using errcode='23505';
  end if;

  if exists(
    select 1
    from public.organization_network_company_links l
    where l.organization_id=p_organization_id
      and l.network_company_id<>p_network_company_id
      and l.link_status='active'
  ) then
    raise exception 'organization already controls another Network company'
      using errcode='23505';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'claim note exceeds 2000 characters' using errcode='22023';
  end if;

  select u.email,u.email_confirmed_at
  into v_email,v_email_confirmed_at
  from auth.users u
  where u.id=v_user_id;

  v_email_domain:=lower(nullif(btrim(split_part(coalesce(v_email,''),'@',2)),''));
  v_company_domain:=lower(nullif(regexp_replace(coalesce(v_company.website_domain,''),'^www[.]','','i'),''));

  if v_email_confirmed_at is not null
     and v_email_domain is not null
     and v_company_domain is not null
     and (
       v_email_domain=v_company_domain
       or v_email_domain like '%.'||v_company_domain
     ) then
    v_proof_method:='authenticated_corporate_email';
    v_proof_status:='verified';
    v_proof_reference:='email_domain:'||v_email_domain;
    v_proof_verified_by:=v_user_id;
    v_proof_verified_at:=now();
  end if;

  insert into public.network_company_claims(
    network_company_id,organization_id,requested_by,status,request_note,
    proof_method,proof_status,proof_reference,proof_verified_by,proof_verified_at
  )
  values(
    p_network_company_id,p_organization_id,v_user_id,'requested',v_note,
    v_proof_method,v_proof_status,v_proof_reference,v_proof_verified_by,v_proof_verified_at
  )
  returning id into v_claim_id;

  update public.network_companies
  set claimed_status='pending'
  where id=p_network_company_id
    and claimed_status in ('unclaimed','revoked');

  return jsonb_build_object(
    'claim_id',v_claim_id,
    'network_company_id',p_network_company_id,
    'organization_id',p_organization_id,
    'status','requested',
    'proof_method',v_proof_method,
    'proof_status',v_proof_status,
    'automatic_ownership_proof',(v_proof_status='verified')
  );
end;
$function$;

revoke all on function private.p3_6_request_company_claim_impl(uuid,uuid,text) from public,anon;
grant execute on function private.p3_6_request_company_claim_impl(uuid,uuid,text) to authenticated,service_role;

create or replace function public.p3_6_request_company_claim(
  p_network_company_id uuid,
  p_organization_id uuid,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_6_request_company_claim_impl(
    p_network_company_id,p_organization_id,p_note
  );
$function$;

revoke all on function public.p3_6_request_company_claim(uuid,uuid,text) from public,anon;
grant execute on function public.p3_6_request_company_claim(uuid,uuid,text) to authenticated,service_role;

create or replace function private.m4_request_company_claim_impl(
  p_network_company_id uuid,
  p_organization_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
begin
  v_result:=private.p3_6_request_company_claim_impl(
    p_network_company_id,p_organization_id,p_note
  );
  return (v_result->>'claim_id')::uuid;
end;
$function$;

create or replace function private.p3_6_review_claim_proof_impl(
  p_claim_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_claim public.network_company_claims%rowtype;
  v_note text;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  if p_decision not in ('verified','rejected') then
    raise exception 'invalid ownership proof decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'proof review note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_claim
  from public.network_company_claims
  where id=p_claim_id
  for update;

  if not found then
    raise exception 'claim not found' using errcode='P0002';
  end if;

  if v_claim.status not in ('requested','under_review') then
    raise exception 'ownership proof can only be reviewed for an active claim'
      using errcode='22023';
  end if;

  if v_claim.proof_status='verified' and p_decision='verified' then
    return jsonb_build_object(
      'claim_id',v_claim.id,
      'proof_status',v_claim.proof_status,
      'proof_method',v_claim.proof_method,
      'idempotent_replay',true
    );
  end if;

  update public.network_company_claims
  set proof_method=case
        when proof_method='authenticated_corporate_email' and proof_status='verified'
          then proof_method
        else 'manual_review'
      end,
      proof_status=p_decision,
      proof_reference=case
        when proof_reference is not null then proof_reference
        else 'manual_superadmin_review'
      end,
      proof_review_note=v_note,
      proof_verified_by=v_user_id,
      proof_verified_at=now()
  where id=p_claim_id
  returning * into v_claim;

  return jsonb_build_object(
    'claim_id',v_claim.id,
    'proof_status',v_claim.proof_status,
    'proof_method',v_claim.proof_method,
    'proof_verified_by',v_claim.proof_verified_by,
    'proof_verified_at',v_claim.proof_verified_at
  );
end;
$function$;

revoke all on function private.p3_6_review_claim_proof_impl(uuid,text,text) from public,anon;
grant execute on function private.p3_6_review_claim_proof_impl(uuid,text,text) to authenticated,service_role;

create or replace function public.p3_6_review_claim_proof(
  p_claim_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.p3_6_review_claim_proof_impl(p_claim_id,p_decision,p_note);
$function$;

revoke all on function public.p3_6_review_claim_proof(uuid,text,text) from public,anon;
grant execute on function public.p3_6_review_claim_proof(uuid,text,text) to authenticated,service_role;

create or replace function private.m4_review_company_claim_impl(
  p_claim_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_claim public.network_company_claims%rowtype;
  v_note text;
  v_link_id uuid;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;

  if p_decision not in ('under_review','approved','rejected','revoked') then
    raise exception 'invalid claim decision' using errcode='22023';
  end if;

  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'review note exceeds 2000 characters' using errcode='22023';
  end if;

  select * into v_claim
  from public.network_company_claims
  where id=p_claim_id
  for update;

  if not found then
    raise exception 'claim not found' using errcode='P0002';
  end if;

  if p_decision='under_review' and v_claim.status<>'requested' then
    raise exception 'under_review requires requested claim' using errcode='22023';
  elsif p_decision in ('approved','rejected')
        and v_claim.status not in ('requested','under_review') then
    raise exception '% requires requested or under_review claim',p_decision
      using errcode='22023';
  elsif p_decision='revoked' and v_claim.status<>'approved' then
    raise exception 'revoked requires approved claim' using errcode='22023';
  end if;

  if p_decision='approved' and v_claim.proof_status<>'verified' then
    raise exception 'verified ownership proof required before claim approval'
      using errcode='23514';
  end if;

  if p_decision='approved' and exists(
    select 1 from public.network_company_claims c
    where c.network_company_id=v_claim.network_company_id
      and c.status='approved' and c.id<>v_claim.id
  ) then
    raise exception 'another approved claim already exists for this company'
      using errcode='23505';
  end if;

  if p_decision='approved' and exists(
    select 1 from public.organization_network_company_links l
    where l.network_company_id=v_claim.network_company_id
      and l.organization_id<>v_claim.organization_id
      and l.link_status='active'
  ) then
    raise exception 'network company already controlled by another organization'
      using errcode='23505';
  end if;

  if p_decision='approved' and exists(
    select 1 from public.organization_network_company_links l
    where l.organization_id=v_claim.organization_id
      and l.network_company_id<>v_claim.network_company_id
      and l.link_status='active'
  ) then
    raise exception 'organization already controls another Network company'
      using errcode='23505';
  end if;

  update public.network_company_claims
  set status=p_decision,reviewed_by=v_user_id,reviewed_at=now(),
      review_note=v_note,revoked_at=case when p_decision='revoked' then now() else null end
  where id=p_claim_id
  returning * into v_claim;

  if p_decision='approved' then
    select l.id into v_link_id
    from public.organization_network_company_links l
    where l.organization_id=v_claim.organization_id
      and l.network_company_id=v_claim.network_company_id
    order by (l.link_status='active') desc,l.created_at
    limit 1
    for update;

    if v_link_id is null then
      insert into public.organization_network_company_links(
        organization_id,network_company_id,application_id,claim_id,link_status,linked_by
      )
      values(v_claim.organization_id,v_claim.network_company_id,null,v_claim.id,'active',v_user_id)
      returning id into v_link_id;
    else
      update public.organization_network_company_links
      set link_status='active',linked_by=v_user_id,linked_at=now()
      where id=v_link_id;
    end if;

    update public.network_companies set claimed_status='claimed'
    where id=v_claim.network_company_id;
  elsif p_decision='revoked' then
    update public.organization_network_company_links
    set link_status='revoked'
    where organization_id=v_claim.organization_id
      and network_company_id=v_claim.network_company_id
      and link_status='active';

    update public.network_companies set claimed_status='revoked'
    where id=v_claim.network_company_id;
  elsif p_decision='rejected' and not exists(
    select 1 from public.network_company_claims c
    where c.network_company_id=v_claim.network_company_id
      and c.id<>v_claim.id
      and c.status in ('requested','under_review','approved')
  ) then
    update public.network_companies set claimed_status='unclaimed'
    where id=v_claim.network_company_id;
  end if;

  return jsonb_build_object(
    'claim_id',v_claim.id,'network_company_id',v_claim.network_company_id,
    'organization_id',v_claim.organization_id,'status',v_claim.status,
    'proof_status',v_claim.proof_status,'proof_method',v_claim.proof_method,
    'link_id',v_link_id,'reviewed_by',v_claim.reviewed_by,'reviewed_at',v_claim.reviewed_at,
    'verification_status',(select c.verification_status from public.network_companies c where c.id=v_claim.network_company_id)
  );
end;
$function$;

create or replace function private.p3_6_my_company_claim_impl(
  p_network_company_id uuid,p_organization_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare v_user_id uuid;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(
    select 1 from public.organization_memberships om
    where om.organization_id=p_organization_id and om.user_id=v_user_id
      and om.status='active' and om.role='admin'
  ) then raise exception 'active organization admin membership required' using errcode='42501'; end if;

  return (
    select to_jsonb(q)
    from (
      select c.id as claim_id,c.network_company_id,c.organization_id,c.status,
             c.proof_method,c.proof_status,c.proof_reference,c.proof_review_note,
             c.requested_at,c.reviewed_at,c.review_note
      from public.network_company_claims c
      where c.network_company_id=p_network_company_id
        and c.organization_id=p_organization_id
      order by c.created_at desc limit 1
    ) q
  );
end;
$function$;

revoke all on function private.p3_6_my_company_claim_impl(uuid,uuid) from public,anon;
grant execute on function private.p3_6_my_company_claim_impl(uuid,uuid) to authenticated,service_role;

create or replace function public.p3_6_my_company_claim(
  p_network_company_id uuid,p_organization_id uuid
)
returns jsonb language sql stable security invoker set search_path=''
as $function$
  select private.p3_6_my_company_claim_impl(p_network_company_id,p_organization_id);
$function$;

revoke all on function public.p3_6_my_company_claim(uuid,uuid) from public,anon;
grant execute on function public.p3_6_my_company_claim(uuid,uuid) to authenticated,service_role;

create or replace function private.p3_6_admin_claim_queue_impl(
  p_status text default null,p_limit integer default 100
)
returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare v_user_id uuid; v_limit integer;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required' using errcode='42501';
  end if;
  if p_status is not null and p_status not in ('requested','under_review','approved','rejected','revoked') then
    raise exception 'invalid claim status' using errcode='22023';
  end if;
  v_limit:=least(greatest(coalesce(p_limit,100),1),250);

  return jsonb_build_object(
    'items',(
      select coalesce(jsonb_agg(to_jsonb(q) order by q.requested_at desc),'[]'::jsonb)
      from (
        select cl.id as claim_id,cl.status,cl.proof_method,cl.proof_status,
               cl.proof_reference,cl.proof_review_note,cl.request_note,cl.requested_at,
               cl.reviewed_at,cl.review_note,cl.network_company_id,
               nc.legal_name as company_legal_name,nc.website_domain,nc.claimed_status,
               nc.verification_status,cl.organization_id,o.name as organization_name
        from public.network_company_claims cl
        join public.network_companies nc on nc.id=cl.network_company_id
        join public.organizations o on o.id=cl.organization_id
        where p_status is null or cl.status=p_status
        order by cl.requested_at desc limit v_limit
      ) q
    ),
    'total',(select count(*) from public.network_company_claims cl where p_status is null or cl.status=p_status),
    'proof_pending',(select count(*) from public.network_company_claims cl where (p_status is null or cl.status=p_status) and cl.proof_status='pending'),
    'proof_verified',(select count(*) from public.network_company_claims cl where (p_status is null or cl.status=p_status) and cl.proof_status='verified')
  );
end;
$function$;

revoke all on function private.p3_6_admin_claim_queue_impl(text,integer) from public,anon;
grant execute on function private.p3_6_admin_claim_queue_impl(text,integer) to authenticated,service_role;

create or replace function public.p3_6_admin_claim_queue(
  p_status text default null,p_limit integer default 100
)
returns jsonb language sql stable security invoker set search_path=''
as $function$
  select private.p3_6_admin_claim_queue_impl(p_status,p_limit);
$function$;

revoke all on function public.p3_6_admin_claim_queue(text,integer) from public,anon;
grant execute on function public.p3_6_admin_claim_queue(text,integer) to authenticated,service_role;

comment on function public.p3_6_request_company_claim(uuid,uuid,text) is
  'P3.6 claim request with ownership proof capture. Confirmed corporate-email-domain proof may be verified automatically; claim approval remains Superadmin-controlled and separate from Network verification.';
comment on function public.p3_6_review_claim_proof(uuid,text,text) is
  'P3.6 Superadmin ownership-proof review. This verifies claim ownership evidence only and never changes Network verification_status.';
comment on column public.network_company_claims.proof_status is
  'P3.6 ownership proof state for claim control rights. Separate from network_companies.verification_status.';
comment on column public.organization_network_company_links.claim_id is
  'P3.6 direct-claim origin. Exactly one of application_id or claim_id identifies how an Organization↔Network Company control link was established.';
