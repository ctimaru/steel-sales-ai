-- NET-CONTACT1 — Public company channels (email + switchboard phone) for every
-- published Network company, and RFQ reachability by email.
--
-- Founder decisions 2026-11-02:
--   * collect ONLY company channels (generic mailboxes such as info@,
--     commerciale@, vendite@ on the company's own domain, and the switchboard
--     phone). Personal addresses are never staged;
--   * publication through human bulk review in Platform, reusing LR4
--     (private.lr4_review_contact_privacy_impl): no automatic publication;
--   * Network → RFQ selection also accepts suppliers reachable by a published,
--     privacy-ready company email (same rule as rfqh2_add_supplier).
--
-- Writes: only service_role staging (worker) and the Platform reviewer.
-- No published row is created here; LR4's publication guard still applies.

create or replace function private.netcontact1_generic_local_part(p_local text)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
  select lower(btrim(coalesce(p_local,''))) ~ (
    '^(info|informazioni|contatti|contact|contacts|commerciale|commerciali|vendite|vendita|sales|'
    'ufficio\.?commerciale|ufficiocommerciale|ordini|orders|offerte|preventivi|quotes|export|'
    'italia|segreteria|office|mail|posta|amministrazione|acquisti|purchasing|tecnico|technical|'
    'ufficio\.?tecnico|ufficiotecnico|logistica|spedizioni|customer\.?service|servizio\.?clienti|'
    'assistenza|support|qualita|quality|marketing|direzione|reception|centralino|azienda|company|hello)'
    '([._-]?[a-z]{2})?([._-]?[0-9]{1,2})?$'
  );
$function$;

-- Email domain must be the company's website domain or one of its subdomains.
create or replace function private.netcontact1_domain_matches(p_email text,p_website_domain text)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $function$
  select p_website_domain is not null
    and split_part(lower(btrim(p_email)),'@',2) ~ '^[a-z0-9.-]+\.[a-z]{2,}$'
    and (split_part(lower(btrim(p_email)),'@',2)=lower(regexp_replace(btrim(p_website_domain),'^www\.',''))
      or split_part(lower(btrim(p_email)),'@',2) like '%.'||lower(regexp_replace(btrim(p_website_domain),'^www\.','')));
$function$;

-- Worker staging: one pending_review company channel per company and value.
create or replace function public.netcontact1_stage_company_channel(
  p_company_id uuid,
  p_email text default null,
  p_phone text default null,
  p_source_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_company public.network_companies%rowtype;
  v_email text:=nullif(lower(btrim(coalesce(p_email,''))),'');
  v_phone text:=nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
  v_source text:=nullif(btrim(coalesce(p_source_url,'')),'');
  v_assertion uuid;
  v_contact uuid;
  v_type text;
begin
  if v_email is null and v_phone is null then
    raise exception 'At least one channel is required' using errcode='22023';
  end if;
  if v_source is null or v_source !~ '^https://' or length(v_source)>2000 then
    raise exception 'An https source URL on the company site is required' using errcode='22023';
  end if;
  select * into v_company from public.network_companies
  where id=p_company_id and publication_status='published' and archived_at is null;
  if not found then raise exception 'Published company not found' using errcode='P0002'; end if;
  if split_part(regexp_replace(lower(v_source),'^https://',''),'/',1) not in (
       lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')),
       'www.'||lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')))
     and split_part(regexp_replace(lower(v_source),'^https://',''),'/',1) not like
       '%.'||lower(regexp_replace(coalesce(v_company.website_domain,''),'^www\.','')) then
    raise exception 'Source must be on the company website' using errcode='22023';
  end if;
  if v_email is not null and (
       length(v_email)>254
       or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
       or not private.netcontact1_generic_local_part(split_part(v_email,'@',1))
       or not private.netcontact1_domain_matches(v_email,v_company.website_domain)) then
    -- Founder decision: personal or foreign-domain addresses are never staged.
    v_email:=null;
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{6,15}$' then v_phone:=null; end if;
  if v_email is null and v_phone is null then
    return jsonb_build_object('contract','netcontact1-stage-v1','status','rejected_channel');
  end if;

  if exists(select 1 from public.network_contacts nc where nc.company_id=p_company_id
       and nc.archived_at is null
       and ((v_email is not null and lower(nc.email)=v_email)
         or (v_phone is not null and regexp_replace(coalesce(nc.phone,''),'[^0-9+]','','g')=v_phone))) then
    return jsonb_build_object('contract','netcontact1-stage-v1','status','existing');
  end if;

  v_type:=case when v_email is not null and split_part(v_email,'@',1) ~
    '^(commerciale|commerciali|vendite|vendita|sales|ufficio\.?commerciale|ufficiocommerciale|ordini|orders|offerte|preventivi|quotes|export)'
    then 'sales' else 'general' end;

  insert into public.network_data_assertions(
    entity_type,entity_id,field_path,asserted_value,source_type,source_reference,
    ownership_type,confidence,review_state)
  values('company',p_company_id,'netcontact1_public_company_channel',
    jsonb_build_object('email',v_email,'phone',v_phone),
    'public_web',v_source,'platform_curated',0.9,'pending')
  returning id into v_assertion;

  insert into public.network_contacts(
    company_id,contact_type,display_name,email,phone,publication_status,
    source_reference,source_assertion_id,source_obtained_at)
  values(p_company_id,v_type,
    case v_type when 'sales' then 'Ufficio commerciale' else 'Contatti aziendali' end,
    v_email,v_phone,'pending_review',v_source,v_assertion,now())
  returning id into v_contact;

  return jsonb_build_object('contract','netcontact1-stage-v1','status','staged',
    'contact_id',v_contact,'email_staged',v_email is not null,'phone_staged',v_phone is not null);
end;
$function$;

-- Worker selection: next published companies with a website and no company channel yet.
create or replace function public.netcontact1_next_batch(p_limit integer default 25)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  with eligible as (
    select c.id,c.legal_name,c.trading_name,c.website_url,c.website_domain
    from public.network_companies c
    where c.publication_status='published' and c.archived_at is null
      and nullif(btrim(coalesce(c.website_domain,'')),'') is not null
      and c.website_url like 'http%'
      and not exists(select 1 from public.network_contacts nc
        where nc.company_id=c.id and nc.archived_at is null
          and nc.publication_status in ('pending_review','published'))
  )
  select jsonb_build_object(
    'contract','netcontact1-next-v1',
    'eligible',(select count(*) from eligible),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
        'kind','canonical','company_id',e.id,'site',e.website_url,
        'domain',lower(regexp_replace(e.website_domain,'^www\.','')),
        'company_name',coalesce(e.trading_name,e.legal_name)) order by lower(e.legal_name),e.id)
      from (select * from eligible order by lower(legal_name),id
            limit least(greatest(coalesce(p_limit,25),1),25)) e),'[]'::jsonb));
