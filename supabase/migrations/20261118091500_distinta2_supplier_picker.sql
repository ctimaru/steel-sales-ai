-- DISTINTA2 (founder decision, 18 Nov 2026): step 2 «A chi lo chiedi».
-- One read that groups the suppliers a buyer can invite to a draft RFQ:
--   saved        companies the user saved in the Network (reachable or not)
--   recent       suppliers already used in the organization's past RFQs
--   contacts     the organization's private contacts with an email
--   recommended  published Network companies that work the product families
--                found in the bill of material, reachable only
-- and one write that removes a supplier from a draft RFQ before anything is
-- sent. Reachability reuses the RFQH2 privacy-reviewed contact and linked
-- organization rules; nothing here sends, publishes or exposes contacts that
-- RFQH2 would not expose.

create or replace function private.distinta2_line_family_keys(p_distinta_id uuid)
returns text[]
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(array_agg(distinct k order by k) filter (where k is not null),'{}'::text[])
  from (
    select case
      when d ~ '\m(tub|scatolat|hollow|pipe|tube|rhs|shs|chs)' then 'tubes_pipes'
      when d ~ '\m(lamier|coil|nastr|sheet|plate|piatt)' then 'flat_products'
      when d ~ '\m(trav|ipe|hea|heb|upn|unp|angolar|profilat|beam|section)' then 'long_products'
      when d ~ '\m(barr|tondo pieno|tondin|quadro pieno|bar)\M' then 'long_products'
      else null
    end as k
    from (
      select lower(l.description) as d
      from public.buyer_distinta_lines l
      where l.distinta_id=p_distinta_id
    ) lines
  ) keys;
$$;

revoke all on function private.distinta2_line_family_keys(uuid) from public, anon;
grant execute on function private.distinta2_line_family_keys(uuid) to authenticated;

