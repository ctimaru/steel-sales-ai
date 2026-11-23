-- NET-PROFILE-PROD1.C: deepen first-party product/manufacturing/working pages.
-- No new cron, no unverified automatic product claims, no inventory/SKU writes.
-- Preserve the original lease and first-party/role requirements from PROD1.B.
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
    -- Official-source ranking changes only visit order; live worker still
    -- checks all assertions and never treats a candidate as published proof.
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
        where p.company_id=c.id and p.status='processed'
          and p.page_kind='products' and p.last_sha256 ~ '^[a-f0-9]{64}$'
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
    'product_urls', coalesce((
      select jsonb_agg(src.source_url order by src.priority,src.checked_at desc nulls last,src.source_url)
      from (
        select p.source_url,p.last_checked_at as checked_at,
          case when p.source_url ~* '/(produzion[ei]|lavorazion[ei]|manufactur|processing)'
              then 0
              when p.source_url ~* '/(prodott[oi]|product)' then 1
              else 2 end as priority
        from private.network_producer_auto1_product_pages p
        where p.company_id=c.id
          and p.status='processed' and p.page_kind='products'
          and p.last_sha256 ~ '^[a-f0-9]{64}
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
          and p.source_url ~ '^https://[A-Za-z0-9.-]+(/|$)'
          and lower(split_part(p.source_url,'/',3)) in
            (lower(c.website_domain),'www.'||lower(c.website_domain))
          and p.source_url !~* '(privacy|cookies?|certific|qualit[aà]|quality|policy|news|blog|contatt|contact)'
          and p.source_url !~* '\.(pdf|zip|docx?|xlsx?|csv|xml|jpe?g|png|gif|svg|webp)(\?|$)'
        order by priority,p.last_checked_at desc nulls last,p.source_url
        limit 6
      ) src
    ),'[]'::jsonb),
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


