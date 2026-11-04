-- ONBOARDING-SELF1 · Fase 2 — "Azienda verificata" badge (SELFVER1).
-- Founder decision, 3 Nov 2026 (Notion: ONBOARDING-SELF1): companies are active
-- without a blocking review; trust is expressed by a verification badge that is
-- automatic when the signals are sufficient, otherwise manual, and revocable.
--
-- Reuses the existing model: network_companies.verification_status, the
-- network_verifications history and append-only network_data_assertions.
-- The staff path (private.m4_record_verification_impl, permissions
-- network_trust.verify / network_trust.revoke) is unchanged.
--
-- Automatic verification (all must hold):
--   * the organization has an active link to exactly one Network company;
--   * the registration email was confirmed;
--   * the email domain equals the company website domain (or a subdomain of it);
--   * the domain is not a generic / PEC mailbox provider;
--   * no other Network company shares that website domain;
--   * Italian VAT passes the check digit (other countries: manual for now).
-- It never overrides a staff decision: only unverified or pending companies
-- can be verified automatically; rejected, revoked and expired stay manual.

alter table public.network_verifications
  add column if not exists method text not null default 'staff_review';

alter table public.network_verifications
  drop constraint if exists network_verifications_method_check;
alter table public.network_verifications
  add constraint network_verifications_method_check
    check (method in ('staff_review','automatic_domain','company_request'));

comment on column public.network_verifications.method is
  'SELFVER1: staff_review (decided by platform staff), automatic_domain (email domain = website domain, valid VAT, no shared domain) or company_request (pending manual request opened by the company).';

-- Generic mailbox providers: an address there proves nothing about the company.
create table if not exists private.selfver1_generic_email_domains (
  domain text primary key,
  constraint selfver1_generic_email_domains_lower_check check (domain = lower(btrim(domain)) and domain <> '')
);
revoke all on table private.selfver1_generic_email_domains from public, anon, authenticated;

insert into private.selfver1_generic_email_domains(domain) values
  ('gmail.com'),('googlemail.com'),('outlook.com'),('outlook.it'),('hotmail.com'),('hotmail.it'),
  ('live.com'),('live.it'),('msn.com'),('yahoo.com'),('yahoo.it'),('ymail.com'),('icloud.com'),
  ('me.com'),('mac.com'),('aol.com'),('proton.me'),('protonmail.com'),('gmx.com'),('gmx.net'),
  ('gmx.de'),('web.de'),('t-online.de'),('libero.it'),('virgilio.it'),('alice.it'),('tim.it'),
  ('tin.it'),('tiscali.it'),('fastwebnet.it'),('email.it'),('inwind.it'),('iol.it'),('aruba.it'),
  ('pec.it'),('legalmail.it'),('postecert.it'),('arubapec.it'),('pecimprese.it'),('cert.legalmail.it'),
  ('orange.fr'),('wanadoo.fr'),('free.fr'),('laposte.net'),('sfr.fr'),('yandex.com'),('yandex.ru'),
  ('mail.ru'),('zoho.com'),('qq.com'),('163.com')
on conflict (domain) do nothing;

create or replace function private.selfver1_normalize_domain(p_value text)
returns text
language sql
immutable
set search_path=''
as $function$
  select nullif(
    regexp_replace(lower(btrim(coalesce(p_value,''))), '^(https?://)?(www\.)?([^/:?#]+).*$', '\3'),
    ''
  );
$function$;
revoke all on function private.selfver1_normalize_domain(text) from public, anon, authenticated;