$function$;

-- Platform review queue (company channels pending review).
create or replace function public.netcontact1_pending_company_channels(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
begin
  perform private.require_platform_permission('network.privacy_governance_review');
  return jsonb_build_object(
    'contract','netcontact1-review-v1',
    'pending',(select count(*) from public.network_contacts nc
      join public.network_data_assertions a on a.id=nc.source_assertion_id
      where nc.publication_status='pending_review' and nc.archived_at is null
        and a.field_path='netcontact1_public_company_channel'),
    'items',coalesce((select jsonb_agg(row_to_json(x) order by x.company_name) from (
      select nc.id as contact_id,nc.company_id,coalesce(c.trading_name,c.legal_name) as company_name,
        c.website_domain,nc.contact_type,nc.email,nc.phone,nc.source_reference as source_url,
        nc.source_obtained_at
      from public.network_contacts nc
      join public.network_companies c on c.id=nc.company_id
      join public.network_data_assertions a on a.id=nc.source_assertion_id
      where nc.publication_status='pending_review' and nc.archived_at is null
        and a.field_path='netcontact1_public_company_channel'
      order by lower(coalesce(c.trading_name,c.legal_name)),nc.id
      limit least(greatest(coalesce(p_limit,100),1),200)) x),'[]'::jsonb));
end;
$function$;

-- Bulk approval: each contact goes through the existing LR4 review (permission
-- check, company_channel classification, 12-month review expiry, audit).
create or replace function public.netcontact1_approve_company_channels(p_contact_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_ok integer:=0;
  v_skipped integer:=0;
begin
  perform private.require_platform_permission('network.privacy_governance_review');
  if p_contact_ids is null or cardinality(p_contact_ids)<1 or cardinality(p_contact_ids)>200 then
    raise exception 'Select 1 to 200 contacts' using errcode='22023';
  end if;
  foreach v_id in array p_contact_ids loop
    if exists(select 1 from public.network_contacts nc
         join public.network_data_assertions a on a.id=nc.source_assertion_id
         where nc.id=v_id and nc.publication_status='pending_review' and nc.archived_at is null
           and a.field_path='netcontact1_public_company_channel'
           and (nc.email is null or (private.netcontact1_generic_local_part(split_part(nc.email,'@',1))))) then
      perform private.lr4_review_contact_privacy_impl(v_id,'company_channel',null,null,
        'NET-CONTACT1 bulk review: public company channel from the official website',true);
      -- Assertions are immutable (m4): the decision is audited by LR4 in
      -- network_data_governance_events.
      v_ok:=v_ok+1;
    else
      v_skipped:=v_skipped+1;
    end if;
  end loop;
  return jsonb_build_object('contract','netcontact1-approve-v1','published',v_ok,'skipped',v_skipped);
end;
$function$;

-- Bulk rejection: wrong or non-company channels are archived (never published),
-- with the decision recorded in the LR4 governance ledger.
create or replace function public.netcontact1_reject_company_channels(p_contact_ids uuid[],p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=(select auth.uid());
  v_note text:=left(coalesce(nullif(btrim(coalesce(p_note,'')),''),'NET-CONTACT1 bulk review: rejected'),4000);
  v_count integer;
begin
  perform private.require_platform_permission('network.privacy_governance_review');
  if p_contact_ids is null or cardinality(p_contact_ids)<1 or cardinality(p_contact_ids)>200 then
    raise exception 'Select 1 to 200 contacts' using errcode='22023';
  end if;
  with rejected as (
    update public.network_contacts nc
    set publication_status='archived',archived_at=now(),updated_at=now()
    from public.network_data_assertions a
    where nc.id=any(p_contact_ids) and a.id=nc.source_assertion_id
      and a.field_path='netcontact1_public_company_channel'
      and nc.publication_status='pending_review' and nc.archived_at is null
    returning nc.id
  ), logged as (
    insert into public.network_data_governance_events(
      subject_type,subject_id,action,actor_user_id,actor_type,before_state,after_state,note)
    select 'network_contact',r.id,'contact_privacy_reviewed',v_user,'platform',
      jsonb_build_object('publication_status','pending_review'),
      jsonb_build_object('publication_status','archived','decision','rejected'),v_note
    from rejected r
    returning 1
  )
  select count(*) into v_count from logged;
  return jsonb_build_object('contract','netcontact1-reject-v1','rejected',v_count,
    'skipped',cardinality(p_contact_ids)-v_count);
end;
$function$;

-- RFQ reachability for the Network list and the RFQ Hub receiver:
-- 'platform' (active, connectable), 'email' (published privacy-ready company
-- email, as used by rfqh2_add_supplier), or 'none'. Never returns the email.
create or replace function public.netcontact1_rfq_reachability(p_organization_id uuid,p_company_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_readiness jsonb;
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  if p_company_ids is null or cardinality(p_company_ids)<1 or cardinality(p_company_ids)>24 then
    raise exception 'Select 1 to 24 companies' using errcode='22023';
  end if;
  v_readiness:=public.netconnect2e_readiness(p_organization_id,p_company_ids);
  return jsonb_build_object('contract','netcontact1-reach-v1','items',coalesce((
    select jsonb_agg(jsonb_build_object('company_id',r->>'company_id','channel',
      case when r->>'status' in ('available','connected') then 'platform'
        when exists(select 1 from private.rfqh2_best_network_contact((r->>'company_id')::uuid)) then 'email'
        else 'none' end))
    from jsonb_array_elements(v_readiness->'items') r),'[]'::jsonb));
end;
$function$;

revoke all on function private.netcontact1_generic_local_part(text) from public,anon;
revoke all on function private.netcontact1_domain_matches(text,text) from public,anon;
revoke all on function public.netcontact1_stage_company_channel(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.netcontact1_next_batch(integer) from public,anon,authenticated;
revoke all on function public.netcontact1_pending_company_channels(integer) from public,anon;
revoke all on function public.netcontact1_approve_company_channels(uuid[]) from public,anon;
revoke all on function public.netcontact1_reject_company_channels(uuid[],text) from public,anon;
revoke all on function public.netcontact1_rfq_reachability(uuid,uuid[]) from public,anon;
grant execute on function private.netcontact1_generic_local_part(text) to authenticated,service_role;
grant execute on function private.netcontact1_domain_matches(text,text) to service_role;
grant execute on function public.netcontact1_stage_company_channel(uuid,text,text,text) to service_role;
grant execute on function public.netcontact1_next_batch(integer) to service_role;
grant execute on function public.netcontact1_pending_company_channels(integer) to authenticated,service_role;
grant execute on function public.netcontact1_approve_company_channels(uuid[]) to authenticated,service_role;
grant execute on function public.netcontact1_reject_company_channels(uuid[],text) to authenticated,service_role;
grant execute on function public.netcontact1_rfq_reachability(uuid,uuid[]) to authenticated,service_role;