-- Add independent working/services evidence; every service needs a positive
-- first-party first-person process assertion and one exact source excerpt.
create or replace function private.netprofile_prod1b_complete(
 p_company_id uuid,p_lease_token uuid,p_status text,
 p_source_url text default null,p_source_sha256 text default null,
 p_facts jsonb default '[]'::jsonb,p_reason text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_q private.network_profile_producer_activity_queue%rowtype;
 v_c public.network_companies%rowtype;
 v_item jsonb;
 v_field text;
 v_value jsonb;
 v_excerpt text;
 v_inserted integer:=0;
 v_count integer:=0;
 v_part text;
begin
 if p_status not in ('verified','no_evidence','blocked','failed')
    or p_facts is null or jsonb_typeof(p_facts)<>'array'
    or jsonb_array_length(p_facts)>3
    or length(coalesce(p_reason,''))>160 then
   raise exception 'Invalid activity completion' using errcode='22023';
 end if;
 select * into v_q from private.network_profile_producer_activity_queue
 where company_id=p_company_id for update;
 if not found or v_q.state<>'leased' or v_q.lease_token is distinct from p_lease_token
    or v_q.lease_until <= now() then
   raise exception 'Current activity lease required' using errcode='42501';
 end if;
 select * into v_c from public.network_companies where id=p_company_id;
 if not found or v_c.publication_status<>'published' or v_c.archived_at is not null
    or not exists (
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=v_c.id and r.canonical_key='producer' and r.status='active'
    ) then
   raise exception 'Published producer required' using errcode='42501';
 end if;
 if p_status='verified' then
   if p_source_sha256 is null
      or p_source_sha256 !~ '^[a-f0-9]{64}$'
      or v_c.website_domain is null
      or coalesce(p_source_url,'') !~ '^https://[A-Za-z0-9.-]+(/|$)'
      or lower(split_part(p_source_url,'/',3)) not in (
        lower(v_c.website_domain),'www.'||lower(v_c.website_domain))
      or jsonb_array_length(p_facts)=0 then
     raise exception 'Official first-party proof required' using errcode='22023';
   end if;
 else
   if jsonb_array_length(p_facts)<>0 then
     raise exception 'Unverified facts must remain private' using errcode='22023';
   end if;
 end if;
 for v_item in select value from jsonb_array_elements(p_facts) loop
   v_field:=v_item->>'field_key';
   v_value:=v_item->'field_value';
   v_excerpt:=v_item->>'evidence_excerpt';
   if v_field not in ('description','products','services')
      or char_length(coalesce(v_excerpt,'')) not between 24 and 300
      or v_excerpt ~* '(mailto:|https?://|@)'
      or jsonb_typeof(v_value) is null then
     raise exception 'Invalid public evidence' using errcode='22023';
   end if;
   if v_field='description' then
     if jsonb_typeof(v_value)<>'string'
        or char_length(v_value#>>'{}') not between 30 and 240
        or nullif(btrim(v_c.description),'') is not null then
       -- A claimed/curated company narrative always wins.
       continue;
     end if;
   else
     if jsonb_typeof(v_value)<>'array' or jsonb_array_length(v_value) not between 1 and 5 then
       raise exception 'Invalid product or working labels' using errcode='22023';
     end if;
     for v_part in select jsonb_array_elements_text(v_value) loop
       if v_field='products' and v_part not in (
         'Tubi e condotte','Profilati in acciaio','Lamiere','Barre in acciaio',
         'Coils e nastri','Carpenteria metallica','Reti elettrosaldate',
         'Viti e bulloneria','Stampi e portastampi'
       ) then raise exception 'Unreviewed product classification' using errcode='22023'; end if;
       if v_field='services' and v_part not in (
         'Taglio laser','Taglio plasma','Saldatura','Piegatura','Calandratura',
         'Tornitura','Fresatura','Lavorazioni meccaniche','Carpenteria metallica'
       ) then raise exception 'Unreviewed working classification' using errcode='22023'; end if;
     end loop;
   end if;
   if not exists (
     select 1 from private.network_company_enrichment e
     where e.canonical_company_id=p_company_id and e.field_key=v_field
       and e.review_status='accepted'
   ) then
     insert into private.network_company_enrichment (
       canonical_company_id,field_key,field_value,evidence_url,evidence_excerpt,
       extractor_version,confidence,review_status,fetched_at
     ) values (
       p_company_id,v_field,v_value,p_source_url,v_excerpt,
       'netprofile-prod1b-v1',1.000,'accepted',now()
     ) on conflict do nothing;
     get diagnostics v_inserted=row_count;
     v_count:=v_count+v_inserted;
   end if;
 end loop;
 update private.network_profile_producer_activity_queue
 set state=case when p_status='verified' and v_count=0 then 'no_evidence'
                else p_status end,
     lease_token=null,lease_until=null,source_url=p_source_url,
     last_source_sha256=p_source_sha256,last_reason=left(p_reason,160),
     last_checked_at=now(),
     next_attempt_at=now()+case when p_status='failed' then interval '3 days'
       when p_status='blocked' then interval '30 days'
       when p_status='no_evidence' then interval '45 days'
       else interval '90 days' end,
     updated_at=now()
 where company_id=p_company_id;
 insert into private.network_profile_producer_activity_events
   (company_id,outcome,accepted_count,source_url,source_sha256,reason)
 values (p_company_id,p_status,v_count,p_source_url,p_source_sha256,left(p_reason,160));
 return jsonb_build_object(
   'contract','netprofile-prod1b-complete-v1','accepted',v_count,
   'outcome',p_status,'published_companies',0);
end;
$$;

revoke all on function private.netprofile_prod1b_claim(integer) from public,anon,authenticated;
revoke all on function private.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function private.netprofile_prod1b_claim(integer) to service_role;
grant execute on function private.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) to service_role;


-- A bounded one-time recheck for previous NO_EVIDENCE records whose processed
-- first-party technical sections were not all read by the earlier one-page
-- worker. No acceptance or publication occurs in this migration.
with candidates as (
  select q.company_id
  from private.network_profile_producer_activity_queue q
  where q.state='no_evidence'
    and q.last_reason='no_explicit_manufacture_relation'
    and exists (
      select 1 from private.network_producer_auto1_product_pages p
      join public.network_companies c on c.id=p.company_id
      where p.company_id=q.company_id and c.publication_status='published'
        and c.archived_at is null
        and p.status='processed' and p.page_kind='products'
        and p.last_sha256 ~ '^[a-f0-9]{64}$'
        and lower(p.canonical_domain)=lower(c.website_domain)
        and p.source_url ~ '^https://[A-Za-z0-9.-]+(/|$)'
        and lower(split_part(p.source_url,'/',3)) in (
          lower(c.website_domain),'www.'||lower(c.website_domain)
        )
    )
  order by q.last_checked_at,q.company_id
  limit 25
)
update private.network_profile_producer_activity_queue q
set state='queued',next_attempt_at=now(),updated_at=now(),
    last_reason='official_section_depth_recheck'
from candidates c where q.company_id=c.company_id;
