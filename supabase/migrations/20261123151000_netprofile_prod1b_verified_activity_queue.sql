-- NET-PROFILE-PROD1.B: first-party, source-correlated manufacturer activity.
-- Dedicated and independent from paused DATA2 #1297/#1300.
-- No company role, verification, stock, catalog, or claimed profile mutations.
create table if not exists private.network_profile_producer_activity_queue (
  company_id uuid primary key references public.network_companies(id) on delete cascade,
  state text not null default 'queued'
    check (state in ('queued','leased','verified','no_evidence','blocked','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  source_url text,
  last_source_sha256 text,
  last_reason text,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists network_profile_producer_activity_next_idx
  on private.network_profile_producer_activity_queue(next_attempt_at,company_id);
alter table private.network_profile_producer_activity_queue enable row level security;
revoke all on private.network_profile_producer_activity_queue from public,anon,authenticated;

create table if not exists private.network_profile_producer_activity_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.network_companies(id) on delete cascade,
  outcome text not null,
  accepted_count integer not null default 0,
  source_url text,
  source_sha256 text,
  reason text,
  occurred_at timestamptz not null default now()
);
alter table private.network_profile_producer_activity_events enable row level security;
revoke all on private.network_profile_producer_activity_events from public,anon,authenticated;

-- All callable public wrappers are SERVICE ROLE ONLY + SECURITY INVOKER.
-- The private implementation never accepts arbitrary company publication states.
create or replace function private.netprofile_prod1b_seed(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_added integer;
begin
  if p_limit not between 1 and 250 then
    raise exception 'Invalid seed size' using errcode='22023';
  end if;
  with eligible as (
    select c.id
    from public.network_companies c
    where c.publication_status='published'
      and c.archived_at is null
      and c.website_url ~ '^https://[A-Za-z0-9.-]+(/|$)'
      and c.website_domain is not null
      and not exists (
        select 1 from private.network_profile_producer_activity_queue q
        where q.company_id=c.id
      )
      and lower(split_part(c.website_url,'/',3)) in (
        lower(c.website_domain), 'www.' || lower(c.website_domain)
      )
      and exists (
        select 1 from public.network_company_role_assignments a
        join public.network_company_roles r on r.id=a.role_id
        where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
      )
      and (
        (nullif(btrim(c.description),'') is null and not exists (
          select 1 from private.network_company_enrichment e
          where e.canonical_company_id=c.id and e.field_key='description'
            and e.review_status='accepted'
        ))
        or (not exists (
          select 1 from public.network_company_products p where p.company_id=c.id
        ) and not exists (
          select 1 from private.network_company_enrichment e
          where e.canonical_company_id=c.id and e.field_key='products'
            and e.review_status='accepted'
        ))
      )
    order by case when c.country_code='IT' then 0
                  when c.country_code='RO' then 1 else 2 end,
             c.id
    limit p_limit
  ), inserted as (
    insert into private.network_profile_producer_activity_queue(company_id)
    select id from eligible
    on conflict(company_id) do nothing
    returning company_id
  ) select count(*) into v_added from inserted;
  return jsonb_build_object('contract','netprofile-prod1b-seed-v1','added',v_added);
end;
$$;

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
    order by q.next_attempt_at,q.company_id
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
    or jsonb_array_length(p_facts)>2
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
      or p_source_sha256 !~ '^[a-f0-9]{64} !~ '^https://[A-Za-z0-9.-]+(/|$)'
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
   if v_field not in ('description','products')
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
       raise exception 'Invalid product labels' using errcode='22023';
     end if;
     for v_part in select jsonb_array_elements_text(v_value) loop
       if v_part not in (
         'Tubi e condotte','Profilati in acciaio','Lamiere','Barre in acciaio',
         'Coils e nastri','Carpenteria metallica','Reti elettrosaldate',
         'Viti e bulloneria','Stampi e portastampi'
       ) then raise exception 'Unreviewed product classification' using errcode='22023'; end if;
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

revoke all on function private.netprofile_prod1b_seed(integer) from public,anon,authenticated;
revoke all on function private.netprofile_prod1b_claim(integer) from public,anon,authenticated;
revoke all on function private.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function private.netprofile_prod1b_seed(integer) to service_role;
grant execute on function private.netprofile_prod1b_claim(integer) to service_role;
grant execute on function private.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) to service_role;

create or replace function public.netprofile_prod1b_seed(p_limit integer default 100)
returns jsonb language sql security invoker set search_path=''
as $$ select private.netprofile_prod1b_seed(p_limit); $$;
create or replace function public.netprofile_prod1b_claim(p_limit integer default 5)
returns jsonb language sql security invoker set search_path=''
as $$ select private.netprofile_prod1b_claim(p_limit); $$;
create or replace function public.netprofile_prod1b_complete(
 p_company_id uuid,p_lease_token uuid,p_status text,
 p_source_url text default null,p_source_sha256 text default null,
 p_facts jsonb default '[]'::jsonb,p_reason text default null
) returns jsonb language sql security invoker set search_path=''
as $$ select private.netprofile_prod1b_complete(
  p_company_id,p_lease_token,p_status,p_source_url,p_source_sha256,p_facts,p_reason
); $$;
revoke all on function public.netprofile_prod1b_seed(integer) from public,anon,authenticated;
revoke all on function public.netprofile_prod1b_claim(integer) from public,anon,authenticated;
revoke all on function public.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.netprofile_prod1b_seed(integer) to service_role;
grant execute on function public.netprofile_prod1b_claim(integer) to service_role;
grant execute on function public.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) to service_role;

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
   if v_field not in ('description','products')
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
       raise exception 'Invalid product labels' using errcode='22023';
     end if;
     for v_part in select jsonb_array_elements_text(v_value) loop
       if v_part not in (
         'Tubi e condotte','Profilati in acciaio','Lamiere','Barre in acciaio',
         'Coils e nastri','Carpenteria metallica','Reti elettrosaldate',
         'Viti e bulloneria','Stampi e portastampi'
       ) then raise exception 'Unreviewed product classification' using errcode='22023'; end if;
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

revoke all on function private.netprofile_prod1b_seed(integer) from public,anon,authenticated;
revoke all on function private.netprofile_prod1b_claim(integer) from public,anon,authenticated;
revoke all on function private.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function private.netprofile_prod1b_seed(integer) to service_role;
grant execute on function private.netprofile_prod1b_claim(integer) to service_role;
grant execute on function private.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) to service_role;

create or replace function public.netprofile_prod1b_seed(p_limit integer default 100)
returns jsonb language sql security invoker set search_path=''
as $$ select private.netprofile_prod1b_seed(p_limit); $$;
create or replace function public.netprofile_prod1b_claim(p_limit integer default 5)
returns jsonb language sql security invoker set search_path=''
as $$ select private.netprofile_prod1b_claim(p_limit); $$;
create or replace function public.netprofile_prod1b_complete(
 p_company_id uuid,p_lease_token uuid,p_status text,
 p_source_url text default null,p_source_sha256 text default null,
 p_facts jsonb default '[]'::jsonb,p_reason text default null
) returns jsonb language sql security invoker set search_path=''
as $$ select private.netprofile_prod1b_complete(
  p_company_id,p_lease_token,p_status,p_source_url,p_source_sha256,p_facts,p_reason
); $$;
revoke all on function public.netprofile_prod1b_seed(integer) from public,anon,authenticated;
revoke all on function public.netprofile_prod1b_claim(integer) from public,anon,authenticated;
revoke all on function public.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.netprofile_prod1b_seed(integer) to service_role;
grant execute on function public.netprofile_prod1b_claim(integer) to service_role;
grant execute on function public.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text) to service_role;