create or replace function private.selfver1_is_generic_domain(p_domain text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_domain is null
    or exists (
      select 1 from private.selfver1_generic_email_domains g
      where p_domain = g.domain or p_domain like '%.' || g.domain
    )
    -- Italian certified mail (PEC) is personal/legal, not a company website domain.
    or p_domain like 'pec.%' or p_domain like '%.pec.%';
$function$;
revoke all on function private.selfver1_is_generic_domain(text) from public, anon, authenticated;

-- Signals for one organization. Never returns e-mail addresses or VAT numbers:
-- only booleans, reason codes and the two domains being compared.
create or replace function private.selfver1_signals(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_company public.network_companies%rowtype;
  v_app public.company_registration_applications%rowtype;
  v_email text;
  v_email_domain text;
  v_site_domain text;
  v_reasons text[] := '{}'::text[];
  v_link_count integer;
begin
  select count(*) into v_link_count
  from public.organization_network_company_links l
  where l.organization_id = p_organization_id and l.link_status = 'active';

  if v_link_count <> 1 then
    return jsonb_build_object('eligible', false, 'reasons', jsonb_build_array('no_linked_company'),
      'company_id', null, 'verification_status', null, 'email_domain', null, 'website_domain', null);
  end if;

  select c.* into v_company
  from public.organization_network_company_links l
  join public.network_companies c on c.id = l.network_company_id
  where l.organization_id = p_organization_id and l.link_status = 'active';

  select a.* into v_app
  from public.organization_network_company_links l
  join public.company_registration_applications a on a.id = l.application_id
  where l.organization_id = p_organization_id and l.link_status = 'active';

  select u.email into v_email from auth.users u where u.id = v_app.applicant_user_id;
  v_email_domain := private.selfver1_normalize_domain(split_part(coalesce(v_email,''), '@', 2));
  v_site_domain := private.selfver1_normalize_domain(coalesce(v_company.website_domain, v_company.website_url));

  if v_app.email_verified_at is null then
    v_reasons := array_append(v_reasons, 'email_not_confirmed');
  end if;
  if v_site_domain is null then
    v_reasons := array_append(v_reasons, 'no_website');
  end if;
  if private.selfver1_is_generic_domain(v_email_domain) then
    v_reasons := array_append(v_reasons, 'generic_email_domain');
  elsif v_site_domain is not null
    and v_email_domain <> v_site_domain
    and v_email_domain not like '%.' || v_site_domain then
    v_reasons := array_append(v_reasons, 'email_domain_mismatch');
  end if;
  if v_site_domain is not null and exists (
    select 1 from public.network_companies o
    where o.id <> v_company.id
      and private.selfver1_normalize_domain(coalesce(o.website_domain, o.website_url)) = v_site_domain
  ) then
    v_reasons := array_append(v_reasons, 'shared_website_domain');
  end if;
  if upper(coalesce(v_company.country_code, v_app.country_code, '')) = 'IT' then
    if not private.selfact1_italian_vat_valid(coalesce(v_company.vat_id, v_app.vat_id)) then
      v_reasons := array_append(v_reasons, 'vat_invalid');
    end if;
  else
    v_reasons := array_append(v_reasons, 'non_italian_manual_review');
  end if;
  if v_company.verification_status in ('rejected','revoked','expired') then
    v_reasons := array_append(v_reasons, 'staff_decision');
  end if;

  return jsonb_build_object(
    'eligible', cardinality(v_reasons) = 0 and v_company.verification_status in ('unverified','pending'),
    'reasons', to_jsonb(v_reasons),
    'company_id', v_company.id,
    'verification_status', v_company.verification_status,
    'email_domain', v_email_domain,
    'website_domain', v_site_domain
  );
end;
$function$;
revoke all on function private.selfver1_signals(uuid) from public, anon, authenticated;

create or replace function private.selfver1_require_member(p_organization_id uuid, p_admin boolean)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_role text;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select m.role into v_role
  from public.organization_memberships m
  where m.organization_id = p_organization_id and m.user_id = v_user and m.status = 'active'
  limit 1;
  if v_role is null or (p_admin and v_role <> 'admin') then
    raise exception 'active organization membership required' using errcode = '42501';
  end if;
  return v_user;
end;
$function$;
revoke all on function private.selfver1_require_member(uuid, boolean) from public, anon, authenticated;

-- Idempotent. Any active member may trigger it; it only ever verifies the
-- caller's own linked company and only when every signal holds.
create or replace function private.selfver1_try_auto_verify_impl(p_organization_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_signals jsonb;
  v_company_id uuid;
  v_app_user uuid;
  v_assertion uuid;
  v_verification uuid;
begin
  v_user := private.selfver1_require_member(p_organization_id, false);
  v_signals := private.selfver1_signals(p_organization_id);
  v_company_id := nullif(v_signals->>'company_id','')::uuid;

  if v_company_id is null or coalesce((v_signals->>'eligible')::boolean, false) is not true then
    -- An already verified company is a successful, idempotent replay.
    return jsonb_build_object('contract','selfver1-auto-v1',
      'verified', coalesce(v_signals->>'verification_status' = 'verified', false),
      'verification_status', v_signals->'verification_status',
      'reasons', case when v_signals->>'verification_status' = 'verified' then '[]'::jsonb else v_signals->'reasons' end);
  end if;

  -- Serialize concurrent attempts for the same company.
  perform 1 from public.network_companies c where c.id = v_company_id for update;
  if (select c.verification_status from public.network_companies c where c.id = v_company_id) not in ('unverified','pending') then
    return jsonb_build_object('contract','selfver1-auto-v1','verified',
      (select c.verification_status = 'verified' from public.network_companies c where c.id = v_company_id),
      'verification_status',(select c.verification_status from public.network_companies c where c.id = v_company_id),
      'reasons','[]'::jsonb);
  end if;

  select a.applicant_user_id into v_app_user
  from public.organization_network_company_links l
  join public.company_registration_applications a on a.id = l.application_id
  where l.organization_id = p_organization_id and l.link_status = 'active';

  insert into public.network_data_assertions(
    entity_type, entity_id, field_path, asserted_value, source_type, source_reference,
    ownership_type, asserted_by, confidence, review_state
  ) values (
    'company', v_company_id, 'verification',
    jsonb_build_object('method','automatic_domain','email_domain',v_signals->'email_domain',
      'website_domain',v_signals->'website_domain','vat_check','IT check digit'),
    'system_derived', 'selfver1:automatic_domain:organization:' || p_organization_id::text,
    'system_derived', v_app_user, 0.9000, 'accepted'
  ) returning id into v_assertion;

  update public.network_verifications
  set is_current = false
  where scope = 'company' and company_id = v_company_id and is_current;

  insert into public.network_verifications(
    scope, company_id, status, evidence_assertion_id, verified_by, note, method
  ) values (
    'company', v_company_id, 'verified', v_assertion, v_app_user,
    'Verifica automatica: dominio email uguale al dominio del sito, P.IVA valida, dominio non condiviso.',
    'automatic_domain'
  ) returning id into v_verification;

  update public.network_companies set verification_status = 'verified' where id = v_company_id;

  return jsonb_build_object('contract','selfver1-auto-v1','verified',true,
    'verification_status','verified','verification_id',v_verification,'reasons','[]'::jsonb);
end;
$function$;
revoke all on function private.selfver1_try_auto_verify_impl(uuid) from public, anon;
grant execute on function private.selfver1_try_auto_verify_impl(uuid) to authenticated, service_role;

-- Read-only state for the Home. Reason codes only; no addresses or VAT numbers.
create or replace function private.selfver1_my_verification_state_impl(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_signals jsonb;
  v_current record;
begin
  perform private.selfver1_require_member(p_organization_id, false);
  v_signals := private.selfver1_signals(p_organization_id);
  select v.status, v.method, v.verified_at into v_current
  from public.network_verifications v
  where v.scope = 'company' and v.is_current
    and v.company_id = nullif(v_signals->>'company_id','')::uuid
  limit 1;
  return jsonb_build_object(
    'contract','selfver1-state-v1',
    'has_company', v_signals->>'company_id' is not null,
    'verification_status', coalesce(v_signals->>'verification_status','unverified'),
    'method', v_current.method,
    'verified_at', v_current.verified_at,
    'auto_eligible', coalesce((v_signals->>'eligible')::boolean,false),
    'reasons', coalesce(v_signals->'reasons','[]'::jsonb),
    'manual_request_pending', coalesce(v_current.status = 'pending' and v_current.method = 'company_request', false)
  );
end;
$function$;
revoke all on function private.selfver1_my_verification_state_impl(uuid) from public, anon;
grant execute on function private.selfver1_my_verification_state_impl(uuid) to authenticated, service_role;

-- Admin opens a manual request; staff decides through the existing trust queue.
create or replace function private.selfver1_request_manual_verification_impl(p_organization_id uuid, p_note text)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_signals jsonb;
  v_company_id uuid;
  v_status text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_assertion uuid;
  v_verification uuid;
begin
  v_user := private.selfver1_require_member(p_organization_id, true);
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'verification request note exceeds 1000 characters' using errcode = '22023';
  end if;
  v_signals := private.selfver1_signals(p_organization_id);
  v_company_id := nullif(v_signals->>'company_id','')::uuid;
  if v_company_id is null then
    raise exception 'no linked Network company' using errcode = 'P0002';
  end if;

  perform 1 from public.network_companies c where c.id = v_company_id for update;
  select c.verification_status into v_status from public.network_companies c where c.id = v_company_id;
  if v_status = 'verified' then
    return jsonb_build_object('contract','selfver1-request-v1','requested',false,'verification_status',v_status);
  end if;
  if v_status in ('revoked','rejected') then
    raise exception 'verification decided by staff; contact support' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.network_verifications v
    where v.scope = 'company' and v.company_id = v_company_id and v.is_current
      and v.status = 'pending' and v.method = 'company_request'
  ) then
    return jsonb_build_object('contract','selfver1-request-v1','requested',false,'verification_status',v_status,'already_pending',true);
  end if;

  insert into public.network_data_assertions(
    entity_type, entity_id, field_path, asserted_value, source_type, source_reference,
    ownership_type, asserted_by, review_state
  ) values (
    'company', v_company_id, 'verification',
    jsonb_build_object('method','company_request','reasons',v_signals->'reasons','note',v_note),
    'company_declared', 'selfver1:company_request:organization:' || p_organization_id::text,
    'company_managed', v_user, 'pending'
  ) returning id into v_assertion;

  update public.network_verifications
  set is_current = false
  where scope = 'company' and company_id = v_company_id and is_current;

  insert into public.network_verifications(
    scope, company_id, status, evidence_assertion_id, verified_by, note, method
  ) values (
    'company', v_company_id, 'pending', v_assertion, v_user, v_note, 'company_request'
  ) returning id into v_verification;

  update public.network_companies set verification_status = 'pending' where id = v_company_id;

  return jsonb_build_object('contract','selfver1-request-v1','requested',true,
    'verification_status','pending','verification_id',v_verification);
end;
$function$;
revoke all on function private.selfver1_request_manual_verification_impl(uuid, text) from public, anon;
grant execute on function private.selfver1_request_manual_verification_impl(uuid, text) to authenticated, service_role;

-- Public wrappers: security invoker, like selfact1 (HP13 allowlist unchanged).
create or replace function public.selfver1_try_auto_verify(p_organization_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
as $function$ select private.selfver1_try_auto_verify_impl(p_organization_id); $function$;
revoke all on function public.selfver1_try_auto_verify(uuid) from public, anon;
grant execute on function public.selfver1_try_auto_verify(uuid) to authenticated, service_role;

create or replace function public.selfver1_my_verification_state(p_organization_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $function$ select private.selfver1_my_verification_state_impl(p_organization_id); $function$;
revoke all on function public.selfver1_my_verification_state(uuid) from public, anon;
grant execute on function public.selfver1_my_verification_state(uuid) to authenticated, service_role;

create or replace function public.selfver1_request_manual_verification(p_organization_id uuid, p_note text default null)
returns jsonb language sql volatile security invoker set search_path=''
as $function$ select private.selfver1_request_manual_verification_impl(p_organization_id, p_note); $function$;
revoke all on function public.selfver1_request_manual_verification(uuid, text) from public, anon;
grant execute on function public.selfver1_request_manual_verification(uuid, text) to authenticated, service_role;

comment on function public.selfver1_try_auto_verify(uuid) is
  'SELFVER1: verify the caller''s own linked company automatically when every signal holds. Idempotent; never overrides a staff decision.';
comment on function public.selfver1_my_verification_state(uuid) is
  'SELFVER1: verification badge state for the caller''s organization: status, method and reason codes (no addresses or VAT numbers).';
comment on function public.selfver1_request_manual_verification(uuid, text) is
  'SELFVER1: an organization admin opens a manual verification request; staff decides via the existing network trust queue.';