create or replace function private.distinta2_supplier_picker_impl(p_rfq_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_network_allowed boolean := false;
  v_families text[] := '{}'::text[];
  v_buyer_country text;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select * into v_rfq
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id
    and r.owner_user_id=v_user_id;
  if not found then
    raise exception 'RFQ not found or not owned by caller' using errcode='42501';
  end if;

  v_network_allowed := private.pa1_3_network_access_allowed_for(v_rfq.organization_id);
  if v_rfq.source_distinta_id is not null then
    v_families := private.distinta2_line_family_keys(v_rfq.source_distinta_id);
  end if;
  select o.country_code into v_buyer_country
  from public.organizations o where o.id=v_rfq.organization_id;

  with family_ids as (
    select f.id, coalesce(parent.canonical_key,f.canonical_key) as root_key, f.display_name
    from public.network_product_families f
    left join public.network_product_families parent on parent.id=f.parent_id
    where f.canonical_key=any(v_families)
       or parent.canonical_key=any(v_families)
  ),
  network_base as (
    select
      nc.id as network_company_id,
      coalesce(nullif(btrim(nc.trading_name),''),nc.legal_name) as company_name,
      nc.country_code,
      nc.verification_status,
      best.network_contact_id,
      best.display_name as contact_name,
      best.email,
      linked.organization_id
    from public.network_companies nc
    left join lateral (select * from private.rfqh2_best_network_contact(nc.id)) best on true
    left join lateral (
      select private.rfqh2_linked_supplier_organization(nc.id,v_rfq.organization_id) as organization_id
    ) linked on true
    where v_network_allowed
      and nc.publication_status='published'
      and nc.archived_at is null
  ),
  saved as (
    select
      case when nb.organization_id is not null then 'organization:'||nb.organization_id::text
           else 'network_company:'||nb.network_company_id::text end as identity_key,
      'saved'::text as grp,
      1 as grp_rank,
      case when nb.network_contact_id is not null then 'network_contact' else 'network_company' end as source,
      nb.company_name, nb.contact_name, nb.email, nb.country_code,
      case when nb.organization_id is not null and nb.email is not null then 'both'
           when nb.organization_id is not null then 'platform' else 'email' end as delivery_channel,
      null::uuid as supplier_company_id, null::uuid as supplier_contact_id,
      nb.network_company_id as supplier_network_company_id,
      nb.network_contact_id as supplier_network_contact_id,
      nb.organization_id as supplier_organization_id,
      (nb.email is not null or nb.organization_id is not null) as reachable,
      'Salvata nel Network'::text as reason,
      case when nb.email is not null or nb.organization_id is not null then 0 else 1 end as sort_rank,
      s.created_at as sort_at
    from public.network_saved_companies s
    join network_base nb on nb.network_company_id=s.network_company_id
    where s.organization_id=v_rfq.organization_id
      and s.user_id=v_user_id
  ),
  recent as (
    select
      s.identity_key,
      'recent'::text as grp, 2 as grp_rank,
      'recent'::text as source,
      s.supplier_name as company_name, null::text as contact_name,
      s.supplier_email_normalized as email, null::text as country_code,
      s.delivery_channel,
      s.supplier_company_id, s.supplier_contact_id,
      s.supplier_network_company_id, s.supplier_network_contact_id,
      s.supplier_organization_id,
      (s.supplier_email_normalized is not null or s.supplier_organization_id is not null) as reachable,
      ('Usato in '||count(distinct s.rfq_id)::text||case when count(distinct s.rfq_id)=1 then ' richiesta' else ' richieste' end) as reason,
      0 as sort_rank,
      max(s.created_at) as sort_at
    from public.buyer_rfq_suppliers s
    join public.buyer_rfq_campaigns r on r.id=s.rfq_id
    where r.organization_id=v_rfq.organization_id
      and r.owner_user_id=v_user_id
      and s.rfq_id<>p_rfq_id
    group by s.identity_key,s.supplier_name,s.supplier_email_normalized,s.delivery_channel,
      s.supplier_company_id,s.supplier_contact_id,s.supplier_network_company_id,
      s.supplier_network_contact_id,s.supplier_organization_id
  ),
  contacts as (
    select
      case when c.id is not null then 'private_company:'||c.id::text
           else 'email:'||coalesce(ct.email_normalized,lower(btrim(ct.email))) end as identity_key,
      'contacts'::text as grp, 3 as grp_rank,
      'private_contact'::text as source,
      coalesce(c.name,ct.full_name) as company_name, ct.full_name as contact_name,
      coalesce(ct.email_normalized,lower(btrim(ct.email))) as email, c.country as country_code,
      'email'::text as delivery_channel,
      c.id as supplier_company_id, ct.id as supplier_contact_id,
      null::uuid as supplier_network_company_id, null::uuid as supplier_network_contact_id,
      null::uuid as supplier_organization_id,
      true as reachable,
      'Nei tuoi contatti'::text as reason,
      0 as sort_rank,
      ct.created_at as sort_at
    from public.contacts ct
    left join public.companies c on c.id=ct.company_id and c.organization_id=ct.organization_id
    where ct.organization_id=v_rfq.organization_id
      and nullif(coalesce(ct.email_normalized,lower(btrim(ct.email))),'') is not null
  ),
  recommended as (
    select
      case when nb.organization_id is not null then 'organization:'||nb.organization_id::text
           else 'network_company:'||nb.network_company_id::text end as identity_key,
      'recommended'::text as grp, 4 as grp_rank,
      case when nb.network_contact_id is not null then 'network_contact' else 'network_company' end as source,
      nb.company_name, nb.contact_name, nb.email, nb.country_code,
      case when nb.organization_id is not null and nb.email is not null then 'both'
           when nb.organization_id is not null then 'platform' else 'email' end as delivery_channel,
      null::uuid, null::uuid,
      nb.network_company_id, nb.network_contact_id, nb.organization_id,
      true as reachable,
      concat_ws(' · ',
        string_agg(distinct case fi.root_key
          when 'tubes_pipes' then 'Tubi'
          when 'flat_products' then 'Prodotti piani'
          when 'long_products' then 'Prodotti lunghi'
          else fi.display_name end, ', '),
        case min(case role.canonical_key when 'producer' then 0 when 'trader_distributor' then 1
                      when 'processor_service_provider' then 2 else 3 end)
          when 0 then 'Produttore' when 1 then 'Distributore' when 2 then 'Lavorazioni' else null end
      ) as reason,
      (min(case role.canonical_key when 'producer' then 0 when 'trader_distributor' then 1
                when 'processor_service_provider' then 2 else 3 end) * 10
        + case when nb.verification_status='verified' then 0 else 1 end * 4
        + case when v_buyer_country is not null and nb.country_code=v_buyer_country then 0 else 2 end) as sort_rank,
      null::timestamptz as sort_at
    from network_base nb
    join public.network_company_products p on p.company_id=nb.network_company_id
    join family_ids fi on fi.id=p.product_family_id
    left join public.network_company_role_assignments ra on ra.company_id=nb.network_company_id
    left join public.network_company_roles role on role.id=ra.role_id
    where (nb.email is not null or nb.organization_id is not null)
    group by nb.network_company_id,nb.company_name,nb.contact_name,nb.email,nb.country_code,
      nb.verification_status,nb.network_contact_id,nb.organization_id
  ),
  all_candidates as (
    select * from saved
    union all select * from recent
    union all select * from contacts
    union all select * from recommended
  ),
  not_in_rfq as (
    select a.*
    from all_candidates a
    where not exists (
      select 1 from public.buyer_rfq_suppliers current
      where current.rfq_id=p_rfq_id
        and (
          current.identity_key=a.identity_key
          or (a.supplier_organization_id is not null and current.supplier_organization_id=a.supplier_organization_id)
          or (a.supplier_network_company_id is not null and current.supplier_network_company_id=a.supplier_network_company_id)
          or (a.supplier_company_id is not null and current.supplier_company_id=a.supplier_company_id)
          or (a.email is not null and current.supplier_email_normalized=a.email)
        )
    )
  ),
  deduped as (
    -- The first group wins: a saved company that is also recommended shows once, as saved.
    select *, row_number() over (
      partition by coalesce(supplier_organization_id::text, supplier_network_company_id::text, email, identity_key)
      order by grp_rank, sort_rank, sort_at desc nulls last, company_name
    ) as rn
    from not_in_rfq
  ),
  limited as (
    select *, row_number() over (
      partition by grp order by sort_rank, sort_at desc nulls last, company_name
    ) as grp_pos
    from deduped
    where rn=1
  )
  select jsonb_build_object(
    'contract','DISTINTA2-supplier-picker-v1',
    'rfq_id',v_rfq.id,
    'network_enabled',v_network_allowed,
    'families',to_jsonb(v_families),
    'candidates',coalesce(jsonb_agg(jsonb_build_object(
      'group',grp,
      'reachable',reachable,
      'reason',reason,
      'identity_key',identity_key,
      'source',source,
      'company_name',company_name,
      'contact_name',contact_name,
      'email',email,
      'country_code',country_code,
      'delivery_channel',delivery_channel,
      'supplier_company_id',supplier_company_id,
      'supplier_contact_id',supplier_contact_id,
      'supplier_network_company_id',supplier_network_company_id,
      'supplier_network_contact_id',supplier_network_contact_id,
      'supplier_organization_id',supplier_organization_id,
      'last_used_at',sort_at
    ) order by grp_rank, grp_pos),'[]'::jsonb)
  )
  into v_result
  from limited
  where grp_pos <= case grp when 'recommended' then 24 else 30 end;

  return v_result;
end;
$$;

revoke all on function private.distinta2_supplier_picker_impl(uuid) from public, anon;
grant execute on function private.distinta2_supplier_picker_impl(uuid) to authenticated;

create or replace function public.distinta2_supplier_picker(p_rfq_id uuid)
returns jsonb
language sql
stable
set search_path=''
as $$
  select private.distinta2_supplier_picker_impl(p_rfq_id);
$$;

revoke all on function public.distinta2_supplier_picker(uuid) from public, anon;
grant execute on function public.distinta2_supplier_picker(uuid) to authenticated;

-- Remove a supplier from a draft RFQ before anything was sent. The removal is
-- recorded in the RFQ event log (the cascade drops the «supplier_added» event
-- of the deleted row, so the trail keeps identity and channel here).
create or replace function private.distinta2_remove_supplier_impl(p_rfq_id uuid, p_supplier_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select * into v_rfq
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id and r.owner_user_id=v_user_id
  for update;
  if not found then
    raise exception 'RFQ not found or not owned by caller' using errcode='42501';
  end if;
  if v_rfq.status not in ('draft','ready') then
    raise exception 'Suppliers can be removed only before the RFQ is sent' using errcode='55000';
  end if;

  select * into v_supplier
  from public.buyer_rfq_suppliers s
  where s.id=p_supplier_id and s.rfq_id=p_rfq_id
  for update;
  if not found then
    raise exception 'Supplier not found in this RFQ' using errcode='P0002';
  end if;
  if v_supplier.status<>'draft'
     or exists(select 1 from public.buyer_rfq_dispatches d where d.supplier_id=v_supplier.id)
     or exists(select 1 from public.buyer_rfq_quotes q where q.supplier_id=v_supplier.id) then
    raise exception 'This supplier already has activity and cannot be removed' using errcode='55000';
  end if;

  insert into public.buyer_rfq_events(
    rfq_id, supplier_id, owner_user_id, organization_id, actor_user_id, event_type, metadata
  ) values (
    v_rfq.id, null, v_rfq.owner_user_id, v_rfq.organization_id, v_user_id, 'supplier_removed',
    jsonb_build_object(
      'removed_supplier_id', v_supplier.id,
      'identity_source', v_supplier.identity_source,
      'identity_key', v_supplier.identity_key,
      'supplier_organization_id', v_supplier.supplier_organization_id,
      'supplier_network_company_id', v_supplier.supplier_network_company_id,
      'supplier_email', v_supplier.supplier_email_normalized,
      'delivery_channel', v_supplier.delivery_channel
    )
  );

  delete from public.buyer_rfq_suppliers s where s.id=v_supplier.id;

  return jsonb_build_object('ok', true, 'removed_supplier_id', v_supplier.id);
end;
$$;

revoke all on function private.distinta2_remove_supplier_impl(uuid,uuid) from public, anon;
grant execute on function private.distinta2_remove_supplier_impl(uuid,uuid) to authenticated;

create or replace function public.distinta2_remove_supplier(p_rfq_id uuid, p_supplier_id uuid)
returns jsonb
language sql
volatile
set search_path=''
as $$
  select private.distinta2_remove_supplier_impl(p_rfq_id, p_supplier_id);
$$;

revoke all on function public.distinta2_remove_supplier(uuid,uuid) from public, anon;
grant execute on function public.distinta2_remove_supplier(uuid,uuid) to authenticated;
