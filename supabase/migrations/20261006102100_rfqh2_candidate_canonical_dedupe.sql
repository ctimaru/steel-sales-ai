create or replace function private.rfqh2_supplier_candidates_impl(
  p_rfq_id uuid,
  p_query text default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_query text := nullif(btrim(coalesce(p_query,'')),'');
  v_limit integer := greatest(1,least(coalesce(p_limit,30),60));
  v_network_allowed boolean := false;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select *
  into v_rfq
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id
    and r.owner_user_id=v_user_id;

  if not found then
    raise exception 'RFQ not found or not owned by caller' using errcode='42501';
  end if;

  v_network_allowed :=
    private.pa1_3_network_access_allowed_for(v_rfq.organization_id);

  with recent as (
    select
      s.identity_key,
      'recent'::text as source,
      s.supplier_name as company_name,
      null::text as contact_name,
      s.supplier_email_normalized as email,
      null::text as country_code,
      s.delivery_channel,
      s.supplier_company_id,
      s.supplier_contact_id,
      s.supplier_network_company_id,
      s.supplier_network_contact_id,
      s.supplier_organization_id,
      10 as priority,
      max(s.created_at) as last_used_at
    from public.buyer_rfq_suppliers s
    join public.buyer_rfq_campaigns r on r.id=s.rfq_id
    where r.organization_id=v_rfq.organization_id
      and r.owner_user_id=v_user_id
      and s.rfq_id<>p_rfq_id
      and (
        v_query is null
        or coalesce(s.supplier_name,'') ilike '%'||v_query||'%'
        or coalesce(s.supplier_email_normalized,'') ilike '%'||lower(v_query)||'%'
      )
    group by
      s.identity_key,s.supplier_name,s.supplier_email_normalized,
      s.delivery_channel,s.supplier_company_id,s.supplier_contact_id,
      s.supplier_network_company_id,s.supplier_network_contact_id,
      s.supplier_organization_id
  ),
  private_contacts as (
    select
      case
        when linked.organization_id is not null
          then 'organization:'||linked.organization_id::text
        when matched.network_company_id is not null
          then 'network_company:'||matched.network_company_id::text
        when c.id is not null
          then 'private_company:'||c.id::text
        else 'email:'||coalesce(ct.email_normalized,lower(btrim(ct.email)))
      end as identity_key,
      'private_contact'::text as source,
      coalesce(c.name,ct.full_name) as company_name,
      ct.full_name as contact_name,
      coalesce(ct.email_normalized,lower(btrim(ct.email))) as email,
      c.country as country_code,
      case when linked.organization_id is not null then 'both' else 'email' end as delivery_channel,
      c.id as supplier_company_id,
      ct.id as supplier_contact_id,
      matched.network_company_id as supplier_network_company_id,
      null::uuid as supplier_network_contact_id,
      linked.organization_id as supplier_organization_id,
      20 as priority,
      ct.created_at as last_used_at
    from public.contacts ct
    left join public.companies c
      on c.id=ct.company_id
     and c.organization_id=ct.organization_id
    left join lateral (
      select case
        when c.id is null then null::uuid
        else private.rfqh2_verified_network_match_for_private_company(
          v_rfq.organization_id,c.id
        )
      end as network_company_id
    ) matched on true
    left join lateral (
      select case
        when matched.network_company_id is null then null::uuid
        else private.rfqh2_linked_supplier_organization(
          matched.network_company_id,v_rfq.organization_id
        )
      end as organization_id
    ) linked on true
    where ct.organization_id=v_rfq.organization_id
      and nullif(coalesce(ct.email_normalized,lower(btrim(ct.email))), '') is not null
      and (
        v_query is null
        or ct.full_name ilike '%'||v_query||'%'
        or coalesce(c.name,'') ilike '%'||v_query||'%'
        or coalesce(ct.email_normalized,lower(btrim(ct.email))) ilike '%'||lower(v_query)||'%'
      )
  ),
  network as (
    select
      case
        when linked.organization_id is not null
          then 'organization:'||linked.organization_id::text
        else 'network_company:'||nc.id::text
      end as identity_key,
      case when best.network_contact_id is not null
        then 'network_contact' else 'network_company' end as source,
      coalesce(nullif(btrim(nc.trading_name),''),nc.legal_name) as company_name,
      best.display_name as contact_name,
      best.email,
      nc.country_code,
      case
        when linked.organization_id is not null and best.email is not null then 'both'
        when linked.organization_id is not null then 'platform'
        else 'email'
      end as delivery_channel,
      null::uuid as supplier_company_id,
      null::uuid as supplier_contact_id,
      nc.id as supplier_network_company_id,
      best.network_contact_id as supplier_network_contact_id,
      linked.organization_id as supplier_organization_id,
      30 as priority,
      nc.updated_at as last_used_at
    from public.network_companies nc
    left join lateral (
      select *
      from private.rfqh2_best_network_contact(nc.id)
    ) best on true
    left join lateral (
      select private.rfqh2_linked_supplier_organization(
        nc.id,v_rfq.organization_id
      ) as organization_id
    ) linked on true
    where v_network_allowed
      and nc.publication_status='published'
      and nc.archived_at is null
      and (
        best.email is not null
        or linked.organization_id is not null
      )
      and (
        v_query is null
        or nc.legal_name ilike '%'||v_query||'%'
        or coalesce(nc.trading_name,'') ilike '%'||v_query||'%'
        or coalesce(nc.vat_id,'') ilike '%'||v_query||'%'
        or coalesce(nc.website_domain,'') ilike '%'||lower(v_query)||'%'
        or coalesce(best.display_name,'') ilike '%'||v_query||'%'
        or coalesce(best.email,'') ilike '%'||lower(v_query)||'%'
      )
  ),
  all_candidates as (
    select * from recent
    union all
    select * from private_contacts
    union all
    select * from network
  ),
  ranked as (
    select
      a.*,
      row_number() over(
        partition by a.identity_key
        order by a.priority,a.last_used_at desc nulls last,a.company_name
      ) as rn
    from all_candidates a
    where not exists (
      select 1
      from public.buyer_rfq_suppliers current
      where current.rfq_id=p_rfq_id
        and (
          current.identity_key=a.identity_key
          or (
            a.supplier_organization_id is not null
            and current.supplier_organization_id=a.supplier_organization_id
          )
          or (
            a.supplier_network_company_id is not null
            and current.supplier_network_company_id=a.supplier_network_company_id
          )
          or (
            a.supplier_company_id is not null
            and current.supplier_company_id=a.supplier_company_id
          )
          or (
            a.email is not null
            and current.supplier_email_normalized=a.email
          )
        )
    )
  ),
  limited as (
    select *
    from ranked
    where rn=1
    order by priority,last_used_at desc nulls last,company_name
    limit v_limit
  )
  select jsonb_build_object(
    'contract','RFQH2-supplier-candidates-v1',
    'rfq_id',v_rfq.id,
    'network_enabled',v_network_allowed,
    'candidates',
    coalesce(jsonb_agg(jsonb_build_object(
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
      'last_used_at',last_used_at
    ) order by priority,last_used_at desc nulls last,company_name),'[]'::jsonb)
  )
  into v_result
  from limited;

  return coalesce(v_result,jsonb_build_object(
    'contract','RFQH2-supplier-candidates-v1',
    'rfq_id',v_rfq.id,
    'network_enabled',v_network_allowed,
    'candidates','[]'::jsonb
  ));
end;
$$;

revoke all on function private.rfqh2_supplier_candidates_impl(uuid,text,integer)
from public, anon;
grant execute on function private.rfqh2_supplier_candidates_impl(uuid,text,integer)
to authenticated;
