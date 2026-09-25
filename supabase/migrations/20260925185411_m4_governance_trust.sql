create table public.network_data_assertions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field_path text not null,
  asserted_value jsonb not null,
  source_type text not null,
  source_reference text not null,
  ownership_type text not null,
  asserted_by uuid null references auth.users(id) on delete set null,
  captured_at timestamptz not null default now(),
  confidence numeric(5,4) null,
  review_state text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint network_data_assertions_entity_type_check check (entity_type in ('company','facility','contact','company_role_assignment','company_subtype_assignment','company_product','company_market','facility_capability','company_certification')),
  constraint network_data_assertions_field_path_check check (char_length(btrim(field_path)) between 1 and 255),
  constraint network_data_assertions_source_type_check check (source_type in ('platform_curated','company_declared','public_web','document','registration_application','manual_review','system_derived')),
  constraint network_data_assertions_source_reference_check check (char_length(btrim(source_reference)) between 1 and 2000),
  constraint network_data_assertions_ownership_type_check check (ownership_type in ('platform_curated','company_managed','platform_verified','system_derived')),
  constraint network_data_assertions_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint network_data_assertions_review_state_check check (review_state in ('pending','accepted','rejected','superseded'))
);
create index network_data_assertions_entity_idx on public.network_data_assertions (entity_type, entity_id, captured_at desc);
create index network_data_assertions_source_type_idx on public.network_data_assertions (source_type, captured_at desc);
create index network_data_assertions_asserted_by_idx on public.network_data_assertions (asserted_by) where asserted_by is not null;

create table public.network_company_claims (
  id uuid primary key default gen_random_uuid(),
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'requested',
  request_note text null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint network_company_claims_status_check check (status in ('requested','under_review','approved','rejected','revoked')),
  constraint network_company_claims_note_length_check check ((request_note is null or char_length(request_note) <= 2000) and (review_note is null or char_length(review_note) <= 2000)),
  constraint network_company_claims_review_integrity_check check (
    (status='requested' and reviewed_by is null and reviewed_at is null and revoked_at is null)
    or (status in ('under_review','approved','rejected') and reviewed_by is not null and reviewed_at is not null and revoked_at is null)
    or (status='revoked' and reviewed_by is not null and reviewed_at is not null and revoked_at is not null)
  )
);
create unique index network_company_claims_one_approved_company_uidx on public.network_company_claims (network_company_id) where status='approved';
create index network_company_claims_company_status_idx on public.network_company_claims (network_company_id, status, requested_at desc);
create index network_company_claims_org_status_idx on public.network_company_claims (organization_id, status, requested_at desc);
create index network_company_claims_requested_by_idx on public.network_company_claims (requested_by);
create index network_company_claims_reviewed_by_idx on public.network_company_claims (reviewed_by) where reviewed_by is not null;

create table public.network_verifications (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  company_id uuid null references public.network_companies(id) on delete restrict,
  facility_id uuid null references public.network_facilities(id) on delete restrict,
  facility_capability_id uuid null references public.network_facility_capabilities(id) on delete restrict,
  company_certification_id uuid null references public.network_company_certifications(id) on delete restrict,
  status text not null,
  evidence_assertion_id uuid not null references public.network_data_assertions(id) on delete restrict,
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  expires_at timestamptz null,
  note text null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  constraint network_verifications_scope_check check (scope in ('company','facility','facility_capability','company_certification')),
  constraint network_verifications_status_check check (status in ('pending','verified','rejected','expired','revoked')),
  constraint network_verifications_target_check check (
    (scope='company' and company_id is not null and facility_id is null and facility_capability_id is null and company_certification_id is null)
    or (scope='facility' and company_id is null and facility_id is not null and facility_capability_id is null and company_certification_id is null)
    or (scope='facility_capability' and company_id is null and facility_id is null and facility_capability_id is not null and company_certification_id is null)
    or (scope='company_certification' and company_id is null and facility_id is null and facility_capability_id is null and company_certification_id is not null)
  ),
  constraint network_verifications_expiry_check check (expires_at is null or expires_at > verified_at),
  constraint network_verifications_note_length_check check (note is null or char_length(note) <= 2000)
);
create unique index network_verifications_current_company_uidx on public.network_verifications (company_id) where scope='company' and is_current;
create unique index network_verifications_current_facility_uidx on public.network_verifications (facility_id) where scope='facility' and is_current;
create unique index network_verifications_current_facility_capability_uidx on public.network_verifications (facility_capability_id) where scope='facility_capability' and is_current;
create unique index network_verifications_current_company_certification_uidx on public.network_verifications (company_certification_id) where scope='company_certification' and is_current;
create index network_verifications_evidence_assertion_idx on public.network_verifications (evidence_assertion_id);
create index network_verifications_verified_by_idx on public.network_verifications (verified_by);

