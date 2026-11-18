-- NET-PRO-PRODUCERS C3.DATA2.B — durable catalogue discovery across every
-- currently published Italian and Romanian producer-role company.
-- A role is a discovery lead, never proof of manufacturing a steel tube.
-- This queue holds URLs and progress only: no PDF bytes or copied tables.

create table private.network_producer_catalog_discovery_queue(
 company_id uuid primary key references public.network_companies(id),
 canonical_domain text not null,
 country_code text not null check(country_code in ('IT','RO')),
 status text not null default 'pending'
  check(status in ('pending','leased','discovered','none_found','blocked','retry')),
 priority integer not null default 0,
 attempts integer not null default 0 check(attempts between 0 and 1000),
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,lease_expires_at timestamptz,
 last_started_at timestamptz,last_finished_at timestamptz,
 last_error text check(last_error is null or length(last_error)<=80),
 last_new_links integer not null default 0 check(last_new_links between 0 and 20),
 last_total_links integer not null default 0 check(last_total_links between 0 and 20),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table private.network_producer_catalog_discovery_queue enable row level security;
revoke all on private.network_producer_catalog_discovery_queue from public,anon,authenticated,service_role;
create index network_producer_catalog_discovery_next_idx
 on private.network_producer_catalog_discovery_queue(next_attempt_at,priority desc)
 where status in ('pending','retry','discovered','none_found','blocked','leased');

create table private.network_producer_catalog_discovery_events(
 id bigint generated always as identity primary key,
 company_id uuid not null references public.network_companies(id),
 action text not null check(action in ('seed','claim','complete','retry')),
 discovered_links integer not null default 0,
 error_code text,
 occurred_at timestamptz not null default now()
);
alter table private.network_producer_catalog_discovery_events enable row level security;
revoke all on private.network_producer_catalog_discovery_events from public,anon,authenticated,service_role;
create function private.netproducers_catalog_discovery_events_immutable()
 returns trigger language plpgsql set search_path='' as $q$
begin raise exception 'Catalogue discovery audit is append only' using errcode='42501';end;
$q$;
create trigger netproducers_catalog_discovery_events_guard before update or delete
 on private.network_producer_catalog_discovery_events for each row
 execute function private.netproducers_catalog_discovery_events_immutable();

create function private.netproducers_catalog_discovery_seed_impl(p_limit int default 250)
returns jsonb language plpgsql security definer set search_path='' as $q$
declare v_count int;v_rows jsonb;
begin
 if p_limit is null or p_limit not between 1 and 500 then
  raise exception 'Discovery seed limit invalid' using errcode='22023';end if;
 with candidates as (
  select c.id as company_id,c.website_domain,c.country_code,c.legal_name
  from public.network_companies c
  where c.country_code in ('IT','RO')
   and c.publication_status='published' and c.archived_at is null
   and c.website_domain is not null
   and c.website_domain ~* '^[a-z0-9][a-z0-9.-]{3,200}[.][a-z]{2,}$'
   and exists (
    select 1 from public.network_company_role_assignments a
    join public.network_company_roles r on r.id=a.role_id
    where a.company_id=c.id and r.canonical_key='producer' and r.status='active')
   and not exists (
    select 1 from private.network_producer_catalog_discovery_queue q
    where q.company_id=c.id)
  order by case when c.legal_name ~* '(tubi|tube|tubes|tubif|pipe|profili|inox|acciai|steel)' then 0 else 1 end,
   c.country_code,c.id limit p_limit
 ), inserted as (
 insert into private.network_producer_catalog_discovery_queue(
  company_id,canonical_domain,country_code,priority)
 select company_id,regexp_replace(lower(website_domain),'^www[.]',''),
  country_code,
  case when legal_name ~* '(tubi|tube|tubes|tubif|pipe|profili|inox|acciai|steel)' then 10 else 0 end
 from candidates
 on conflict(company_id) do nothing
 returning company_id
 )
 insert into private.network_producer_catalog_discovery_events(company_id,action)
 select company_id,'seed' from inserted;
 get diagnostics v_count=row_count;
 return jsonb_build_object('contract','netproducers-catalog-discovery-v1',
  'operation','seed','added',v_count);
end;
$q$;

create function private.netproducers_catalog_discovery_impl(
 p_operation text,p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $q$
declare v_limit int;v_company uuid;v_token uuid;v_q private.network_producer_catalog_discovery_queue%rowtype;
v_items jsonb;v_entry jsonb;v_url text;v_title text;v_page text;v_domain text;v_new int:=0;v_processed int:=0;v_status text;
begin
 if p_operation='seed' then
  return private.netproducers_catalog_discovery_seed_impl(
   coalesce((p_payload->>'limit')::int,250));
 elsif p_operation='stats' then
  return (select jsonb_build_object(
   'contract','netproducers-catalog-discovery-v1','operation','stats',
   'total',count(*),'pending',count(*) filter(where status='pending'),
   'leased',count(*) filter(where status='leased'),
   'discovered',count(*) filter(where status='discovered'),
   'no_catalog',count(*) filter(where status='none_found'),
   'retry',count(*) filter(where status='retry'),
   'blocked',count(*) filter(where status='blocked'),
   'italy',count(*) filter(where country_code='IT'),
   'romania',count(*) filter(where country_code='RO')
  ) from private.network_producer_catalog_discovery_queue);
 elsif p_operation='claim' then
  v_limit:=coalesce((p_payload->>'limit')::int,2);
  if v_limit not between 1 and 3 then
   raise exception 'Invalid catalogue claim cap' using errcode='22023';end if;
  with ready as (
   select q.company_id
    from private.network_producer_catalog_discovery_queue q
    join public.network_companies c on c.id=q.company_id
    where q.next_attempt_at<=now()
     and (q.status in ('pending','retry','discovered','none_found','blocked')
      or(q.status='leased' and q.lease_expires_at<now()))
     and c.publication_status='published' and c.archived_at is null
     and c.country_code=q.country_code
     and lower(regexp_replace(c.website_domain,'^www[.]',''))=q.canonical_domain
     and exists(
      select 1 from public.network_company_role_assignments a
      join public.network_company_roles r on r.id=a.role_id
      where a.company_id=c.id and r.canonical_key='producer' and r.status='active')
    order by q.priority desc,q.next_attempt_at,q.company_id
    for update of q skip locked limit v_limit
  ), leased as (
    update private.network_producer_catalog_discovery_queue q set
      status='leased',lease_token=gen_random_uuid(),
      lease_expires_at=now()+interval '9 minutes',
      last_started_at=now(),attempts=attempts+1,updated_at=now()
    from ready where q.company_id=ready.company_id
    returning q.company_id,q.canonical_domain,q.country_code,q.lease_token,q.priority
  )
  select coalesce(jsonb_agg(jsonb_build_object(
   'company_id',company_id,'canonical_domain',canonical_domain,
   'country_code',country_code,'lease_token',lease_token,
   'priority',priority,'homepage','https://' || canonical_domain || '/'
  ) order by priority desc,company_id),'[]'::jsonb) into v_items from leased;
  insert into private.network_producer_catalog_discovery_events(company_id,action)
  select (item->>'company_id')::uuid,'claim'
   from jsonb_array_elements(v_items) item;
  return jsonb_build_object('contract','netproducers-catalog-discovery-v1',
    'operation','claim','items',v_items,'count',jsonb_array_length(v_items));
 elsif p_operation='complete' then
  if p_payload is null or p_payload->>'company_id' is null
   or p_payload->>'lease_token' is null
   or(p_payload->>'status') not in ('discovered','none_found','blocked','retry') then
   raise exception 'Invalid discovery completion' using errcode='22023';end if;
  v_company:=(p_payload->>'company_id')::uuid;
  v_token:=(p_payload->>'lease_token')::uuid;
  select * into v_q from private.network_producer_catalog_discovery_queue
   where company_id=v_company and status='leased'
    and lease_token=v_token and lease_expires_at>now() for update;
  if not found then
   raise exception 'Catalogue discovery lease expired/replayed' using errcode='42501';end if;
  v_domain:=v_q.canonical_domain;v_status:=p_payload->>'status';
  if v_status='discovered' then
   v_items:=p_payload->'links';
   if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)>8 then
    raise exception 'Invalid discovered links array' using errcode='22023';end if;
   for v_entry in select value from jsonb_array_elements(v_items) a(value) loop
    v_url:=v_entry->>'url';v_title:=v_entry->>'title';
    v_page:=v_entry->>'discovery_page_url';
    if v_url is null or length(v_url)>1200
     or v_url !~* '^https://[a-z0-9.-]+/[a-zA-Z0-9._~/%+-]+[.]pdf([?][A-Za-z0-9_=%&.-]{0,200})?$'
     or v_title is null or length(v_title) not between 5 and 220
     or v_page is null or length(v_page)>1200
     or lower(split_part(v_url,'/',3)) not in (v_domain,'www.'||v_domain)
     or lower(split_part(v_page,'/',3)) not in (v_domain,'www.'||v_domain)
     or left(v_page,8)<>'https://'
    then raise exception 'Not first-party PDF/catalog source evidence' using errcode='42501';end if;
    insert into private.network_producer_catalog_links(
      company_id,title,source_url,document_type,rights_status,source_status)
    values(v_company,v_title,v_url,'official_pdf','link_only','official_link_observed')
    on conflict(company_id,source_url) do nothing;
    get diagnostics v_processed=row_count;
    v_new:=v_new+v_processed;
   end loop;
  elsif p_payload ? 'links' then
   raise exception 'Non-discovery results cannot submit links' using errcode='22023';
  end if;
  update private.network_producer_catalog_discovery_queue q set
   status=v_status,lease_token=null,lease_expires_at=null,
   last_finished_at=now(),updated_at=now(),
   last_error=case when v_status in ('blocked','retry') then
     left(coalesce(p_payload->>'error_code','remote_unavailable'),80) else null end,
   last_new_links=v_new,
   last_total_links=case when v_status='discovered'
    then jsonb_array_length(v_items) else 0 end,
   next_attempt_at=case when v_status='discovered' then now()+interval '30 days'
    when v_status='none_found' then now()+interval '45 days'
    when v_status='blocked' then now()+interval '7 days'
    else now()+make_interval(hours=>least(168,6*v_q.attempts)) end
  where q.company_id=v_company;
  insert into private.network_producer_catalog_discovery_events(
    company_id,action,discovered_links,error_code)
  values(v_company,case when v_status='retry' then 'retry' else 'complete' end,
    v_new,left(p_payload->>'error_code',80));
  return jsonb_build_object('contract','netproducers-catalog-discovery-v1',
   'operation','complete','status',v_status,'added',v_new);
 end if;
 raise exception 'Invalid discovery operation' using errcode='22023';
end;
$q$;
create function public.netproducers_catalog_discovery(
 p_operation text,p_payload jsonb default '{}'::jsonb
) returns jsonb language sql security invoker set search_path='' as $q$
 select private.netproducers_catalog_discovery_impl(p_operation,p_payload);
$q$;
revoke all on function private.netproducers_catalog_discovery_impl(text,jsonb)
 from public,anon,authenticated;
revoke all on function public.netproducers_catalog_discovery(text,jsonb)
 from public,anon,authenticated;
revoke all on function private.netproducers_catalog_discovery_seed_impl(integer)
 from public,anon,authenticated;
revoke all on function private.netproducers_catalog_discovery_events_immutable()
 from public,anon,authenticated;
grant execute on function private.netproducers_catalog_discovery_impl(text,jsonb)
 to service_role;
grant execute on function private.netproducers_catalog_discovery_seed_impl(integer)
 to service_role;
grant execute on function public.netproducers_catalog_discovery(text,jsonb)
 to service_role;

-- First cohort: all currently published producer-role leads, 118 IT + 18 RO.
-- Role/identity validation is done again at claim; nothing is published here.
select private.netproducers_catalog_discovery_seed_impl(250);
