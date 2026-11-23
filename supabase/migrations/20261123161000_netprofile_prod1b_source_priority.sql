-- PROD1.B — select high-quality first-party sources first, not random UUIDs.
-- Claim lease is still bounded, concurrency-safe and service-role-only.
-- Never use candidate evidence to ACCEPT facts: worker re-fetches every source.
create or replace function private.netprofile_prod1b_claim(p_limit integer default 5)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_items jsonb;
begin
  if p_limit not between 1 and 10 then
    raise exception 'Invalid activity lease size' using errcode='22023';
  end if;
  with selected as (
    select q.company_id
    from private.network_profile_producer_activity_queue q
    join public.network_companies c on c.id=q.company_id
    where q.next_attempt_at <= now()
      and (q.state in ('queued','verified','no_evidence','blocked','failed')
        or (q.state='leased' and q.lease_until<now()))
      and c.publication_status='published' and c.archived_at is null
      and c.website_url ~ '^https://[A-Za-z0-9.-]+(/|$)'
      and lower(split_part(c.website_url,'/',3)) in
        (lower(c.website_domain),'www.'||lower(c.website_domain))
      and exists (
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
      )
    -- Prioritize evidence-backed manufacturers over arbitrary UUID order.
    -- Signals affect work QUEUE ONLY; actual facts still require the live
    -- first-party fetcher and the individual publication gate.
    order by
      case when c.country_code='IT' then 0
           when c.country_code='RO' then 1 else 2 end,
      case when exists (
        select 1 from private.network_company_enrichment e
        where e.canonical_company_id=c.id
          and e.field_key='description' and e.review_status='candidate'
          and jsonb_typeof(e.field_value)='string'
          and lower(split_part(e.evidence_url,'/',3)) in (
            lower(c.website_domain),'www.'||lower(c.website_domain)
          )
          and (e.field_value#>>'{}') ~*
              '(produciamo|fabbrichiamo|fabbricazione di|produzione di|we manufacture|we produce)'
          and (e.field_value#>>'{}') ~*
              '(tubi|profilati|profili|lamiere|barre|nastri|carpenteria|bulloni|stampi|reti)'
      ) then 0 else 1 end,
      case when exists (
        select 1 from private.network_producer_auto1_product_pages p
        where p.company_id=c.id
          and p.status='processed' and p.page_kind='products'
          and p.last_sha256 ~ '^[a-f0-9]{64}
    for update of q skip locked
    limit p_limit
  ), leased as (
    update private.network_profile_producer_activity_queue q
    set state='leased',lease_token=gen_random_uuid(),
        lease_until=now()+interval '15 minutes',attempts=attempts+1,updated_at=now()
    from selected s where q.company_id=s.company_id
    returning q.company_id,q.lease_token
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'company_id',q.company_id,'lease_token',q.lease_token,
    'legal_name',c.legal_name,'trading_name',c.trading_name,
    'site_url',c.website_url,'canonical_domain',c.website_domain,
    'product_url', (
       select p.source_url
       from private.network_producer_auto1_product_pages p
       where p.company_id=c.id and p.status='processed' and p.page_kind='products'
         and p.last_sha256 ~ '^[a-f0-9]{64}$'
         and lower(p.canonical_domain)=lower(c.website_domain)
         and p.source_url ~ '^https://[A-Za-z0-9.-]+(/|$)'
         and lower(split_part(p.source_url,'/',3)) in
           (lower(c.website_domain),'www.'||lower(c.website_domain))
       order by p.last_checked_at desc nulls last,p.source_url limit 1
    )
  ) order by q.company_id),'[]'::jsonb)
  into v_items from leased q join public.network_companies c on c.id=q.company_id;
  return jsonb_build_object('contract','netprofile-prod1b-claim-v1','items',v_items);
end;
$$;
          and lower(p.canonical_domain)=lower(c.website_domain)
      ) then 0 else 1 end,
      q.next_attempt_at,q.company_id
    for update of q skip locked
    limit p_limit
  ), leased as (
    update private.network_profile_producer_activity_queue q
    set state='leased',lease_token=gen_random_uuid(),
        lease_until=now()+interval '15 minutes',attempts=attempts+1,updated_at=now()
    from selected s where q.company_id=s.company_id
    returning q.company_id,q.lease_token
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'company_id',q.company_id,'lease_token',q.lease_token,
    'legal_name',c.legal_name,'trading_name',c.trading_name,
    'site_url',c.website_url,'canonical_domain',c.website_domain,
    'product_url', (
       select p.source_url
       from private.network_producer_auto1_product_pages p
       where p.company_id=c.id and p.status='processed' and p.page_kind='products'
         and p.last_sha256 ~ '^[a-f0-9]{64}$'
         and lower(p.canonical_domain)=lower(c.website_domain)
         and p.source_url ~ '^https://[A-Za-z0-9.-]+(/|$)'
         and lower(split_part(p.source_url,'/',3)) in
           (lower(c.website_domain),'www.'||lower(c.website_domain))
       order by p.last_checked_at desc nulls last,p.source_url limit 1
    )
  ) order by q.company_id),'[]'::jsonb)
  into v_items from leased q join public.network_companies c on c.id=q.company_id;
  return jsonb_build_object('contract','netprofile-prod1b-claim-v1','items',v_items);
end;
$$;