create table public.network_change_reviews (
  id uuid primary key default gen_random_uuid(),
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  assertion_id uuid not null references public.network_data_assertions(id) on delete restrict,
  field_path text not null,
  previous_value jsonb not null,
  proposed_value jsonb not null,
  status text not null default 'open',
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  reviewed_by uuid null references auth.users(id) on delete restrict,
  reviewed_at timestamptz null,
  review_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint network_change_reviews_status_check check (status in ('open','accepted','rejected','superseded')),
  constraint network_change_reviews_field_path_check check (char_length(btrim(field_path)) between 1 and 255),
  constraint network_change_reviews_note_length_check check (review_note is null or char_length(review_note) <= 2000),
  constraint network_change_reviews_decision_integrity_check check (
    (status='open' and reviewed_by is null and reviewed_at is null)
    or (status in ('accepted','rejected','superseded') and reviewed_by is not null and reviewed_at is not null)
  )
);
create unique index network_change_reviews_one_open_assertion_field_uidx on public.network_change_reviews (assertion_id, field_path) where status='open';
create index network_change_reviews_company_status_idx on public.network_change_reviews (network_company_id, status, opened_at desc);
create index network_change_reviews_reviewed_by_idx on public.network_change_reviews (reviewed_by) where reviewed_by is not null;

create or replace function private.m4_touch_updated_at() returns trigger language plpgsql security invoker set search_path='' as $function$
begin new.updated_at:=now(); return new; end;
$function$;
revoke all on function private.m4_touch_updated_at() from public, anon, authenticated;
create trigger network_company_claims_touch_updated_at before update on public.network_company_claims for each row execute function private.m4_touch_updated_at();
create trigger network_change_reviews_touch_updated_at before update on public.network_change_reviews for each row execute function private.m4_touch_updated_at();

create or replace function private.m4_assertion_immutable() returns trigger language plpgsql security invoker set search_path='' as $function$
begin raise exception 'network_data_assertions is append-only' using errcode='55000'; end;
$function$;
revoke all on function private.m4_assertion_immutable() from public, anon, authenticated;
create trigger network_data_assertions_immutable before update or delete on public.network_data_assertions for each row execute function private.m4_assertion_immutable();

alter table public.network_company_role_assignments add constraint network_company_role_assignments_source_assertion_fkey foreign key (source_assertion_id) references public.network_data_assertions(id) on delete restrict;
alter table public.network_company_subtype_assignments add constraint network_company_subtype_assignments_source_assertion_fkey foreign key (source_assertion_id) references public.network_data_assertions(id) on delete restrict;
alter table public.network_company_products add constraint network_company_products_source_assertion_fkey foreign key (source_assertion_id) references public.network_data_assertions(id) on delete restrict;
alter table public.network_company_markets add constraint network_company_markets_source_assertion_fkey foreign key (source_assertion_id) references public.network_data_assertions(id) on delete restrict;
alter table public.network_facility_capabilities add constraint network_facility_capabilities_source_assertion_fkey foreign key (source_assertion_id) references public.network_data_assertions(id) on delete restrict;
alter table public.network_company_certifications add constraint network_company_certifications_source_assertion_fkey foreign key (source_assertion_id) references public.network_data_assertions(id) on delete restrict;
alter table public.network_company_role_assignments alter column source_assertion_id set not null;
alter table public.network_company_subtype_assignments alter column source_assertion_id set not null;
alter table public.network_company_products alter column source_assertion_id set not null;
alter table public.network_company_markets alter column source_assertion_id set not null;
alter table public.network_facility_capabilities alter column source_assertion_id set not null;
alter table public.network_company_certifications alter column source_assertion_id set not null;

