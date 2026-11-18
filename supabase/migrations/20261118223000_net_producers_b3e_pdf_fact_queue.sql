-- B3.E: service-only bounded observation queue for published first-party PDFs.
-- Link-only remains link-only; this queue NEVER creates or asserts a B2 grant.
create table private.network_producer_pdf_fact_queue (
 company_id uuid not null references public.network_companies(id),
 source_url text not null,
 canonical_domain text not null,
 status text not null default 'pending'
   check (status in ('pending','leased','complete','blocked','retry')),
 attempts int not null default 0 check (attempts between 0 and 10),
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 last_error text,
 observed_dimensions int not null default 0,
 observed_thickness int not null default 0,
 staged_dimensions int not null default 0,
 staged_thickness int not null default 0,
 updated_at timestamptz not null default now(),
 primary key(company_id,source_url)
);
alter table private.network_producer_pdf_fact_queue enable row level security;
revoke all on private.network_producer_pdf_fact_queue from public,anon,authenticated,service_role;

create function private.netproducers_b3e_pdf_fact_queue_impl(
 p_operation text,p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_limit int;v_added int:=0;v_rows jsonb;v_count int:=0;
 v_company uuid;v_url text;v_token uuid;v_status text;v_attempt int;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object'
 or pg_column_size(p_payload)>10000 then
  raise exception 'Bad B3E payload' using errcode='22023';
 end if;
 if p_operation='seed' then
  v_limit:=coalesce((p_payload->>'limit')::int,40);
  if v_limit not between 1 and 50 then
    raise exception 'Bad seed limit' using errcode='22023';end if;
  with eligible as (
   select l.company_id,l.source_url,
    regexp_replace(lower(c.website_domain),'^www[.]','') as canonical_domain
   from private.network_producer_catalog_links l
   join public.network_companies c on c.id=l.company_id
   where c.publication_status='published' and c.archived_at is null
    and c.country_code='IT'
    and c.website_domain is not null
    and l.document_type='official_pdf'
    and l.rights_status='link_only'
    and l.source_status='official_link_observed'
    and l.source_url like 'https://%.pdf%'
    and lower(split_part(l.source_url,'/',3)) in (
     regexp_replace(lower(c.website_domain),'^www[.]',''),
     'www.'||regexp_replace(lower(c.website_domain),'^www[.]','')
    )
    and exists (
     select 1 from public.network_company_role_assignments a
     join public.network_company_roles r on r.id=a.role_id
     where a.company_id=c.id and r.canonical_key='producer' and r.status='active'
    )
   order by l.company_id,l.source_url limit v_limit
  ), added as (
   insert into private.network_producer_pdf_fact_queue(company_id,source_url,canonical_domain)
   select company_id,source_url,canonical_domain from eligible
   on conflict(company_id,source_url) do nothing returning 1
  ) select count(*) into v_added from added;
  return jsonb_build_object('contract','netproducers-b3e-pdf-queue-v1',
   'operation','seed','added',v_added);
 elsif p_operation='claim' then
  v_limit:=coalesce((p_payload->>'limit')::int,1);
  if v_limit not between 1 and 3 then
   raise exception 'Bad claim limit' using errcode='22023';end if;
  with selected as (
   select company_id,source_url from private.network_producer_pdf_fact_queue
   where ((status in ('pending','retry') and next_attempt_at<=now())
          or(status='leased' and lease_until<now()))
    and attempts<10
   order by attempts,next_attempt_at,company_id
   for update skip locked limit v_limit
  ), leased as (
   update private.network_producer_pdf_fact_queue q
   set status='leased', attempts=q.attempts+1,
       lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',
       updated_at=now()
   from selected s where q.company_id=s.company_id and q.source_url=s.source_url
   returning q.company_id,q.source_url,q.canonical_domain,q.lease_token
  ) select coalesce(jsonb_agg(jsonb_build_object(
   'company_id',company_id,'source_url',source_url,
   'canonical_domain',canonical_domain,
   'source_status','official_link_observed','rights_status','link_only',
   'lease_token',lease_token)),'[]'::jsonb),count(*)
   into v_rows,v_count from leased;
  return jsonb_build_object('contract','netproducers-b3e-pdf-queue-v1',
   'operation','claim','items',v_rows,'count',v_count);
 elsif p_operation='complete' then
  v_company:=(p_payload->>'company_id')::uuid;
  v_url:=p_payload->>'source_url';
  v_token:=(p_payload->>'lease_token')::uuid;
  v_status:=p_payload->>'status';
  if v_company is null or v_token is null or v_url is null
   or v_status not in ('complete','blocked','retry')
   or length(coalesce(p_payload->>'error_code',''))>80
  then raise exception 'Invalid B3E completion' using errcode='22023';end if;
  update private.network_producer_pdf_fact_queue q set
   status=v_status,lease_token=null,lease_until=null,
   last_error=case when v_status='complete' then null else p_payload->>'error_code' end,
   observed_dimensions=case when v_status='complete' then
    least(120,greatest(0,coalesce((p_payload->>'dimension_candidates')::int,0)))
    else q.observed_dimensions end,
   observed_thickness=case when v_status='complete' then
    least(300,greatest(0,coalesce((p_payload->>'thickness_candidates')::int,0)))
    else q.observed_thickness end,
   staged_dimensions=case when v_status='complete' then
    least(120,greatest(0,coalesce((p_payload->>'staged_dimensions')::int,0)))
    else q.staged_dimensions end,
   staged_thickness=case when v_status='complete' then
    least(300,greatest(0,coalesce((p_payload->>'staged_thickness')::int,0)))
    else q.staged_thickness end,
   next_attempt_at=case when v_status='retry'
    then now()+least(q.attempts*interval '1 hour',interval '24 hours')
    else q.next_attempt_at end,
   updated_at=now()
  where q.company_id=v_company and q.source_url=v_url
   and q.status='leased' and q.lease_token=v_token
   and q.lease_until>now();
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'Stale B3E lease' using errcode='42501';end if;
  return jsonb_build_object('contract','netproducers-b3e-pdf-queue-v1',
   'operation','complete','updated',v_count);
 else
  raise exception 'Unknown B3E operation' using errcode='22023';
 end if;
end;
$fn$;
create function public.netproducers_b3e_pdf_fact_queue(
 p_operation text,p_payload jsonb default '{}'::jsonb
) returns jsonb language sql security invoker set search_path='' as $fn$
 select private.netproducers_b3e_pdf_fact_queue_impl(p_operation,p_payload);
$fn$;
revoke all on function private.netproducers_b3e_pdf_fact_queue_impl(text,jsonb) from public,anon,authenticated;
revoke all on function public.netproducers_b3e_pdf_fact_queue(text,jsonb) from public,anon,authenticated;
grant execute on function private.netproducers_b3e_pdf_fact_queue_impl(text,jsonb) to service_role;
grant execute on function public.netproducers_b3e_pdf_fact_queue(text,jsonb) to service_role;