alter table public.network_data_assertions enable row level security;
alter table public.network_company_claims enable row level security;
alter table public.network_verifications enable row level security;
alter table public.network_change_reviews enable row level security;
revoke all on table public.network_data_assertions from public, anon, authenticated;
revoke all on table public.network_company_claims from public, anon, authenticated;
revoke all on table public.network_verifications from public, anon, authenticated;
revoke all on table public.network_change_reviews from public, anon, authenticated;
grant select,insert,update,delete on table public.network_data_assertions to service_role;
grant select,insert,update,delete on table public.network_company_claims to service_role;
grant select,insert,update,delete on table public.network_verifications to service_role;
grant select,insert,update,delete on table public.network_change_reviews to service_role;

create or replace function private.m4_create_data_assertion_impl(p_entity_type text,p_entity_id uuid,p_field_path text,p_asserted_value jsonb,p_source_type text,p_source_reference text,p_ownership_type text,p_confidence numeric default null,p_review_state text default 'pending')
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_user_id uuid; v_id uuid;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then raise exception 'platform superadmin required' using errcode='42501'; end if;
  insert into public.network_data_assertions(entity_type,entity_id,field_path,asserted_value,source_type,source_reference,ownership_type,asserted_by,confidence,review_state)
  values(p_entity_type,p_entity_id,btrim(p_field_path),p_asserted_value,p_source_type,btrim(p_source_reference),p_ownership_type,v_user_id,p_confidence,p_review_state)
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function private.m4_create_data_assertion_impl(text,uuid,text,jsonb,text,text,text,numeric,text) from public, anon;
grant execute on function private.m4_create_data_assertion_impl(text,uuid,text,jsonb,text,text,text,numeric,text) to authenticated, service_role;

create or replace function public.m4_create_data_assertion(p_entity_type text,p_entity_id uuid,p_field_path text,p_asserted_value jsonb,p_source_type text,p_source_reference text,p_ownership_type text,p_confidence numeric default null,p_review_state text default 'pending')
returns uuid language sql volatile security invoker set search_path='' as $function$
select private.m4_create_data_assertion_impl(p_entity_type,p_entity_id,p_field_path,p_asserted_value,p_source_type,p_source_reference,p_ownership_type,p_confidence,p_review_state);
$function$;
revoke all on function public.m4_create_data_assertion(text,uuid,text,jsonb,text,text,text,numeric,text) from public, anon;
grant execute on function public.m4_create_data_assertion(text,uuid,text,jsonb,text,text,text,numeric,text) to authenticated, service_role;

create or replace function private.m4_request_company_claim_impl(p_network_company_id uuid,p_organization_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_user_id uuid; v_claim_id uuid; v_note text;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.organization_memberships om where om.organization_id=p_organization_id and om.user_id=v_user_id and om.status='active' and om.role='admin')
    then raise exception 'active organization admin membership required' using errcode='42501'; end if;
  if not exists(select 1 from public.network_companies nc where nc.id=p_network_company_id and nc.publication_status<>'archived')
    then raise exception 'network company not found or archived' using errcode='P0002'; end if;
  if exists(select 1 from public.network_company_claims c where c.network_company_id=p_network_company_id and c.organization_id=p_organization_id and c.status in ('requested','under_review','approved'))
    then raise exception 'an active claim already exists for this organization and company' using errcode='23505'; end if;
  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then raise exception 'claim note exceeds 2000 characters' using errcode='22023'; end if;
  insert into public.network_company_claims(network_company_id,organization_id,requested_by,status,request_note)
  values(p_network_company_id,p_organization_id,v_user_id,'requested',v_note) returning id into v_claim_id;
  update public.network_companies set claimed_status='pending' where id=p_network_company_id and claimed_status in ('unclaimed','revoked');
  return v_claim_id;
end;
$function$;
revoke all on function private.m4_request_company_claim_impl(uuid,uuid,text) from public, anon;
grant execute on function private.m4_request_company_claim_impl(uuid,uuid,text) to authenticated, service_role;

create or replace function public.m4_request_company_claim(p_network_company_id uuid,p_organization_id uuid,p_note text default null)
returns uuid language sql volatile security invoker set search_path='' as $function$
select private.m4_request_company_claim_impl(p_network_company_id,p_organization_id,p_note);
$function$;
revoke all on function public.m4_request_company_claim(uuid,uuid,text) from public, anon;
grant execute on function public.m4_request_company_claim(uuid,uuid,text) to authenticated, service_role;

create or replace function private.m4_review_company_claim_impl(p_claim_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user_id uuid; v_claim public.network_company_claims%rowtype; v_note text;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then raise exception 'platform superadmin required' using errcode='42501'; end if;
  if p_decision not in ('under_review','approved','rejected','revoked') then raise exception 'invalid claim decision' using errcode='22023'; end if;
  v_note:=nullif(btrim(p_note),'');
  if v_note is not null and char_length(v_note)>2000 then raise exception 'review note exceeds 2000 characters' using errcode='22023'; end if;
  select * into v_claim from public.network_company_claims where id=p_claim_id for update;
  if not found then raise exception 'claim not found' using errcode='P0002'; end if;
  if p_decision='under_review' and v_claim.status<>'requested' then raise exception 'under_review requires requested claim' using errcode='22023';
  elsif p_decision in ('approved','rejected') and v_claim.status not in ('requested','under_review') then raise exception '% requires requested or under_review claim',p_decision using errcode='22023';
  elsif p_decision='revoked' and v_claim.status<>'approved' then raise exception 'revoked requires approved claim' using errcode='22023'; end if;
  if p_decision='approved' and exists(select 1 from public.network_company_claims c where c.network_company_id=v_claim.network_company_id and c.status='approved' and c.id<>v_claim.id)
    then raise exception 'another approved claim already exists for this company' using errcode='23505'; end if;
  update public.network_company_claims set status=p_decision,reviewed_by=v_user_id,reviewed_at=now(),review_note=v_note,revoked_at=case when p_decision='revoked' then now() else null end
  where id=p_claim_id returning * into v_claim;
  if p_decision='approved' then update public.network_companies set claimed_status='claimed' where id=v_claim.network_company_id;
  elsif p_decision='revoked' then update public.network_companies set claimed_status='revoked' where id=v_claim.network_company_id;
  elsif p_decision='rejected' and not exists(select 1 from public.network_company_claims c where c.network_company_id=v_claim.network_company_id and c.id<>v_claim.id and c.status in ('requested','under_review','approved'))
    then update public.network_companies set claimed_status='unclaimed' where id=v_claim.network_company_id; end if;
  return jsonb_build_object('claim_id',v_claim.id,'network_company_id',v_claim.network_company_id,'organization_id',v_claim.organization_id,'status',v_claim.status,'reviewed_by',v_claim.reviewed_by,'reviewed_at',v_claim.reviewed_at);
end;
$function$;
revoke all on function private.m4_review_company_claim_impl(uuid,text,text) from public, anon;
grant execute on function private.m4_review_company_claim_impl(uuid,text,text) to authenticated, service_role;

create or replace function public.m4_review_company_claim(p_claim_id uuid,p_decision text,p_note text default null)
returns jsonb language sql volatile security invoker set search_path='' as $function$
select private.m4_review_company_claim_impl(p_claim_id,p_decision,p_note);
$function$;
revoke all on function public.m4_review_company_claim(uuid,text,text) from public, anon;
grant execute on function public.m4_review_company_claim(uuid,text,text) to authenticated, service_role;

create or replace function private.m4_record_verification_impl(p_scope text,p_target_id uuid,p_status text,p_evidence_assertion_id uuid,p_expires_at timestamptz default null,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_user_id uuid; v_id uuid; v_note text; v_expected_entity_type text; v_evidence public.network_data_assertions%rowtype;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then raise exception 'platform superadmin required' using errcode='42501'; end if;
  if p_scope not in ('company','facility','facility_capability','company_certification') then raise exception 'invalid verification scope' using errcode='22023'; end if;
  if p_status not in ('pending','verified','rejected','expired','revoked') then raise exception 'invalid verification status' using errcode='22023'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'verification expiry must be in the future' using errcode='22023'; end if;
  v_note:=nullif(btrim(p_note),''); if v_note is not null and char_length(v_note)>2000 then raise exception 'verification note exceeds 2000 characters' using errcode='22023'; end if;
  select * into v_evidence from public.network_data_assertions where id=p_evidence_assertion_id;
  if not found then raise exception 'evidence assertion not found' using errcode='P0002'; end if;
  v_expected_entity_type:=case p_scope when 'company' then 'company' when 'facility' then 'facility' when 'facility_capability' then 'facility_capability' when 'company_certification' then 'company_certification' end;
  if v_evidence.entity_type<>v_expected_entity_type or v_evidence.entity_id<>p_target_id then raise exception 'evidence assertion target does not match verification target' using errcode='22023'; end if;
  if p_scope='company' then
    if not exists(select 1 from public.network_companies where id=p_target_id) then raise exception 'company target not found' using errcode='P0002'; end if;
    update public.network_verifications set is_current=false where scope='company' and company_id=p_target_id and is_current;
    insert into public.network_verifications(scope,company_id,status,evidence_assertion_id,verified_by,expires_at,note) values('company',p_target_id,p_status,p_evidence_assertion_id,v_user_id,p_expires_at,v_note) returning id into v_id;
    update public.network_companies set verification_status=p_status where id=p_target_id;
  elsif p_scope='facility' then
    if not exists(select 1 from public.network_facilities where id=p_target_id) then raise exception 'facility target not found' using errcode='P0002'; end if;
    update public.network_verifications set is_current=false where scope='facility' and facility_id=p_target_id and is_current;
    insert into public.network_verifications(scope,facility_id,status,evidence_assertion_id,verified_by,expires_at,note) values('facility',p_target_id,p_status,p_evidence_assertion_id,v_user_id,p_expires_at,v_note) returning id into v_id;
    update public.network_facilities set verification_status=p_status where id=p_target_id;
  elsif p_scope='facility_capability' then
    if not exists(select 1 from public.network_facility_capabilities where id=p_target_id) then raise exception 'facility capability target not found' using errcode='P0002'; end if;
    update public.network_verifications set is_current=false where scope='facility_capability' and facility_capability_id=p_target_id and is_current;
    insert into public.network_verifications(scope,facility_capability_id,status,evidence_assertion_id,verified_by,expires_at,note) values('facility_capability',p_target_id,p_status,p_evidence_assertion_id,v_user_id,p_expires_at,v_note) returning id into v_id;
    update public.network_facility_capabilities set verification_status=p_status where id=p_target_id;
  else
    if not exists(select 1 from public.network_company_certifications where id=p_target_id) then raise exception 'company certification target not found' using errcode='P0002'; end if;
    update public.network_verifications set is_current=false where scope='company_certification' and company_certification_id=p_target_id and is_current;
    insert into public.network_verifications(scope,company_certification_id,status,evidence_assertion_id,verified_by,expires_at,note) values('company_certification',p_target_id,p_status,p_evidence_assertion_id,v_user_id,p_expires_at,v_note) returning id into v_id;
    update public.network_company_certifications set verification_status=p_status where id=p_target_id;
  end if;
  return v_id;
end;
$function$;
revoke all on function private.m4_record_verification_impl(text,uuid,text,uuid,timestamptz,text) from public, anon;
grant execute on function private.m4_record_verification_impl(text,uuid,text,uuid,timestamptz,text) to authenticated, service_role;

create or replace function public.m4_record_verification(p_scope text,p_target_id uuid,p_status text,p_evidence_assertion_id uuid,p_expires_at timestamptz default null,p_note text default null)
returns uuid language sql volatile security invoker set search_path='' as $function$
select private.m4_record_verification_impl(p_scope,p_target_id,p_status,p_evidence_assertion_id,p_expires_at,p_note);
$function$;
revoke all on function public.m4_record_verification(text,uuid,text,uuid,timestamptz,text) from public, anon;
grant execute on function public.m4_record_verification(text,uuid,text,uuid,timestamptz,text) to authenticated, service_role;

create or replace function private.m4_open_change_review_impl(p_network_company_id uuid,p_assertion_id uuid,p_field_path text,p_previous_value jsonb,p_proposed_value jsonb)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_user_id uuid; v_id uuid;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then raise exception 'platform superadmin required' using errcode='42501'; end if;
  if not exists(select 1 from public.network_companies where id=p_network_company_id) then raise exception 'network company not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.network_data_assertions where id=p_assertion_id) then raise exception 'assertion not found' using errcode='P0002'; end if;
  insert into public.network_change_reviews(network_company_id,assertion_id,field_path,previous_value,proposed_value,opened_by)
  values(p_network_company_id,p_assertion_id,btrim(p_field_path),p_previous_value,p_proposed_value,v_user_id) returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function private.m4_open_change_review_impl(uuid,uuid,text,jsonb,jsonb) from public, anon;
grant execute on function private.m4_open_change_review_impl(uuid,uuid,text,jsonb,jsonb) to authenticated, service_role;

create or replace function public.m4_open_change_review(p_network_company_id uuid,p_assertion_id uuid,p_field_path text,p_previous_value jsonb,p_proposed_value jsonb)
returns uuid language sql volatile security invoker set search_path='' as $function$
select private.m4_open_change_review_impl(p_network_company_id,p_assertion_id,p_field_path,p_previous_value,p_proposed_value);
$function$;
revoke all on function public.m4_open_change_review(uuid,uuid,text,jsonb,jsonb) from public, anon;
grant execute on function public.m4_open_change_review(uuid,uuid,text,jsonb,jsonb) to authenticated, service_role;

create or replace function private.m4_decide_change_review_impl(p_review_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user_id uuid; v_row public.network_change_reviews%rowtype; v_note text;
begin
  v_user_id:=(select auth.uid());
  if v_user_id is null or not private.is_platform_superadmin() then raise exception 'platform superadmin required' using errcode='42501'; end if;
  if p_decision not in ('accepted','rejected','superseded') then raise exception 'invalid review decision' using errcode='22023'; end if;
  v_note:=nullif(btrim(p_note),''); if v_note is not null and char_length(v_note)>2000 then raise exception 'review note exceeds 2000 characters' using errcode='22023'; end if;
  select * into v_row from public.network_change_reviews where id=p_review_id for update;
  if not found then raise exception 'change review not found' using errcode='P0002'; end if;
  if v_row.status<>'open' then raise exception 'only open change reviews can be decided' using errcode='22023'; end if;
  update public.network_change_reviews set status=p_decision,reviewed_by=v_user_id,reviewed_at=now(),review_note=v_note where id=p_review_id returning * into v_row;
  return jsonb_build_object('review_id',v_row.id,'status',v_row.status,'network_company_id',v_row.network_company_id,'assertion_id',v_row.assertion_id,'reviewed_by',v_row.reviewed_by,'reviewed_at',v_row.reviewed_at);
end;
$function$;
revoke all on function private.m4_decide_change_review_impl(uuid,text,text) from public, anon;
grant execute on function private.m4_decide_change_review_impl(uuid,text,text) to authenticated, service_role;

create or replace function public.m4_decide_change_review(p_review_id uuid,p_decision text,p_note text default null)
returns jsonb language sql volatile security invoker set search_path='' as $function$
select private.m4_decide_change_review_impl(p_review_id,p_decision,p_note);
$function$;
revoke all on function public.m4_decide_change_review(uuid,text,text) from public, anon;
grant execute on function public.m4_decide_change_review(uuid,text,text) to authenticated, service_role;

comment on table public.network_data_assertions is 'M4 append-only Network provenance assertions. Sensitive governance data; no direct authenticated access.';
comment on table public.network_company_claims is 'M4 company profile claim workflow. Claim ownership never implies verification.';
comment on table public.network_verifications is 'M4 platform-controlled verification history. Verification is scoped evidence, not recommendation or creditworthiness.';
comment on table public.network_change_reviews is 'M4 conflict review ledger preserving previous and proposed values; accepted decisions do not silently overwrite source evidence.';
